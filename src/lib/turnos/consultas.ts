import 'server-only';

import { and, asc, desc, eq, gte, inArray, lt, lte, ne, or, isNull } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  iglesias,
  miembros,
  ministerios,
  turnoAsignaciones,
  turnos,
  type RespuestaTurno,
} from '@/lib/db/schema';
import type { HorarioSemanal } from '@/lib/db/schema/iglesias';
import type { UserContext } from '@/lib/auth/user-context';
import { cultosEntre, type Culto } from '@/lib/agenda/horarios';

/**
 * Consultas de turnos.
 *
 * Todo por `withUser`, como `asistencia/` y `seguimiento/`: quién sirve qué
 * domingo es práctica religiosa nominal y fechada, y entre la puerta estrecha y
 * `dbAdmin` está la diferencia entre un fallo de pantalla y una brecha. El
 * `eq(iglesiaId)` de cada consulta es el segundo cinturón de siempre.
 *
 * QUIÉN PUEDE PEDIR QUÉ LO DECIDE QUIEN LLAMA
 * -------------------------------------------
 * Igual que en el resto del repo: la RLS aísla iglesias y las pantallas ponen
 * el ámbito. Las funciones de la mitad del equipo (`listarTurnos`,
 * `obtenerTurno`…) las llaman páginas que ya pasaron por el guard del
 * ministerio; las de la mitad del miembro (`misTurnos`, `turnoParaMiembro`) se
 * acotan solas a lo que esa persona puede ver.
 */

export type PersonaEnTurno = {
  asignacionId: string;
  miembroId: string;
  nombre: string;
  puesto: string;
  respuesta: RespuestaTurno;
};

export type TurnoResumen = {
  id: string;
  titulo: string;
  fecha: string;
  /** `HH:MM`, o null si es de todo el día. */
  hora: string | null;
  notas: string | null;
  personas: PersonaEnTurno[];
};

/** `HH:MM:SS` de Postgres a `HH:MM`, que es como se escribe y se compara aquí. */
function horaCorta(hora: string | null): string | null {
  return hora ? hora.slice(0, 5) : null;
}

function nombreCompleto(nombre: string, apellidos: string | null): string {
  return [nombre, apellidos].filter(Boolean).join(' ');
}

/**
 * Los turnos de un equipo, con quién va a cada uno.
 *
 * Dos consultas y no una con JOIN: una fila por turno arriba y las personas
 * debajo, en vez de una fila por persona que luego habría que reagrupar con el
 * turno repetido en cada una. Y sin subconsultas correlacionadas, por lo que
 * cuenta `listarReuniones`: una columna interpolada sale sin cualificar.
 */
export async function listarTurnos(
  ctx: UserContext,
  ministerioId: string,
  opciones: { desde?: string; hasta?: string; orden?: 'asc' | 'desc'; limite?: number },
): Promise<TurnoResumen[]> {
  const { desde, hasta, orden = 'asc', limite = 40 } = opciones;

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: turnos.id,
        titulo: turnos.titulo,
        fecha: turnos.fecha,
        hora: turnos.hora,
        notas: turnos.notas,
      })
      .from(turnos)
      .where(
        and(
          eq(turnos.iglesiaId, ctx.iglesia.id),
          eq(turnos.ministerioId, ministerioId),
          desde ? gte(turnos.fecha, desde) : undefined,
          hasta ? lte(turnos.fecha, hasta) : undefined,
        ),
      )
      .orderBy(
        orden === 'asc' ? asc(turnos.fecha) : desc(turnos.fecha),
        orden === 'asc' ? asc(turnos.hora) : desc(turnos.hora),
      )
      .limit(limite);

    if (filas.length === 0) return [];

    const personas = await tx
      .select({
        turnoId: turnoAsignaciones.turnoId,
        asignacionId: turnoAsignaciones.id,
        miembroId: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        puesto: turnoAsignaciones.puesto,
        respuesta: turnoAsignaciones.respuesta,
      })
      .from(turnoAsignaciones)
      .innerJoin(miembros, eq(miembros.id, turnoAsignaciones.miembroId))
      .where(
        and(
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          inArray(
            turnoAsignaciones.turnoId,
            filas.map((f) => f.id),
          ),
        ),
      )
      .orderBy(asc(miembros.nombre));

    const porTurno = new Map<string, PersonaEnTurno[]>();
    for (const p of personas) {
      const lista = porTurno.get(p.turnoId) ?? [];
      lista.push({
        asignacionId: p.asignacionId,
        miembroId: p.miembroId,
        nombre: nombreCompleto(p.nombre, p.apellidos),
        puesto: p.puesto,
        respuesta: p.respuesta,
      });
      porTurno.set(p.turnoId, lista);
    }

    return filas.map((f) => ({
      id: f.id,
      titulo: f.titulo,
      fecha: f.fecha,
      hora: horaCorta(f.hora),
      notas: f.notas,
      personas: porTurno.get(f.id) ?? [],
    }));
  });
}

