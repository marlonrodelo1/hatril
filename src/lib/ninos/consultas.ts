import 'server-only';

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import type { UserContext } from '@/lib/auth/user-context';
import { withUser } from '@/lib/db';
import {
  miembros,
  ninoConsentimientos,
  ninoFamilias,
  ninos,
  ninosArchivos,
  ninosCronograma,
  ninosPublicaciones,
  ninosSolicitudes,
  type ParentescoNino,
  type TipoArchivoNino,
} from '@/lib/db/schema';

/**
 * Las lecturas del ministerio de Niños, para el panel.
 *
 * Todas por `withUser()`: la RLS de la `0060` es por relación padre–hijo y por
 * quien lidera el ministerio, y es la que no se equivoca. Las páginas ya pasan
 * por `requireNinos()` (`desdeDentro`), así que aquí quien pregunta es el
 * pastor o quien lleva ESTE ministerio; la base le enseñaría lo mismo aunque la
 * guarda fallara, y a cualquier otro, nada.
 *
 * Cada consulta acota además por iglesia y ministerio en el WHERE. No es
 * desconfianza de la RLS: una cuenta en dos iglesias pasa `es_pastor()` en las
 * dos, y el ministerio de la URL tiene que ser de la iglesia del contexto.
 */

const delMinisterio = <T extends { iglesiaId: AnyPgColumn; ministerioId: AnyPgColumn }>(
  tabla: T,
  ctx: UserContext,
  ministerioId: string,
) => and(eq(tabla.iglesiaId, ctx.iglesia.id), eq(tabla.ministerioId, ministerioId));

// ---------------------------------------------------------------------------
// Familias
// ---------------------------------------------------------------------------

export type SolicitudPendiente = {
  id: string;
  nombre: string;
  anioNacimiento: number;
  parentesco: ParentescoNino;
  permisoImagen: boolean;
  pedidaAt: Date;
  padre: { miembroId: string; nombre: string };
};

/**
 * Las peticiones «tengo un hijo aquí» sin resolver. Solo las ven la
 * responsable y el pastor (`0060`); a un colíder le sale la lista vacía, y la
 * página no se la enseña.
 */
export async function solicitudesPendientes(
  ctx: UserContext,
  ministerioId: string,
): Promise<SolicitudPendiente[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ninosSolicitudes.id,
        nombre: ninosSolicitudes.nombre,
        anioNacimiento: ninosSolicitudes.anioNacimiento,
        parentesco: ninosSolicitudes.parentesco,
        permisoImagen: ninosSolicitudes.permisoImagen,
        pedidaAt: ninosSolicitudes.createdAt,
        padreId: miembros.id,
        padreNombre: miembros.nombre,
        padreApellidos: miembros.apellidos,
      })
      .from(ninosSolicitudes)
      .innerJoin(miembros, eq(miembros.id, ninosSolicitudes.miembroId))
      .where(delMinisterio(ninosSolicitudes, ctx, ministerioId))
      .orderBy(asc(ninosSolicitudes.createdAt)),
  );

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    anioNacimiento: f.anioNacimiento,
    parentesco: f.parentesco,
    permisoImagen: f.permisoImagen,
    pedidaAt: f.pedidaAt,
    padre: {
      miembroId: f.padreId,
      nombre: [f.padreNombre, f.padreApellidos].filter(Boolean).join(' '),
    },
  }));
}

export type FamiliaDeNino = {
  miembroId: string;
  nombre: string;
  parentesco: ParentescoNino;
  aceptadoAt: Date;
  /** Su permiso de fotos, vivo. */
  imagen: boolean;
};

export type NinoConFamilia = {
  id: string;
  nombre: string;
  anioNacimiento: number;
  familias: FamiliaDeNino[];
  /**
   * Puede salir en fotos: TODOS sus padres vinculados tienen el permiso vivo.
   * Si uno lo retira, deja de poder (`plan-ninos.md` §4).
   */
  puedeSalir: boolean;
};

