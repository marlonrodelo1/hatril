import 'server-only';

import { and, asc, eq, gt } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import {
  donativoLineas,
  donativos,
  donativosMensuales,
  fondos,
  iglesias,
} from '@/lib/db/schema';
import type { TipoDonativo } from '@/lib/donativos/calculo';
import { hashDeToken } from '@/lib/donativos/recibo';

/**
 * Lo que leen la pantalla de gracias y la de lo de cada mes.
 *
 * POR QUÉ `dbAdmin`
 * -----------------
 * Las dos son de alguien que puede no tener cuenta: quien acaba de volver de
 * Stripe y quien abre el enlace de su recibo. No hay sesión con la que pasar
 * por `withUser`, y la RLS de la `0056` no deja leer donativos a `anon`.
 *
 * Lo que sustituye a la sesión es lo que viene en la dirección, y por eso cada
 * consulta lo comprueba TODO en el mismo `where`: el id o el token, la iglesia
 * del slug y, en gracias, la ventana de 24 horas. Si se separara en dos pasos
 * («busco el donativo y luego miro si es de esta iglesia»), un día alguien
 * pintaría algo entre medias.
 *
 * Y se lee lo justo: ni el correo entero sale de aquí hacia la pantalla de
 * gracias (se enmascara antes de devolverlo), ni el id de Stripe de nada.
 */

const DONDE_MAS_FALTE = 'Donde más falte';

/** Una iglesia por su slug, esté o no publicada su web. */
async function iglesiaPorSlug(slug: string) {
  const [fila] = await dbAdmin
    .select({
      id: iglesias.id,
      slug: iglesias.slug,
      nombre: iglesias.nombre,
      ciudad: iglesias.ciudad,
      logoUrl: iglesias.logoUrl,
      timezone: iglesias.timezone,
      webPublica: iglesias.webPublica,
    })
    .from(iglesias)
    .where(eq(iglesias.slug, slug))
    .limit(1);
  return fila ?? null;
}

export type IglesiaDeDar = NonNullable<Awaited<ReturnType<typeof iglesiaPorSlug>>>;

export type LineaVista = { tipo: TipoDonativo; fondo: string; importe: string };

// ============================================================================
// Gracias
// ============================================================================

/**
 * Cuánto dura lo que enseña la pantalla de gracias. Un id de donativo en una
 * URL acaba en el historial del navegador, en un ordenador compartido o en una
 * captura reenviada; pasado un día, quien la abre ya no es quien acaba de pagar.
 */
const VENTANA_GRACIAS_MS = 24 * 60 * 60 * 1000;

export type DonativoGracias = {
  estado: 'pendiente' | 'pagado' | 'fallido' | 'reembolsado';
  periodicidad: 'una' | 'mensual';
  total: string;
  comisionCubierta: string;
  /** Solo el nombre de pila. */
  nombre: string;
  /** `a***@ejemplo.es`: nunca el correo entero. */
  correo: string;
  /** El día del cobro en la iglesia; nulo mientras está pendiente. */
  fecha: string | null;
  createdAt: Date;
  lineas: LineaVista[];
};

/** `ana.ruiz@ejemplo.es` → `a***@ejemplo.es`. */
export function enmascararCorreo(correo: string): string {
  const arroba = correo.lastIndexOf('@');
  if (arroba < 1) return '***';
  return `${correo[0]}***${correo.slice(arroba)}`;
}

/**
 * La iglesia y, si se puede enseñar, el donativo. `donativo` es `null` tanto si
 * no existe como si es de otra iglesia o tiene más de 24 horas: la pantalla
 * dice lo mismo en los tres casos, para que la dirección no sirva para
 * averiguar qué ids existen.
 */
export async function graciasDe(
  slug: string,
  donativoId: string | null,
): Promise<{ iglesia: IglesiaDeDar; donativo: DonativoGracias | null } | null> {
  const iglesia = await iglesiaPorSlug(slug);
  if (!iglesia) return null;
  if (!donativoId) return { iglesia, donativo: null };

  const desde = new Date(Date.now() - VENTANA_GRACIAS_MS);
  const [d] = await dbAdmin
    .select({
      estado: donativos.estado,
      periodicidad: donativos.periodicidad,
      total: donativos.total,
      comisionCubierta: donativos.comisionCubierta,
      donanteNombre: donativos.donanteNombre,
      donanteEmail: donativos.donanteEmail,
      fecha: donativos.fecha,
      createdAt: donativos.createdAt,
    })
    .from(donativos)
    .where(
      and(
        eq(donativos.id, donativoId),
        eq(donativos.iglesiaId, iglesia.id),
        gt(donativos.createdAt, desde),
      ),
    )
    .limit(1);
  if (!d) return { iglesia, donativo: null };

  const lineas = await lineasDeDonativo(donativoId, iglesia.id);

  return {
    iglesia,
    donativo: {
      estado: d.estado,
      periodicidad: d.periodicidad,
      total: d.total,
      comisionCubierta: d.comisionCubierta,
      nombre: d.donanteNombre.trim().split(/\s+/)[0] ?? '',
      correo: enmascararCorreo(d.donanteEmail),
      fecha: d.fecha,
      createdAt: d.createdAt,
      lineas,
    },
  };
}

