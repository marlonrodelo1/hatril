import 'server-only';

import { cache } from 'react';
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';

import { dbAdmin, withUser } from '@/lib/db';
import {
  cuentasStripe,
  donativoLineas,
  donativos,
  donativosMensuales,
  fondos,
  iglesias,
} from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import type { TipoDonativo } from './calculo';

/**
 * Lo que leen las pantallas de diezmos y ofrendas.
 *
 * DOS PUERTAS, Y CUÁL USA CADA UNA
 * --------------------------------
 * La página de dar es pública (puede dar quien no tiene cuenta) y lee la
 * iglesia con `dbAdmin`, por columnas sueltas, igual que `obtenerIglesiaPublica`.
 * Lo que enseña son datos que la iglesia publica para eso: nombre, logo, sus
 * fondos y su cuenta para transferencias. Nada de personas.
 *
 * El panel y «Lo que he dado» van por `withUser`, y ahí manda la RLS de la
 * `0056`: el pastor y tesorería ven los donativos de su iglesia, y cada cual
 * los suyos. Si una guarda faltara, la base seguiría sin enseñar los de otros.
 */

/** Un pago con tarjeta solo se ofrece en España y en euros (decisión 4). */
function cobraConTarjeta(
  cuenta: { cobrosActivos: boolean } | undefined,
  iglesia: { pais: string; moneda: string },
): boolean {
  return Boolean(cuenta?.cobrosActivos) && iglesia.pais === 'ES' && iglesia.moneda === 'EUR';
}

export type FondoDeDar = { id: string; nombre: string; esGeneral: boolean };

export type PaginaDeDar = {
  iglesia: {
    id: string;
    slug: string;
    nombre: string;
    ciudad: string | null;
    logoUrl: string | null;
    timezone: string;
    moneda: string;
    webPublica: boolean;
  };
  /** Si se puede pagar con tarjeta ahora mismo. */
  conTarjeta: boolean;
  /** Solo para el servidor: en qué cuenta de Stripe se cobra. Nunca al navegador. */
  stripeAccountId: string | null;
  /** La cuenta que la iglesia publica para transferencias, si la tiene. */
  transferencia: { cuenta: string; titular: string | null } | null;
  /** El general primero, como «Donde más falte»; luego los que la iglesia enciende. */
  fondos: FondoDeDar[];
};

/**
 * Todo lo que necesita `/i/[slug]/dar`. `null` si la iglesia no existe, está
 * suspendida o no tiene ni tarjeta ni cuenta para transferencias: entonces la
 * página no existe, igual que el botón no se pinta.
 *
 * NO exige `web_publica`: una iglesia puede querer recibir ofrendas de su gente
 * desde la app sin haber publicado su web.
 */
export async function paginaDeDar(slug: string): Promise<PaginaDeDar | null> {
  const filas = await dbAdmin
    .select({
      id: iglesias.id,
      slug: iglesias.slug,
      nombre: iglesias.nombre,
      ciudad: iglesias.ciudad,
      logoUrl: iglesias.logoUrl,
      timezone: iglesias.timezone,
      moneda: iglesias.moneda,
      pais: iglesias.pais,
      webPublica: iglesias.webPublica,
      cuentaDonativos: iglesias.cuentaDonativos,
      titularDonativos: iglesias.titularDonativos,
      stripeAccountId: cuentasStripe.stripeAccountId,
      cobrosActivos: cuentasStripe.cobrosActivos,
    })
    .from(iglesias)
    .leftJoin(cuentasStripe, eq(cuentasStripe.iglesiaId, iglesias.id))
    .where(and(eq(iglesias.slug, slug), eq(iglesias.activa, true)))
    .limit(1);

  const f = filas[0];
  if (!f) return null;

  const conTarjeta = cobraConTarjeta(
    f.cobrosActivos === null ? undefined : { cobrosActivos: f.cobrosActivos },
    f,
  );
  const cuenta = f.cuentaDonativos?.trim();
  const transferencia = cuenta
    ? { cuenta, titular: f.titularDonativos?.trim() || null }
    : null;
  if (!conTarjeta && !transferencia) return null;

  const listaFondos = conTarjeta
    ? await dbAdmin
        .select({ id: fondos.id, nombre: fondos.nombre, esGeneral: fondos.esGeneral })
        .from(fondos)
        .where(
          and(
            eq(fondos.iglesiaId, f.id),
            eq(fondos.activo, true),
            or(eq(fondos.esGeneral, true), eq(fondos.enDonativos, true)),
          ),
        )
        .orderBy(desc(fondos.esGeneral), asc(fondos.orden), asc(fondos.nombre))
    : [];

  return {
    iglesia: {
      id: f.id,
      slug: f.slug,
      nombre: f.nombre,
      ciudad: f.ciudad,
      logoUrl: f.logoUrl,
      timezone: f.timezone,
      moneda: f.moneda,
      webPublica: f.webPublica,
    },
    // Sin fondo general no hay a dónde apuntar «Donde más falte»: mejor no
    // ofrecer la tarjeta que fallar después de cobrar.
    conTarjeta: conTarjeta && listaFondos.some((x) => x.esGeneral),
    stripeAccountId: f.stripeAccountId ?? null,
    transferencia,
    fondos: listaFondos,
  };
}