/** Los niños del ministerio con sus familias y si pueden salir en fotos. */
export async function ninosDelMinisterio(
  ctx: UserContext,
  ministerioId: string,
): Promise<NinoConFamilia[]> {
  return withUser(ctx.user.id, async (tx) => {
    const lista = await tx
      .select({ id: ninos.id, nombre: ninos.nombre, anioNacimiento: ninos.anioNacimiento })
      .from(ninos)
      .where(delMinisterio(ninos, ctx, ministerioId))
      .orderBy(asc(ninos.nombre));
    if (lista.length === 0) return [];

    const ids = lista.map((n) => n.id);
    const [familias, imagenes] = await Promise.all([
      tx
        .select({
          ninoId: ninoFamilias.ninoId,
          miembroId: ninoFamilias.miembroId,
          parentesco: ninoFamilias.parentesco,
          aceptadoAt: ninoFamilias.aceptadoAt,
          nombre: miembros.nombre,
          apellidos: miembros.apellidos,
        })
        .from(ninoFamilias)
        .innerJoin(miembros, eq(miembros.id, ninoFamilias.miembroId))
        .where(and(eq(ninoFamilias.iglesiaId, ctx.iglesia.id), inArray(ninoFamilias.ninoId, ids)))
        .orderBy(asc(ninoFamilias.aceptadoAt)),
      tx
        .select({ ninoId: ninoConsentimientos.ninoId, miembroId: ninoConsentimientos.miembroId })
        .from(ninoConsentimientos)
        .where(
          and(
            eq(ninoConsentimientos.iglesiaId, ctx.iglesia.id),
            inArray(ninoConsentimientos.ninoId, ids),
            eq(ninoConsentimientos.tipo, 'imagen'),
            isNull(ninoConsentimientos.revocadoAt),
          ),
        ),
    ]);

    const conImagen = new Set(imagenes.map((i) => `${i.ninoId}:${i.miembroId}`));

    return lista.map((n) => {
      const suyas = familias
        .filter((f) => f.ninoId === n.id)
        .map((f) => ({
          miembroId: f.miembroId,
          nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
          parentesco: f.parentesco,
          aceptadoAt: f.aceptadoAt,
          imagen: conImagen.has(`${n.id}:${f.miembroId}`),
        }));
      return {
        ...n,
        familias: suyas,
        puedeSalir: suyas.length > 0 && suyas.every((f) => f.imagen),
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Cronograma
// ---------------------------------------------------------------------------

export type EntradaCronograma = {
  id: string;
  fecha: string;
  tema: string;
  puntos: string | null;
  maestro: { miembroId: string; nombre: string } | null;
};

/**
 * Las clases desde `desde` (incluida) en adelante, de cerca a lejos. Sin
 * `desde`, todas: es lo que pinta «Anteriores».
 */
export async function cronograma(
  ctx: UserContext,
  ministerioId: string,
  opciones: { desde?: string; hasta?: string } = {},
): Promise<EntradaCronograma[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ninosCronograma.id,
        fecha: ninosCronograma.fecha,
        tema: ninosCronograma.tema,
        puntos: ninosCronograma.puntos,
        maestroId: miembros.id,
        maestroNombre: miembros.nombre,
        maestroApellidos: miembros.apellidos,
      })
      .from(ninosCronograma)
      .leftJoin(miembros, eq(miembros.id, ninosCronograma.maestroMiembroId))
      .where(
        and(
          delMinisterio(ninosCronograma, ctx, ministerioId),
          opciones.desde ? sql`${ninosCronograma.fecha} >= ${opciones.desde}` : undefined,
          opciones.hasta ? sql`${ninosCronograma.fecha} < ${opciones.hasta}` : undefined,
        ),
      )
      .orderBy(
        opciones.desde ? asc(ninosCronograma.fecha) : desc(ninosCronograma.fecha),
        asc(ninosCronograma.createdAt),
      ),
  );

  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    tema: f.tema,
    puntos: f.puntos,
    maestro: f.maestroId
      ? {
          miembroId: f.maestroId,
          nombre: [f.maestroNombre, f.maestroApellidos].filter(Boolean).join(' '),
        }
      : null,
  }));
}