/**
 * ¿Es este turno de este ministerio?
 *
 * Es el tercer cinturón de las actions que tocan algo colgado de un turno: el
 * guard comprueba el ministerio de la URL y esto que el turno sea de él. Sin
 * ello, el responsable de jóvenes —que solo lleva lo suyo— cambiaría la lista
 * de canciones de alabanza mandando el uuid de su turno a mano, y ni la RLS
 * (misma iglesia) ni HT124 (canción y turno del mismo equipo, el de alabanza)
 * lo pararían.
 */
export async function turnoEsDelMinisterio(
  ctx: UserContext,
  turnoId: string,
  ministerioId: string,
): Promise<boolean> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: turnos.id })
      .from(turnos)
      .where(
        and(
          eq(turnos.id, turnoId),
          eq(turnos.iglesiaId, ctx.iglesia.id),
          eq(turnos.ministerioId, ministerioId),
        ),
      )
      .limit(1),
  );
  return filas.length > 0;
}

export type TurnoDetalle = TurnoResumen & { ministerioId: string };

/** Un turno con su gente. `null` si no existe o es de otra iglesia. */
export async function obtenerTurno(
  ctx: UserContext,
  turnoId: string,
): Promise<TurnoDetalle | null> {
  const fila = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ ministerioId: turnos.ministerioId, fecha: turnos.fecha })
      .from(turnos)
      .where(and(eq(turnos.id, turnoId), eq(turnos.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );

  const t = fila[0];
  if (!t) return null;

  const [turno] = await listarTurnos(ctx, t.ministerioId, {
    desde: t.fecha,
    hasta: t.fecha,
    limite: 10,
  }).then((lista) => lista.filter((x) => x.id === turnoId));

  return turno ? { ...turno, ministerioId: t.ministerioId } : null;
}

/**
 * El turno anterior del que copiar el cuadrante.
 *
 * Primero uno del mismo día de la semana y a la misma hora —el domingo pasado,
 * para el domingo que viene—, y si no hay, el último que hubiera. Las rotaciones
 * se parecen de una semana a la siguiente del mismo culto, no del culto del
 * jueves al del domingo.
 */
export async function turnoParaCopiar(
  ctx: UserContext,
  turno: { id: string; fecha: string; hora: string | null },
  ministerioId: string,
): Promise<{ id: string; fecha: string; hora: string | null; personas: number } | null> {
  return withUser(ctx.user.id, async (tx) => {
    const candidatos = await tx
      .select({ id: turnos.id, fecha: turnos.fecha, hora: turnos.hora })
      .from(turnos)
      .where(
        and(
          eq(turnos.iglesiaId, ctx.iglesia.id),
          eq(turnos.ministerioId, ministerioId),
          lt(turnos.fecha, turno.fecha),
        ),
      )
      .orderBy(desc(turnos.fecha))
      .limit(12);

    if (candidatos.length === 0) return null;

    const dow = (f: string) => new Date(f + 'T00:00:00Z').getUTCDay();
    const elegido =
      candidatos.find(
        (c) =>
          dow(c.fecha) === dow(turno.fecha) && horaCorta(c.hora) === turno.hora,
      ) ?? candidatos[0]!;

    const gente = await tx
      .select({ miembroId: turnoAsignaciones.miembroId })
      .from(turnoAsignaciones)
      .where(eq(turnoAsignaciones.turnoId, elegido.id));

    // Un turno anterior vacío no sirve para copiar: el botón prometería algo y
    // al pulsarlo no pasaría nada.
    if (gente.length === 0) return null;

    return {
      id: elegido.id,
      fecha: elegido.fecha,
      hora: horaCorta(elegido.hora),
      // Personas y no filas: quien canta y toca la guitarra son dos filas y
      // una persona, y es a personas a quien se va a avisar.
      personas: new Set(gente.map((g) => g.miembroId)).size,
    };
  });
}

/**
 * Quién de esta lista sirve ESE MISMO DÍA en otro equipo, y dónde.
 *
 * Para avisar en el desplegable de asignar: «Pedro — también en Medios». No se
 * impide, porque en una iglesia de cuarenta personas el que toca el bajo es
 * también el que pone las diapositivas, y la base de datos no sabe si le da
 * tiempo a las dos cosas. Lo sabe el responsable, si se lo enseñamos.
 *
 * Mismo día y misma hora, o cualquiera de las dos sin hora: un turno «de todo el
 * día» choca con todo lo de ese día.
 */
export async function otrosTurnosDelDia(
  ctx: UserContext,
  turno: { id: string; fecha: string; hora: string | null },
): Promise<Map<string, string[]>> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        miembroId: turnoAsignaciones.miembroId,
        ministerio: ministerios.nombre,
      })
      .from(turnoAsignaciones)
      .innerJoin(turnos, eq(turnos.id, turnoAsignaciones.turnoId))
      .innerJoin(ministerios, eq(ministerios.id, turnos.ministerioId))
      .where(
        and(
          eq(turnos.iglesiaId, ctx.iglesia.id),
          eq(turnos.fecha, turno.fecha),
          ne(turnos.id, turno.id),
          turno.hora
            ? or(eq(turnos.hora, turno.hora), isNull(turnos.hora))
            : undefined,
        ),
      ),
  );

  const mapa = new Map<string, string[]>();
  for (const f of filas) {
    const lista = mapa.get(f.miembroId) ?? [];
    if (!lista.includes(f.ministerio)) lista.push(f.ministerio);
    mapa.set(f.miembroId, lista);
  }
  return mapa;
}