/**
 * Si el botón «Dar» y la fila de Mi cuenta tienen a dónde llevar. Va en cada
 * carga de la cabecera del miembro, así que es una sola consulta pequeña y con
 * `cache()` dentro del mismo render.
 */
export const estadoDeDar = cache(async function estadoDeDar(
  iglesiaId: string,
): Promise<{ conTarjeta: boolean; conTransferencia: boolean }> {
  const filas = await dbAdmin
    .select({
      pais: iglesias.pais,
      moneda: iglesias.moneda,
      cuentaDonativos: iglesias.cuentaDonativos,
      cobrosActivos: cuentasStripe.cobrosActivos,
      // La misma condición que `paginaDeDar`: sin fondo general no hay a dónde
      // apuntar «Donde más falte», y el botón llevaría a una página sin tarjeta.
      conGeneral: sql<boolean>`exists (select 1 from ${fondos} where ${fondos.iglesiaId} = ${iglesias.id} and ${fondos.esGeneral} and ${fondos.activo})`,
    })
    .from(iglesias)
    .leftJoin(cuentasStripe, eq(cuentasStripe.iglesiaId, iglesias.id))
    .where(eq(iglesias.id, iglesiaId))
    .limit(1);
  const f = filas[0];
  if (!f) return { conTarjeta: false, conTransferencia: false };
  return {
    conTarjeta:
      f.conGeneral &&
      cobraConTarjeta(
        f.cobrosActivos === null ? undefined : { cobrosActivos: f.cobrosActivos },
        f,
      ),
    conTransferencia: Boolean(f.cuentaDonativos?.trim()),
  };
});

// ============================================================================
// El panel: Finanzas → Ofrendas en línea
// ============================================================================

export type DonativoReciente = {
  id: string;
  fecha: string | null;
  total: string;
  estado: 'pendiente' | 'pagado' | 'fallido' | 'reembolsado';
  periodicidad: 'una' | 'mensual';
  donanteNombre: string;
  donanteEmail: string;
  conCuenta: boolean;
  lineas: { tipo: TipoDonativo; fondo: string; importe: string }[];
};

export type ResumenEnLinea = {
  cuenta: { stripeAccountId: string; cobrosActivos: boolean; datosCompletos: boolean } | null;
  /** España y euros: si no, la tarjeta no se ofrece aunque conecte (decisión 4). */
  paisAdmitido: boolean;
  mes: { total: string; pagos: number; personas: number; comisiones: string };
  mensualesActivos: number;
  recientes: DonativoReciente[];
  fondos: { id: string; nombre: string; esGeneral: boolean; enDonativos: boolean }[];
};

/**
 * Lo que pinta la pestaña. Por `withUser`: quien no sea pastor ni tesorero ve
 * la conexión y los fondos, y cero donativos, porque la RLS no se los da.
 */
