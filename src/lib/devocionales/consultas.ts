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

/**
 * El devocional de hoy para alguien que ya está dentro de la iglesia.
 *
 * Gemelo de `devocionalPublico()` y separado a propósito. Aquél va por `dbAdmin`
 * y exige `web_publica = true`, porque sirve la página de la calle. Este va por
 * `withUser` y NO mira esa bandera: una congregación puede tener el devocional
 * al día y su web sin publicar, y a su gente no se le esconde por eso.
 *
 * Si hoy no hay, devuelve el último publicado, igual que el público: una
 * pantalla con un hueco donde debería ir el devocional parece rota, y el de ayer
 * sigue valiendo. `esDeHoy` deja que la pantalla lo diga.
 */
export async function devocionalDeHoy(ctx: UserContext): Promise<{
  fecha: string;
  titulo: string | null;
  versiculo: string | null;
  referencia: string | null;
  cuerpo: string;
  imagenUrl: string | null;
  videoUrl: string | null;
  esDeHoy: boolean;
} | null> {
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        fecha: devocionales.fecha,
        titulo: devocionales.titulo,
        versiculo: devocionales.versiculo,
        referencia: devocionales.referencia,
        cuerpo: devocionales.cuerpo,
        imagenUrl: devocionales.imagenUrl,
        videoUrl: devocionales.videoUrl,
      })
      .from(devocionales)
      .where(
        and(
          eq(devocionales.iglesiaId, ctx.iglesia.id),
          eq(devocionales.publicado, true),
          lte(devocionales.fecha, hoy),
          // Una fila sin cuerpo NO es un devocional: es un turno asignado y sin
          // escribir. En este módulo el turno ES la fila, así que sin este
          // filtro la pantalla enseñaría un hueco con fecha.
          isNotNull(devocionales.cuerpo),
        ),
      )
      .orderBy(desc(devocionales.fecha))
      .limit(1);

    const d = filas[0];
    if (!d) return null;

    return { ...d, cuerpo: d.cuerpo!, esDeHoy: d.fecha === hoy };
  });
}

/**
 * El versículo del día.
 *
 * POR QUÉ NO ES UNA TABLA NUEVA
 * -----------------------------
 * Porque `devocionales` ya tiene `versiculo` y `referencia` desde la `0012`, y
 * porque un turno YA es una fila que puede estar a medio llenar: el propio
 * schema dice que una fila sin cuerpo es un turno pendiente. Una iglesia que
 * solo quiera publicar el versículo crea la fila del día, escribe esos dos
 * campos y la publica. Una tabla aparte habría duplicado el calendario, los
 * permisos y la pantalla del panel para guardar dos columnas.
 *
 * Y ES UNA CONSULTA APARTE, NO UN CAMPO DE `devocionalDeHoy()`
 * ------------------------------------------------------------
 * Aquella exige `cuerpo is not null` a propósito —sin eso enseñaría el hueco de
 * un turno sin escribir—, así que un versículo suelto NUNCA saldría por ahí. Y
 * son dos cosas independientes: la mayoría de los días habrá versículo sin
 * devocional, que es justo lo que se pidió.
 *
 * CAE AL ÚLTIMO, IGUAL QUE EL DEVOCIONAL
 * --------------------------------------
 * Si hoy no hay, se enseña el último publicado. Un hueco donde debería ir el
 * versículo parece una pantalla rota, y el de ayer sigue valiendo. `esDeHoy`
 * deja que la pantalla decida cómo titularlo: llamar «de hoy» a uno de hace
 * tres días es la clase de mentira pequeña que este repo ya ha pagado cara.
 */
export async function versiculoDelDia(ctx: UserContext): Promise<{
  versiculo: string;
  referencia: string | null;
  /**
   * La foto de ese devocional, que la pantalla usa de fondo tras el glaseado.
   * Va aquí y no en una consulta aparte porque es la misma fila: pedirla dos
   * veces sería un viaje de más para una columna que ya viene en el camino.
   */
  imagenUrl: string | null;
  fecha: string;
  esDeHoy: boolean;
} | null> {
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        versiculo: devocionales.versiculo,
        referencia: devocionales.referencia,
        imagenUrl: devocionales.imagenUrl,
        fecha: devocionales.fecha,
      })
      .from(devocionales)
      .where(
        and(
          eq(devocionales.iglesiaId, ctx.iglesia.id),
          eq(devocionales.publicado, true),
          lte(devocionales.fecha, hoy),
          isNotNull(devocionales.versiculo),
        ),
      )
      .orderBy(desc(devocionales.fecha))
      .limit(1);

    const v = filas[0];
    // El `<> ''` no lo puede hacer la consulta sin ensuciarla: hay filas con la
    // cadena vacía —el formulario guarda '' cuando se deja el campo en blanco—
    // y `is not null` no las descarta.
    if (!v?.versiculo?.trim()) return null;

    return {
      versiculo: v.versiculo.trim(),
      referencia: v.referencia?.trim() || null,
      imagenUrl: v.imagenUrl,
      fecha: v.fecha,
      esDeHoy: v.fecha === hoy,
    };
  });
}