export type CultoParaPlanificar = Culto & {
  /** Si este equipo ya tiene turno en ese culto, su id. */
  turnoId: string | null;
};

/**
 * Los cultos de las próximas semanas, para elegir en cuáles sirve el equipo.
 *
 * Salen del horario semanal de la iglesia, igual que en la agenda, y se marcan
 * los que ya tienen turno. Se enseñan también esos, en vez de esconderlos: ver el
 * domingo marcado como «ya planificado» contesta la pregunta de por qué no está
 * en la lista, que es lo primero que alguien se pregunta.
 */
export async function cultosParaPlanificar(
  ctx: UserContext,
  ministerioId: string,
  desde: string,
  hasta: string,
): Promise<CultoParaPlanificar[]> {
  const [filaIglesia, existentes] = await withUser(ctx.user.id, (tx) =>
    Promise.all([
      tx
        .select({ horarios: iglesias.horarios })
        .from(iglesias)
        .where(eq(iglesias.id, ctx.iglesia.id))
        .limit(1),
      tx
        .select({ id: turnos.id, fecha: turnos.fecha, hora: turnos.hora })
        .from(turnos)
        .where(
          and(
            eq(turnos.iglesiaId, ctx.iglesia.id),
            eq(turnos.ministerioId, ministerioId),
            gte(turnos.fecha, desde),
            lte(turnos.fecha, hasta),
          ),
        ),
    ]),
  );

  const horarios = (filaIglesia[0]?.horarios ?? []) as HorarioSemanal[];
  const yaHay = new Map(
    existentes.map((t) => [`${t.fecha} ${horaCorta(t.hora) ?? ''}`, t.id]),
  );

  return cultosEntre(horarios, desde, hasta).map((c) => ({
    ...c,
    turnoId: yaHay.get(`${c.fecha} ${c.hora ?? ''}`) ?? null,
  }));
}

// ===========================================================================
// La mitad del miembro
// ===========================================================================

export type MiTurno = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  ministerio: { id: string; nombre: string; colorHex: string };
  /** Los puestos que tiene ESTA persona en ese turno. Casi siempre uno. */
  puestos: string[];
  /**
   * Lo que contestó. Si tiene dos puestos y los dos no coinciden —el
   * responsable le añadió uno después de que confirmara—, manda el que pide
   * atención: un «no puede» en cualquiera, o un pendiente.
   */
  respuesta: RespuestaTurno;
};

function respuestaDeConjunto(respuestas: RespuestaTurno[]): RespuestaTurno {
  if (respuestas.includes('no_puede')) return 'no_puede';
  if (respuestas.every((r) => r === 'confirmado')) return 'confirmado';
  return 'pendiente';
}

/**
 * Los turnos de quien mira, entre dos fechas.
 *
 * Acotado por `miembro_id` de la sesión y nada más: aquí no hace falta pasar
 * por el equipo, porque son sus propias filas. Una cuenta sin ficha no tiene
 * turnos — es el caso de siempre, `ctx.miembroId` es nullable en toda la app.
 */