export async function resumenEnLinea(ctx: UserContext): Promise<ResumenEnLinea> {
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const [anio, mes] = hoy.slice(0, 7).split('-').map(Number) as [number, number];
  const siguiente = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;

  return withUser(ctx.user.id, async (tx) => {
    const [cuenta] = await tx
      .select({
        stripeAccountId: cuentasStripe.stripeAccountId,
        cobrosActivos: cuentasStripe.cobrosActivos,
        datosCompletos: cuentasStripe.datosCompletos,
      })
      .from(cuentasStripe)
      .where(eq(cuentasStripe.iglesiaId, ctx.iglesia.id))
      .limit(1);

    const delMes = and(
      eq(donativos.iglesiaId, ctx.iglesia.id),
      eq(donativos.estado, 'pagado'),
      gte(donativos.fecha, inicioMes),
      lt(donativos.fecha, siguiente),
    );
    const [mesFila] = await tx
      .select({
        total: sql<string>`coalesce(sum(${donativos.total}), 0)::text`,
        pagos: sql<number>`count(*)::int`,
        personas: sql<number>`count(distinct lower(${donativos.donanteEmail}))::int`,
        comisiones: sql<string>`coalesce(sum(${donativos.comisionStripe}), 0)::text`,
      })
      .from(donativos)
      .where(delMes);

    const [mensuales] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(donativosMensuales)
      .where(
        and(
          eq(donativosMensuales.iglesiaId, ctx.iglesia.id),
          eq(donativosMensuales.estado, 'activo'),
        ),
      );

    const recientes = await tx
      .select({
        id: donativos.id,
        fecha: donativos.fecha,
        total: donativos.total,
        estado: donativos.estado,
        periodicidad: donativos.periodicidad,
        donanteNombre: donativos.donanteNombre,
        donanteEmail: donativos.donanteEmail,
        donanteAuthUserId: donativos.donanteAuthUserId,
      })
      .from(donativos)
      .where(
        and(
          eq(donativos.iglesiaId, ctx.iglesia.id),
          inArray(donativos.estado, ['pagado', 'reembolsado']),
        ),
      )
      .orderBy(desc(donativos.pagadoAt))
      .limit(20);

    const lineas = recientes.length
      ? await tx
          .select({
            donativoId: donativoLineas.donativoId,
            tipo: donativoLineas.tipoIngreso,
            fondo: fondos.nombre,
            esGeneral: fondos.esGeneral,
            importe: donativoLineas.importe,
          })
          .from(donativoLineas)
          .innerJoin(fondos, eq(fondos.id, donativoLineas.fondoId))
          .where(inArray(donativoLineas.donativoId, recientes.map((r) => r.id)))
          .orderBy(asc(donativoLineas.orden))
      : [];

    const listaFondos = await tx
      .select({
        id: fondos.id,
        nombre: fondos.nombre,
        esGeneral: fondos.esGeneral,
        enDonativos: fondos.enDonativos,
      })
      .from(fondos)
      .where(and(eq(fondos.iglesiaId, ctx.iglesia.id), eq(fondos.activo, true)))
      .orderBy(desc(fondos.esGeneral), asc(fondos.orden), asc(fondos.nombre));

    return {
      cuenta: cuenta ?? null,
      paisAdmitido: ctx.iglesia.pais === 'ES' && ctx.iglesia.moneda === 'EUR',
      mes: {
        total: mesFila?.total ?? '0',
        pagos: mesFila?.pagos ?? 0,
        personas: mesFila?.personas ?? 0,
        comisiones: mesFila?.comisiones ?? '0',
      },
      mensualesActivos: mensuales?.n ?? 0,
      recientes: recientes.map((r) => ({
        id: r.id,
        fecha: r.fecha,
        total: r.total,
        estado: r.estado,
        periodicidad: r.periodicidad,
        donanteNombre: r.donanteNombre,
        donanteEmail: r.donanteEmail,
        conCuenta: r.donanteAuthUserId !== null,
        lineas: lineas
          .filter((l) => l.donativoId === r.id)
          .map((l) => ({
            tipo: l.tipo as TipoDonativo,
            fondo: l.esGeneral ? 'Donde más falte' : l.fondo,
            importe: l.importe,
          })),
      })),
      fondos: listaFondos,
    };
  });
}

// ============================================================================
// «Lo que he dado», de la propia persona
// ============================================================================

export type MisDonativos = {
  anio: number;
  aniosConDatos: number[];
  total: string;
  diezmo: string;
  ofrendas: string;
  lista: { id: string; fecha: string; total: string; periodicidad: 'una' | 'mensual'; lineas: { tipo: TipoDonativo; fondo: string; importe: string }[] }[];
  mensuales: { id: string; total: string; lineas: { tipo: TipoDonativo; fondo: string; importe: string }[]; dia: number | null; estado: 'activo' | 'impagado' | 'cancelado' }[];
};

/**
 * Lo que esta persona ha dado a SU iglesia en un año. Filtra por su
 * `auth_user_id` además de lo que ya filtra la RLS: un pastor ve los de toda la
 * iglesia por la policy, y aquí solo quiere los suyos.
 */