async function lineasDeDonativo(donativoId: string, iglesiaId: string): Promise<LineaVista[]> {
  const filas = await dbAdmin
    .select({
      tipo: donativoLineas.tipoIngreso,
      fondo: fondos.nombre,
      esGeneral: fondos.esGeneral,
      importe: donativoLineas.importe,
    })
    .from(donativoLineas)
    .innerJoin(fondos, eq(fondos.id, donativoLineas.fondoId))
    .where(
      and(eq(donativoLineas.donativoId, donativoId), eq(donativoLineas.iglesiaId, iglesiaId)),
    )
    .orderBy(asc(donativoLineas.orden));
  return filas.map((l) => ({
    tipo: l.tipo as TipoDonativo,
    fondo: l.esGeneral ? DONDE_MAS_FALTE : l.fondo,
    importe: l.importe,
  }));
}

// ============================================================================
// Lo de cada mes, por el enlace del recibo
// ============================================================================

/**
 * El token del recibo es un HMAC en base64url (43 caracteres). Se mira la forma
 * antes de calcular nada: un enlace cortado al copiarlo o una ruta inventada no
 * merecen un viaje a la base.
 */
export function tokenBienFormado(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export type MensualVista = {
  id: string;
  estado: 'activo' | 'impagado' | 'cancelado';
  total: string;
  comisionCubierta: string;
  nombre: string;
  createdAt: Date;
  lineas: LineaVista[];
};

/**
 * La fila de `donativos_mensuales` de este token, solo si es de la iglesia del
 * slug. `null` en cualquier otro caso, sin distinguir cuál.
 *
 * Se busca por el sha-256 del token, que es lo único que guarda la base
 * (`recibo.ts`): quien lea la tabla no puede fabricar el enlace.
 */
export async function mensualPorToken(
  slug: string,
  token: string,
): Promise<{ iglesia: IglesiaDeDar; mensual: MensualVista | null } | null> {
  const iglesia = await iglesiaPorSlug(slug);
  if (!iglesia) return null;
  if (!tokenBienFormado(token)) return { iglesia, mensual: null };

  const [m] = await dbAdmin
    .select({
      id: donativosMensuales.id,
      estado: donativosMensuales.estado,
      total: donativosMensuales.total,
      comisionCubierta: donativosMensuales.comisionCubierta,
      donanteNombre: donativosMensuales.donanteNombre,
      createdAt: donativosMensuales.createdAt,
      lineas: donativosMensuales.lineas,
    })
    .from(donativosMensuales)
    .where(
      and(
        eq(donativosMensuales.tokenGestionHash, hashDeToken(token)),
        eq(donativosMensuales.iglesiaId, iglesia.id),
      ),
    )
    .limit(1);
  if (!m) return { iglesia, mensual: null };

  // Las líneas guardan el uuid del fondo; el nombre se pide aquí, y solo de
  // los fondos de esta iglesia.
  const nombres = new Map<string, string>();
  const ids = [...new Set(m.lineas.map((l) => l.fondoId))];
  if (ids.length) {
    const fs = await dbAdmin
      .select({ id: fondos.id, nombre: fondos.nombre, esGeneral: fondos.esGeneral })
      .from(fondos)
      .where(eq(fondos.iglesiaId, iglesia.id));
    for (const f of fs) nombres.set(f.id, f.esGeneral ? DONDE_MAS_FALTE : f.nombre);
  }

  return {
    iglesia,
    mensual: {
      id: m.id,
      estado: m.estado,
      total: m.total,
      comisionCubierta: m.comisionCubierta,
      nombre: m.donanteNombre.trim().split(/\s+/)[0] ?? '',
      createdAt: m.createdAt,
      lineas: m.lineas.map((l) => ({
        tipo: l.tipo,
        fondo: nombres.get(l.fondoId) ?? 'Un fondo que ya no existe',
        importe: l.importe,
      })),
    },
  };
}

/** El día del mes en que cae una fecha, en la zona de la iglesia. */
export function diaDelMes(momento: Date, timezone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, day: 'numeric' }).format(momento),
  );
}
