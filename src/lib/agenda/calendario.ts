import 'server-only';

import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

import { withUser, dbAdmin } from '@/lib/db';
import { eventos, iglesias, ministerios, reuniones } from '@/lib/db/schema';
import type { HorarioSemanal } from '@/lib/db/schema/iglesias';
import type { UserContext } from '@/lib/auth/user-context';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { misTurnos } from '@/lib/turnos/consultas';
import { ETIQUETA_RESPUESTA } from '@/lib/turnos/respuestas';
import { comoFecha, cultosEntre, sumarDias } from './horarios';

/**
 * Todo lo que le pasa a una congregación, día a día.
 *
 * TRES FUENTES QUE NO SE PARECEN EN NADA
 * --------------------------------------
 * Y ese es el trabajo de este módulo: dejarlas en una sola lista de días.
 *
 *   1. **Los horarios semanales** (`iglesias.horarios`, un jsonb): el culto del
 *      domingo, la oración del miércoles. NO son filas con fecha — son reglas
 *      que se repiten, así que hay que generar sus ocurrencias para el trozo de
 *      calendario que se esté mirando.
 *   2. **Los eventos** (`eventos`): fecha y hora concretas, y a veces un fin
 *      varios días después. Un retiro de viernes a domingo tiene que aparecer en
 *      los tres días, no solo en el primero.
 *   3. **Las reuniones de ministerio** (`reuniones`): fecha concreta, y solo las
 *      de los equipos donde sirve quien mira.
 *   4. **Sus turnos** (`turnos`): los cultos en los que le toca servir, con su
 *      puesto. El culto sale además por el horario, y es a propósito: uno dice
 *      que hay culto y el otro que esa persona va a estar en la puerta.
 *
 * POR QUÉ SE GENERAN LAS REPETICIONES Y NO SE GUARDAN
 * ---------------------------------------------------
 * Un culto semanal son 52 filas al año por iglesia que nadie edita nunca. Al
 * generarlas aquí, cambiar el horario del domingo es cambiar UNA línea del
 * jsonb; con filas guardadas habría que reescribir el futuro y decidir qué pasa
 * con el pasado. El precio es que un culto suelto no se puede cancelar, y eso ya
 * está resuelto donde toca: si un domingo no hay culto, la iglesia lo dice en el
 * muro.
 */

export type TipoDeDia = 'culto' | 'evento' | 'ministerio' | 'turno';

export type Ocurrencia = {
  /** `YYYY-MM-DD` en la zona de la iglesia. */
  fecha: string;
  /** `HH:MM`, o null para un evento de todo el día. */
  hora: string | null;
  titulo: string;
  detalle: string | null;
  tipo: TipoDeDia;
  /** Solo los de ministerio, para pintar su punto de color. */
  color?: string;
  /** A dónde lleva al tocarlo, si lleva a algún sitio. */
  enlace?: string;
};

/*
 * Los días de la semana, `comoFecha` y `sumarDias` viven ahora en
 * `horarios.ts`: los turnos necesitan la misma expansión del horario semanal,
 * y dos copias de «qué día cae el culto del miércoles» acaban discrepando. Se
 * reexportan aquí porque las pantallas de la agenda ya los importaban de este
 * fichero.
 */
export { comoFecha, sumarDias };

/**
 * Todo lo que hay entre dos fechas, ordenado por día y hora.
 *
 * `desde` y `hasta` van en `YYYY-MM-DD` e incluyen los dos extremos. Quien
 * llama decide el trozo: un día, una semana o un mes entero con sus arrastres.
 */