export async function misDonativos(ctx: UserContext, anioPedido?: number): Promise<MisDonativos> {
  const yo = ctx.user.id;
  return withUser(yo, async (tx) => {
    const anios = await tx
      .selectDistinct({ anio: sql<number>`extract(year from ${donativos.fecha})::int` })
      .from(donativos)
      .where(and(eq(donativos.donanteAuthUserId, yo), eq(donativos.iglesiaId, ctx.iglesia.id), eq(donativos.estado, 'pagado')));
    const aniosConDatos = anios.map((a) => a.anio).sort((a, b) => b - a);
    const actual = Number(hoyEnLaIglesia(ctx.iglesia.timezone).slice(0, 4));
    const anio = anioPedido && aniosConDatos.includes(anioPedido) ? anioPedido : actual;

    const lista = await tx
      .select({ id: donativos.id, fecha: donativos.fecha, total: donativos.total, periodicidad: donativos.periodicidad })
      .from(donativos)
      .where(
        and(
          eq(donativos.donanteAuthUserId, yo),
          eq(donativos.iglesiaId, ctx.iglesia.id),
          eq(donativos.estado, 'pagado'),
          gte(donativos.fecha, `${anio}-01-01`),
          lt(donativos.fecha, `${anio + 1}-01-01`),
        ),
      )
      .orderBy(desc(donativos.fecha), desc(donativos.pagadoAt));

    const lineas = lista.length
      ? await tx
          .select({ donativoId: donativoLineas.donativoId, tipo: donativoLineas.tipoIngreso, fondo: fondos.nombre, esGeneral: fondos.esGeneral, importe: donativoLineas.importe })
          .from(donativoLineas)
          .innerJoin(fondos, eq(fondos.id, donativoLineas.fondoId))
          .where(inArray(donativoLineas.donativoId, lista.map((d) => d.id)))
          .orderBy(asc(donativoLineas.orden))
      : [];

    const mensualesFilas = await tx
      .select({ id: donativosMensuales.id, total: donativosMensuales.total, lineas: donativosMensuales.lineas, estado: donativosMensuales.estado, createdAt: donativosMensuales.createdAt })
      .from(donativosMensuales)
      .where(and(eq(donativosMensuales.donanteAuthUserId, yo), eq(donativosMensuales.iglesiaId, ctx.iglesia.id), inArray(donativosMensuales.estado, ['activo', 'impagado'])));

    const nombresFondo = new Map<string, string>();
    if (mensualesFilas.length) {
      const ids = [...new Set(mensualesFilas.flatMap((m) => m.lineas.map((l) => l.fondoId)))];
      const fs = await tx.select({ id: fondos.id, nombre: fondos.nombre, esGeneral: fondos.esGeneral }).from(fondos).where(inArray(fondos.id, ids));
      for (const f of fs) nombresFondo.set(f.id, f.esGeneral ? 'Donde más falte' : f.nombre);
    }

    const sumar = (filtro: (l: (typeof lineas)[number]) => boolean) =>
      lineas.filter(filtro).reduce((s, l) => s + Math.round(Number(l.importe) * 100), 0);
    const totalCent = lista.reduce((s, d) => s + Math.round(Number(d.total) * 100), 0);

    return {
      anio,
      aniosConDatos: aniosConDatos.includes(actual) ? aniosConDatos : [actual, ...aniosConDatos],
      total: (totalCent / 100).toFixed(2),
      diezmo: (sumar((l) => l.tipo === 'diezmo') / 100).toFixed(2),
      ofrendas: (sumar((l) => l.tipo === 'ofrenda') / 100).toFixed(2),
      lista: lista.map((d) => ({
        id: d.id,
        fecha: d.fecha ?? '',
        total: d.total,
        periodicidad: d.periodicidad,
        lineas: lineas
          .filter((l) => l.donativoId === d.id)
          .map((l) => ({ tipo: l.tipo as TipoDonativo, fondo: l.esGeneral ? 'Donde más falte' : l.fondo, importe: l.importe })),
      })),
      mensuales: mensualesFilas.map((m) => ({
        id: m.id,
        total: m.total,
        estado: m.estado,
        dia: m.createdAt ? Number(new Intl.DateTimeFormat('en-CA', { timeZone: ctx.iglesia.timezone, day: 'numeric' }).format(m.createdAt)) : null,
        lineas: m.lineas.map((l) => ({ tipo: l.tipo, fondo: nombresFondo.get(l.fondoId) ?? 'Fondo', importe: l.importe })),
      })),
    };
  });
}