export async function misTurnos(
  ctx: UserContext,
  desde: string,
  hasta: string,
): Promise<MiTurno[]> {
  if (!ctx.miembroId) return [];
  const miembroId = ctx.miembroId;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: turnos.id,
        titulo: turnos.titulo,
        fecha: turnos.fecha,
        hora: turnos.hora,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
        ministerioColor: ministerios.colorHex,
        puesto: turnoAsignaciones.puesto,
        respuesta: turnoAsignaciones.respuesta,
      })
      .from(turnoAsignaciones)
      .innerJoin(turnos, eq(turnos.id, turnoAsignaciones.turnoId))
      .innerJoin(ministerios, eq(ministerios.id, turnos.ministerioId))
      .where(
        and(
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(turnoAsignaciones.miembroId, miembroId),
          gte(turnos.fecha, desde),
          lte(turnos.fecha, hasta),
        ),
      )
      .orderBy(asc(turnos.fecha), asc(turnos.hora)),
  );

  const porTurno = new Map<string, MiTurno & { respuestas: RespuestaTurno[] }>();
  for (const f of filas) {
    const previo = porTurno.get(f.id);
    if (previo) {
      previo.puestos.push(f.puesto);
      previo.respuestas.push(f.respuesta);
      continue;
    }
    porTurno.set(f.id, {
      id: f.id,
      titulo: f.titulo,
      fecha: f.fecha,
      hora: horaCorta(f.hora),
      ministerio: {
        id: f.ministerioId,
        nombre: f.ministerioNombre,
        colorHex: f.ministerioColor,
      },
      puestos: [f.puesto],
      respuesta: f.respuesta,
      respuestas: [f.respuesta],
    });
  }

  return [...porTurno.values()].map(({ respuestas, ...t }) => ({
    ...t,
    respuesta: respuestaDeConjunto(respuestas),
  }));
}

export type TurnoParaMiembro = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  notas: string | null;
  ministerio: { id: string; nombre: string; colorHex: string };
  /** Quién sirve, por puesto. Sin respuestas ajenas: eso es cosa del responsable. */
  equipo: { puesto: string; nombres: string[] }[];
  /** Lo de quien mira, si está en el turno. */
  mio: { puestos: string[]; respuesta: RespuestaTurno } | null;
};

/**
 * Un turno visto por alguien del equipo.
 *
 * El ámbito es EL EQUIPO de ese ministerio, no la iglesia: quien no sirve en
 * alabanza no tiene por qué ver el cuadrante de alabanza escribiendo un uuid en
 * la barra. Se comprueba con `ctx.ministerioIds`, que sale de la pertenencia
 * real (`ministerio_miembros`) y no de nada que mande el navegador.
 *
 * Lo que NO enseña son las respuestas de los demás. Que Fulano dijo que no
 * puede este domingo es una conversación entre él y quien lleva el equipo.
 */
export async function turnoParaMiembro(
  ctx: UserContext,
  turnoId: string,
): Promise<TurnoParaMiembro | null> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: turnos.id,
        titulo: turnos.titulo,
        fecha: turnos.fecha,
        hora: turnos.hora,
        notas: turnos.notas,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
        ministerioColor: ministerios.colorHex,
      })
      .from(turnos)
      .innerJoin(ministerios, eq(ministerios.id, turnos.ministerioId))
      .where(and(eq(turnos.id, turnoId), eq(turnos.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );

  const t = filas[0];
  if (!t) return null;

  // Fuera del equipo, el turno no existe para esta persona. `null` y no un
  // error: la página responde con un 404, igual que con un uuid inventado, y
  // así no confirma que el turno exista.
  if (!ctx.ministerioIds.includes(t.ministerioId)) return null;

  const gente = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        miembroId: turnoAsignaciones.miembroId,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        puesto: turnoAsignaciones.puesto,
        respuesta: turnoAsignaciones.respuesta,
      })
      .from(turnoAsignaciones)
      .innerJoin(miembros, eq(miembros.id, turnoAsignaciones.miembroId))
      .where(
        and(
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(turnoAsignaciones.turnoId, turnoId),
        ),
      )
      .orderBy(asc(miembros.nombre)),
  );

  const porPuesto = new Map<string, string[]>();
  const misPuestos: string[] = [];
  const misRespuestas: RespuestaTurno[] = [];

  for (const g of gente) {
    const lista = porPuesto.get(g.puesto) ?? [];
    lista.push(nombreCompleto(g.nombre, g.apellidos));
    porPuesto.set(g.puesto, lista);

    if (g.miembroId === ctx.miembroId) {
      misPuestos.push(g.puesto);
      misRespuestas.push(g.respuesta);
    }
  }

  return {
    id: t.id,
    titulo: t.titulo,
    fecha: t.fecha,
    hora: horaCorta(t.hora),
    notas: t.notas,
    ministerio: {
      id: t.ministerioId,
      nombre: t.ministerioNombre,
      colorHex: t.ministerioColor,
    },
    equipo: [...porPuesto.entries()].map(([puesto, nombres]) => ({
      puesto,
      nombres,
    })),
    mio:
      misPuestos.length > 0
        ? { puestos: misPuestos, respuesta: respuestaDeConjunto(misRespuestas) }
        : null,
  };
}