export async function entradaDelCronograma(
  ctx: UserContext,
  ministerioId: string,
  entradaId: string,
): Promise<EntradaCronograma | null> {
  const todas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ninosCronograma.id,
        fecha: ninosCronograma.fecha,
        tema: ninosCronograma.tema,
        puntos: ninosCronograma.puntos,
        maestroMiembroId: ninosCronograma.maestroMiembroId,
      })
      .from(ninosCronograma)
      .where(and(delMinisterio(ninosCronograma, ctx, ministerioId), eq(ninosCronograma.id, entradaId)))
      .limit(1),
  );
  const f = todas[0];
  if (!f) return null;
  return {
    id: f.id,
    fecha: f.fecha,
    tema: f.tema,
    puntos: f.puntos,
    maestro: f.maestroMiembroId ? { miembroId: f.maestroMiembroId, nombre: '' } : null,
  };
}

// ---------------------------------------------------------------------------
// Drive y tablón
// ---------------------------------------------------------------------------

export type ArchivoDelDrive = {
  id: string;
  tipo: TipoArchivoNino;
  ruta: string;
  miniaturaRuta: string | null;
  bytes: number;
  duracionS: number | null;
  fecha: string;
  caducaEl: string | null;
  publicacionId: string | null;
};

const columnasArchivo = {
  id: ninosArchivos.id,
  tipo: ninosArchivos.tipo,
  ruta: ninosArchivos.ruta,
  miniaturaRuta: ninosArchivos.miniaturaRuta,
  bytes: ninosArchivos.bytes,
  duracionS: ninosArchivos.duracionS,
  fecha: ninosArchivos.fecha,
  caducaEl: ninosArchivos.caducaEl,
  publicacionId: ninosArchivos.publicacionId,
};

/** Lo confirmado del drive, lo último primero. Lo sin confirmar no existe aún. */
export async function archivosDelDrive(
  ctx: UserContext,
  ministerioId: string,
  opciones: { fecha?: string } = {},
): Promise<ArchivoDelDrive[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select(columnasArchivo)
      .from(ninosArchivos)
      .where(
        and(
          delMinisterio(ninosArchivos, ctx, ministerioId),
          isNotNull(ninosArchivos.confirmadoAt),
          opciones.fecha ? eq(ninosArchivos.fecha, opciones.fecha) : undefined,
        ),
      )
      .orderBy(desc(ninosArchivos.fecha), desc(ninosArchivos.createdAt)),
  );
}

export type PublicacionDelTablon = {
  id: string;
  fecha: string;
  texto: string;
  publicadaAt: Date | null;
  caducaEl: string | null;
  autorMiembroId: string | null;
  archivos: ArchivoDelDrive[];
};

/** El tablón entero del ministerio, borradores incluidos, lo último arriba. */
export async function publicacionesDelTablon(
  ctx: UserContext,
  ministerioId: string,
): Promise<PublicacionDelTablon[]> {
  return withUser(ctx.user.id, async (tx) => {
    const pubs = await tx
      .select({
        id: ninosPublicaciones.id,
        fecha: ninosPublicaciones.fecha,
        texto: ninosPublicaciones.texto,
        publicadaAt: ninosPublicaciones.publicadaAt,
        caducaEl: ninosPublicaciones.caducaEl,
        autorMiembroId: ninosPublicaciones.autorMiembroId,
      })
      .from(ninosPublicaciones)
      .where(delMinisterio(ninosPublicaciones, ctx, ministerioId))
      .orderBy(desc(ninosPublicaciones.fecha), desc(ninosPublicaciones.createdAt));
    if (pubs.length === 0) return [];

    const archivos = await tx
      .select(columnasArchivo)
      .from(ninosArchivos)
      .where(
        and(
          delMinisterio(ninosArchivos, ctx, ministerioId),
          isNotNull(ninosArchivos.confirmadoAt),
          inArray(
            ninosArchivos.publicacionId,
            pubs.map((p) => p.id),
          ),
        ),
      )
      .orderBy(asc(ninosArchivos.createdAt));

    return pubs.map((p) => ({ ...p, archivos: archivos.filter((a) => a.publicacionId === p.id) }));
  });
}

export async function publicacionDelTablon(
  ctx: UserContext,
  ministerioId: string,
  publicacionId: string,
): Promise<PublicacionDelTablon | null> {
  const todas = await publicacionesDelTablon(ctx, ministerioId);
  return todas.find((p) => p.id === publicacionId) ?? null;
}
