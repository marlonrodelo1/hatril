import 'server-only';

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';

import type { UserContext } from '@/lib/auth/user-context';
import { withUser } from '@/lib/db';
import {
  ministerios,
  ninoConsentimientos,
  ninoFamilias,
  ninos,
  ninosArchivos,
  ninosPublicaciones,
  ninosSolicitudes,
  type ParentescoNino,
  type TipoArchivoNino,
} from '@/lib/db/schema';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { firmarLectura } from './almacen';

/**
 * Lo que ve una familia de sus hijos en el ministerio de Niños («Mis hijos»,
 * en la app).
 *
 * Todo por `withUser()`, y filtrando SIEMPRE por la ficha de quien pregunta
 * (`ctx.miembroId`), aunque la RLS ya lo haga. No es desconfianza: la misma
 * persona puede ser madre en Niños y maestra o pastora, y entonces la RLS le
 * enseña TODOS los niños del ministerio. «Mis hijos» son los suyos, y el
 * tablón de la familia, lo publicado desde que la aceptaron: lo que vería
 * cualquier otra madre.
 */

export type MinisterioConTablon = { id: string; nombre: string };

export type MiHijo = {
  id: string;
  nombre: string;
  anioNacimiento: number;
  ministerio: MinisterioConTablon;
  parentesco: ParentescoNino;
  aceptadoAt: Date;
  /** Mi permiso de fotos, vivo. El de los demás padres no es cosa mía. */
  fotos: boolean;
};

export type MiSolicitud = {
  id: string;
  nombre: string;
  anioNacimiento: number;
  parentesco: ParentescoNino;
  permisoImagen: boolean;
  pedidaAt: Date;
  ministerio: MinisterioConTablon;
};

export type DatosDeMisHijos = {
  iglesia: string;
  /** Sin ficha en la iglesia no se puede pedir nada: no hay a quién vincular. */
  tieneFicha: boolean;
  ministerios: MinisterioConTablon[];
  hijos: MiHijo[];
  solicitudes: MiSolicitud[];
};

/** Los ministerios de la iglesia con el tablón de familias encendido. */
export async function ministeriosConTablon(ctx: UserContext): Promise<MinisterioConTablon[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: ministerios.id, nombre: ministerios.nombre, modulos: ministerios.modulos })
      .from(ministerios)
      .where(and(eq(ministerios.iglesiaId, ctx.iglesia.id), eq(ministerios.activo, true)))
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre)),
  );
  return filas.filter((m) => tieneModulo(m.modulos, 'ninos')).map(({ id, nombre }) => ({ id, nombre }));
}

export async function datosDeMisHijos(ctx: UserContext): Promise<DatosDeMisHijos> {
  const conTablon = await ministeriosConTablon(ctx);
  const yo = ctx.miembroId;
  const base = { iglesia: ctx.iglesia.nombre, tieneFicha: Boolean(yo), ministerios: conTablon };
  if (!yo) return { ...base, hijos: [], solicitudes: [] };

  return withUser(ctx.user.id, async (tx) => {
    const [vinculos, imagenes, pedidas] = await Promise.all([
      tx
        .select({
          id: ninos.id,
          nombre: ninos.nombre,
          anioNacimiento: ninos.anioNacimiento,
          ministerioId: ministerios.id,
          ministerioNombre: ministerios.nombre,
          parentesco: ninoFamilias.parentesco,
          aceptadoAt: ninoFamilias.aceptadoAt,
        })
        .from(ninoFamilias)
        .innerJoin(ninos, eq(ninos.id, ninoFamilias.ninoId))
        .innerJoin(ministerios, eq(ministerios.id, ninoFamilias.ministerioId))
        .where(and(eq(ninoFamilias.iglesiaId, ctx.iglesia.id), eq(ninoFamilias.miembroId, yo)))
        .orderBy(asc(ninos.nombre)),
      tx
        .select({ ninoId: ninoConsentimientos.ninoId })
        .from(ninoConsentimientos)
        .where(
          and(
            eq(ninoConsentimientos.iglesiaId, ctx.iglesia.id),
            eq(ninoConsentimientos.miembroId, yo),
            eq(ninoConsentimientos.tipo, 'imagen'),
            isNull(ninoConsentimientos.revocadoAt),
          ),
        ),
      tx
        .select({
          id: ninosSolicitudes.id,
          nombre: ninosSolicitudes.nombre,
          anioNacimiento: ninosSolicitudes.anioNacimiento,
          parentesco: ninosSolicitudes.parentesco,
          permisoImagen: ninosSolicitudes.permisoImagen,
          pedidaAt: ninosSolicitudes.createdAt,
          ministerioId: ministerios.id,
          ministerioNombre: ministerios.nombre,
        })
        .from(ninosSolicitudes)
        .innerJoin(ministerios, eq(ministerios.id, ninosSolicitudes.ministerioId))
        .where(and(eq(ninosSolicitudes.iglesiaId, ctx.iglesia.id), eq(ninosSolicitudes.miembroId, yo)))
        .orderBy(asc(ninosSolicitudes.createdAt)),
    ]);

    const conFotos = new Set(imagenes.map((i) => i.ninoId));
    return {
      ...base,
      hijos: vinculos.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        anioNacimiento: v.anioNacimiento,
        ministerio: { id: v.ministerioId, nombre: v.ministerioNombre },
        parentesco: v.parentesco,
        aceptadoAt: v.aceptadoAt,
        fotos: conFotos.has(v.id),
      })),
      solicitudes: pedidas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        anioNacimiento: p.anioNacimiento,
        parentesco: p.parentesco,
        permisoImagen: p.permisoImagen,
        pedidaAt: p.pedidaAt,
        ministerio: { id: p.ministerioId, nombre: p.ministerioNombre },
      })),
    };
  });
}