export async function agendaEntre(
  ctx: UserContext,
  desde: string,
  hasta: string,
  ministerioIds: string[],
): Promise<Ocurrencia[]> {
  const [filasEventos, filasReuniones, filasIglesia, filasTurnos] = await Promise.all([
    /*
     * Por `dbAdmin` y no `withUser`, igual que `eventosPublicos`: un evento
     * publicado es información abierta —sale en la web de la calle— y la
     * consulta ya filtra por la iglesia de quien mira. Los borradores del equipo
     * no salen: `publicado = true`.
     */
    dbAdmin
      .select({
        id: eventos.id,
        titulo: eventos.titulo,
        inicioEn: eventos.inicioEn,
        finEn: eventos.finEn,
        lugar: eventos.lugar,
      })
      .from(eventos)
      .where(
        and(
          eq(eventos.iglesiaId, ctx.iglesia.id),
          eq(eventos.publicado, true),
          // Un evento entra si TOCA el rango, no si empieza dentro: un retiro
          // que arrancó el 30 de mayo sigue estando el 1 de junio.
          lte(eventos.inicioEn, new Date(hasta + 'T23:59:59Z')),
          gte(
            // `coalesce` porque `fin_en` es opcional: sin fin, dura lo que dura
            // su día.
            eventos.finEn ?? eventos.inicioEn,
            new Date(desde + 'T00:00:00Z'),
          ),
        ),
      )
      .orderBy(asc(eventos.inicioEn)),

    ministerioIds.length === 0
      ? Promise.resolve([])
      : withUser(ctx.user.id, (tx) =>
          tx
            .select({
              id: reuniones.id,
              titulo: reuniones.titulo,
              fecha: reuniones.fecha,
              hora: reuniones.hora,
              lugar: reuniones.lugar,
              ministerioId: ministerios.id,
              ministerioNombre: ministerios.nombre,
              ministerioColor: ministerios.colorHex,
            })
            .from(reuniones)
            .innerJoin(ministerios, eq(ministerios.id, reuniones.ministerioId))
            .where(
              and(
                eq(reuniones.iglesiaId, ctx.iglesia.id),
                inArray(reuniones.ministerioId, ministerioIds),
                gte(reuniones.fecha, desde),
                lte(reuniones.fecha, hasta),
              ),
            )
            .orderBy(asc(reuniones.fecha), asc(reuniones.hora)),
        ),

    withUser(ctx.user.id, (tx) =>
      tx
        .select({ horarios: iglesias.horarios })
        .from(iglesias)
        .where(eq(iglesias.id, ctx.iglesia.id))
        .limit(1),
    ),

    misTurnos(ctx, desde, hasta),
  ]);

  const salida: Ocurrencia[] = [];

  /*
   * Los horarios NO viajan en el contexto de usuario, así que se piden aquí.
   * Es la misma decisión que con la foto de perfil: son un jsonb que solo
   * necesitan esta pantalla y la web pública, y el contexto lo lee cada una de
   * las cuarenta pantallas del producto.
   */
  const horarios = (filasIglesia[0]?.horarios ?? []) as HorarioSemanal[];
  for (const c of cultosEntre(horarios, desde, hasta)) {
    salida.push({
      fecha: c.fecha,
      hora: c.hora,
      titulo: c.titulo,
      detalle: c.detalle,
      tipo: 'culto',
    });
  }

  // --- Los eventos, repartidos por los días que ocupan ---
  for (const e of filasEventos) {
    const primero = comoFecha(e.inicioEn);
    const ultimo = comoFecha(e.finEn ?? e.inicioEn);

    for (
      let f = primero < desde ? desde : primero;
      f <= (ultimo > hasta ? hasta : ultimo);
      f = sumarDias(f, 1)
    ) {
      salida.push({
        fecha: f,
        // La hora solo el primer día: en el segundo día de un retiro, «19:00»
        // sería mentira.
        hora: f === primero ? horaDe(e.inicioEn) : null,
        titulo: e.titulo,
        detalle: e.lugar,
        tipo: 'evento',
        enlace: `/i/${ctx.iglesia.slug}/eventos/${e.id}`,
      });
    }
  }

  // --- Las reuniones de mis ministerios ---
  for (const r of filasReuniones) {
    salida.push({
      fecha: r.fecha,
      hora: r.hora ? r.hora.slice(0, 5) : null,
      titulo: r.titulo ?? r.ministerioNombre,
      detalle: r.lugar ?? r.ministerioNombre,
      tipo: 'ministerio',
      color: colorDeMinisterio(r.ministerioColor).claro,
      enlace: `/mi/agenda`,
    });
  }

  // --- Mis turnos: el equipo y el puesto delante, el estado detrás ---
  for (const t of filasTurnos) {
    salida.push({
      fecha: t.fecha,
      hora: t.hora,
      titulo: `${t.ministerio.nombre} · ${t.puestos.join(', ')}`,
      detalle: `${t.titulo} · ${ETIQUETA_RESPUESTA[t.respuesta].miembro}`,
      tipo: 'turno',
      color: colorDeMinisterio(t.ministerio.colorHex).claro,
      enlace: `/mi/agenda/turno/${t.id}`,
    });
  }

  return salida.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'),
  );
}

/** La hora de un instante, en la zona en que se guardó. */
function horaDe(d: Date): string {
  return [
    String(d.getUTCHours()).padStart(2, '0'),
    String(d.getUTCMinutes()).padStart(2, '0'),
  ].join(':');
}

/** Agrupa por día, que es como lo pinta el calendario. */
export function porDia(lista: Ocurrencia[]): Map<string, Ocurrencia[]> {
  const mapa = new Map<string, Ocurrencia[]>();
  for (const o of lista) {
    const dia = mapa.get(o.fecha);
    if (dia) dia.push(o);
    else mapa.set(o.fecha, [o]);
  }
  return mapa;
}
