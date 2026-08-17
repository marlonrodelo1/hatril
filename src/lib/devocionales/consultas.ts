import 'server-only';

import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { dbAdmin } from '@/lib/db';
import { devocionales, iglesias, miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Consultas de devocionales.
 *
 * UN TURNO ES UNA FILA SIN CUERPO
 * -------------------------------
 * No hay tabla de turnos: el pastor crea la fila con fecha y autor, y quien la
 * tiene asignada rellena el contenido. Así «a quién le toca el jueves» y «qué
 * se publicó el jueves» son la misma pregunta, y no hay dos sitios que puedan
 * decir cosas distintas.
 */

export type DevocionalFila = {
  id: string;
  fecha: string;
  titulo: string | null;
  versiculo: string | null;
  referencia: string | null;
  cuerpo: string | null;
  imagenUrl: string | null;
  videoUrl: string | null;
  publicado: boolean;
  autorMiembroId: string | null;
  autorNombre: string | null;
  /** Sin cuerpo es un turno que nadie ha escrito todavía. */
  pendiente: boolean;
};

function aFila(f: {
  id: string;
  fecha: string;
  titulo: string | null;
  versiculo: string | null;
  referencia: string | null;
  cuerpo: string | null;
  imagenUrl: string | null;
  videoUrl: string | null;
  publicado: boolean;
  autorMiembroId: string | null;
  autorNombre: string | null;
  autorApellidos: string | null;
}): DevocionalFila {
  return {
    id: f.id,
    fecha: f.fecha,
    titulo: f.titulo,
    versiculo: f.versiculo,
    referencia: f.referencia,
    cuerpo: f.cuerpo,
    imagenUrl: f.imagenUrl,
    videoUrl: f.videoUrl,
    publicado: f.publicado,
    autorMiembroId: f.autorMiembroId,
    autorNombre: f.autorNombre
      ? [f.autorNombre, f.autorApellidos].filter(Boolean).join(' ')
      : null,
    pendiente: !f.cuerpo?.trim(),
  };
}

const CAMPOS = {
  id: devocionales.id,
  fecha: devocionales.fecha,
  titulo: devocionales.titulo,
  versiculo: devocionales.versiculo,
  referencia: devocionales.referencia,
  cuerpo: devocionales.cuerpo,
  imagenUrl: devocionales.imagenUrl,
  videoUrl: devocionales.videoUrl,
  publicado: devocionales.publicado,
  autorMiembroId: devocionales.autorMiembroId,
  autorNombre: miembros.nombre,
  autorApellidos: miembros.apellidos,
};

/** El calendario: desde hoy hacia delante, y lo reciente hacia atrás. */
export async function listarDevocionales(
  ctx: UserContext,
): Promise<{ proximos: DevocionalFila[]; pasados: DevocionalFila[] }> {
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select(CAMPOS)
      .from(devocionales)
      .leftJoin(miembros, eq(miembros.id, devocionales.autorMiembroId))
      .where(eq(devocionales.iglesiaId, ctx.iglesia.id))
      .orderBy(asc(devocionales.fecha)),
  );

  const todos = filas.map(aFila);

  return {
    proximos: todos.filter((d) => d.fecha >= hoy),
    // Los pasados, del más reciente al más viejo y solo los últimos treinta:
    // esta pantalla sirve para organizar lo que viene, no para navegar el
    // archivo de tres años.
    pasados: todos
      .filter((d) => d.fecha < hoy)
      .reverse()
      .slice(0, 30),
  };
}

/** Los turnos de esta persona que todavía no ha escrito. Para el panel de inicio. */
export async function misTurnosPendientes(
  ctx: UserContext,
): Promise<DevocionalFila[]> {
  // En una const: dentro del `callback` de `withUser`, TypeScript ya no
  // recuerda el `return` de arriba y `ctx.miembroId` vuelve a ser anulable.
  const miembroId = ctx.miembroId;
  if (!miembroId) return [];

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select(CAMPOS)
      .from(devocionales)
      .leftJoin(miembros, eq(miembros.id, devocionales.autorMiembroId))
      .where(
        and(
          eq(devocionales.iglesiaId, ctx.iglesia.id),
          eq(devocionales.autorMiembroId, miembroId),
          gte(devocionales.fecha, hoy),
          // Sin cuerpo: es lo que define «pendiente». Una cadena vacía cuenta
          // igual que null, que es lo que deja un formulario enviado en blanco.
          or(isNull(devocionales.cuerpo), eq(devocionales.cuerpo, '')),
        ),
      )
      .orderBy(asc(devocionales.fecha))
      .limit(5),
  );

  return filas.map(aFila);
}

export async function obtenerDevocional(
  ctx: UserContext,
  id: string,
): Promise<DevocionalFila | null> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select(CAMPOS)
      .from(devocionales)
      .leftJoin(miembros, eq(miembros.id, devocionales.autorMiembroId))
      .where(
        and(
          eq(devocionales.id, id),
          eq(devocionales.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  return filas[0] ? aFila(filas[0]) : null;
}

/**
 * El devocional de hoy para la web pública.
 *
 * Va por `dbAdmin` como el resto de `/i/[slug]`, y por la misma razón: una
 * iglesia puede tener página sin estar en el directorio, y la policy de `anon`
 * no la alcanzaría. El filtro por `web_publica` se hace aquí, explícito.
 *
 * Si hoy no hay, se coge el último publicado: una web con un hueco donde debería
 * ir el devocional parece rota, y el de ayer sigue valiendo.
 */
export async function devocionalPublico(
  iglesiaId: string,
  timezone: string,
): Promise<{
  fecha: string;
  titulo: string | null;
  versiculo: string | null;
  referencia: string | null;
  cuerpo: string;
  imagenUrl: string | null;
  videoUrl: string | null;
  autorNombre: string | null;
  esDeHoy: boolean;
} | null> {
  const hoy = hoyEnLaIglesia(timezone);

  const filas = await dbAdmin
    .select({
      fecha: devocionales.fecha,
      titulo: devocionales.titulo,
      versiculo: devocionales.versiculo,
      referencia: devocionales.referencia,
      cuerpo: devocionales.cuerpo,
      imagenUrl: devocionales.imagenUrl,
      videoUrl: devocionales.videoUrl,
      autorNombre: miembros.nombre,
      autorApellidos: miembros.apellidos,
    })
    .from(devocionales)
    .innerJoin(iglesias, eq(iglesias.id, devocionales.iglesiaId))
    .leftJoin(miembros, eq(miembros.id, devocionales.autorMiembroId))
    .where(
      and(
        eq(devocionales.iglesiaId, iglesiaId),
        eq(devocionales.publicado, true),
        isNotNull(devocionales.cuerpo),
        // Nada del futuro: un devocional programado para el jueves no se enseña
        // el martes aunque esté marcado como publicado.
        lte(devocionales.fecha, hoy),
        eq(iglesias.activa, true),
        eq(iglesias.webPublica, true),
      ),
    )
    .orderBy(desc(devocionales.fecha))
    .limit(1);

  const d = filas[0];
  if (!d?.cuerpo) return null;

  return {
    fecha: d.fecha,
    titulo: d.titulo,
    versiculo: d.versiculo,
    referencia: d.referencia,
    cuerpo: d.cuerpo,
    imagenUrl: d.imagenUrl,
    videoUrl: d.videoUrl,
    autorNombre: d.autorNombre
      ? [d.autorNombre, d.autorApellidos].filter(Boolean).join(' ')
      : null,
    esDeHoy: d.fecha === hoy,
  };
}