export type ArchivoParaFamilia = {
  id: string;
  tipo: TipoArchivoNino;
  duracionS: number | null;
  /** La miniatura, para la cuadrícula. */
  miniatura: string | null;
  /** La foto de 1.600 px o el vídeo, al tocar. */
  original: string | null;
};

export type PublicacionParaFamilia = {
  id: string;
  fecha: string;
  texto: string;
  ministerio: string;
  archivos: ArchivoParaFamilia[];
};

/**
 * El tablón de la familia: lo publicado en los ministerios de sus hijos desde
 * el día en que la aceptaron, con las URL firmadas de diez minutos.
 *
 * El «desde» se calcula aquí por ministerio, con la zona de la iglesia, igual
 * que `familia_desde()` en la base (`0060`): a quien también lidera, la RLS le
 * abriría los borradores y lo anterior, y este tablón es el de una familia.
 */
export async function tablonDeLaFamilia(ctx: UserContext): Promise<PublicacionParaFamilia[]> {
  const yo = ctx.miembroId;
  if (!yo) return [];

  // Solo de los ministerios con el tablón encendido. Apagarlo es retirarlo
  // (`ministerios/actions.ts`), y hasta el 23-nov las familias seguían viendo
  // lo publicado, con sus fotos, entrando desde un aviso viejo: la app ya les
  // escondía «Mis hijos», pero esta lista no miraba el módulo.
  const conTablon = new Set((await ministeriosConTablon(ctx)).map((m) => m.id));
  if (conTablon.size === 0) return [];

  const { pubs, archivos } = await withUser(ctx.user.id, async (tx) => {
    const desdes = (
      await tx
        .select({
          ministerioId: ninoFamilias.ministerioId,
          desde: sql<string>`min((${ninoFamilias.aceptadoAt} at time zone ${ctx.iglesia.timezone})::date)::text`,
        })
        .from(ninoFamilias)
        .where(and(eq(ninoFamilias.iglesiaId, ctx.iglesia.id), eq(ninoFamilias.miembroId, yo)))
        .groupBy(ninoFamilias.ministerioId)
    ).filter((d) => conTablon.has(d.ministerioId));
    if (desdes.length === 0) return { pubs: [], archivos: [] };

    const pubs = await tx
      .select({
        id: ninosPublicaciones.id,
        fecha: ninosPublicaciones.fecha,
        texto: ninosPublicaciones.texto,
        ministerio: ministerios.nombre,
      })
      .from(ninosPublicaciones)
      .innerJoin(ministerios, eq(ministerios.id, ninosPublicaciones.ministerioId))
      .where(
        and(
          eq(ninosPublicaciones.iglesiaId, ctx.iglesia.id),
          isNotNull(ninosPublicaciones.publicadaAt),
          or(
            ...desdes.map((d) =>
              and(eq(ninosPublicaciones.ministerioId, d.ministerioId), gte(ninosPublicaciones.fecha, d.desde)),
            ),
          ),
        ),
      )
      .orderBy(desc(ninosPublicaciones.fecha), desc(ninosPublicaciones.publicadaAt))
      .limit(60);
    if (pubs.length === 0) return { pubs, archivos: [] };

    const archivos = await tx
      .select({
        id: ninosArchivos.id,
        tipo: ninosArchivos.tipo,
        ruta: ninosArchivos.ruta,
        miniaturaRuta: ninosArchivos.miniaturaRuta,
        duracionS: ninosArchivos.duracionS,
        publicacionId: ninosArchivos.publicacionId,
      })
      .from(ninosArchivos)
      .where(
        and(
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          isNotNull(ninosArchivos.confirmadoAt),
          inArray(
            ninosArchivos.publicacionId,
            pubs.map((p) => p.id),
          ),
        ),
      )
      .orderBy(asc(ninosArchivos.createdAt));
    return { pubs, archivos };
  });

  // Se firma DESPUÉS de la consulta por `withUser()`: lo que no ha salido de
  // ella, no se firma.
  const [miniaturas, fotos, videos] = await Promise.all([
    firmarLectura('miniatura', archivos.map((a) => a.miniaturaRuta ?? '')),
    firmarLectura('foto', archivos.filter((a) => a.tipo === 'foto').map((a) => a.ruta)),
    firmarLectura('video', archivos.filter((a) => a.tipo === 'video').map((a) => a.ruta)),
  ]);

  return pubs.map((p) => ({
    ...p,
    archivos: archivos
      .filter((a) => a.publicacionId === p.id)
      .map((a) => ({
        id: a.id,
        tipo: a.tipo,
        duracionS: a.duracionS,
        miniatura: (a.miniaturaRuta && miniaturas.get(a.miniaturaRuta)) || null,
        original: (a.tipo === 'foto' ? fotos.get(a.ruta) : videos.get(a.ruta)) ?? null,
      })),
  }));
}
