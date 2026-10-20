import 'server-only';

import { and, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

import { withUser } from '@/lib/db';
import { ministerios, reuniones } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { sumarDias } from './horarios';

/**
 * Las reuniones de un equipo vistas desde el turno y desde la agenda del
 * músico.
 *
 * EL ENSAYO SE DERIVA, NO SE GUARDA
 * ---------------------------------
 * No hay una columna `turno.ensayo_id` ni una tabla que los cosa. El ensayo de
 * un domingo es la reunión del mismo equipo más cercana ANTES del turno, dentro
 * de la semana anterior. Coserlos a mano obligaría al responsable a enlazar
 * cada ensayo con su culto, y el día que se le olvidara el músico no vería
 * nada; derivarlo acierta en el caso normal —ensayo el jueves, culto el
 * domingo— sin que nadie haga nada.
 *
 * El precio es que no acierta en los raros: dos cultos en la misma semana con
 * un solo ensayo enseñan los dos el mismo ensayo, que en realidad suele ser
 * verdad.
 *
 * QUIÉN PUEDE PEDIR QUÉ LO DECIDE QUIEN LLAMA
 * -------------------------------------------
 * Como en `turnos/consultas.ts`. `ensayoAntesDelTurno` la llaman la ficha del
 * turno del panel, detrás del guard del ministerio, y la del miembro, después
 * de que `turnoParaMiembro` comprobara que es de su equipo.
 * `reunionParaMiembro` se acota sola, igual que `turnoParaMiembro`.
 *
 * LAS NOTAS, SOLO LAS QUE SE ESCRIBIERON PARA EL EQUIPO
 * -----------------------------------------------------
 * Hasta esta pantalla, las notas de una reunión de equipo solo las leía quien
 * lo lleva, desde el panel, y el formulario invitaba a escribir un acta («cómo
 * fue el encuentro»). Ahora las lee todo el equipo, y el formulario lo dice.
 * Pero lo ya escrito se escribió para otro público, así que al voluntario se le
 * enseñan con dos condiciones (`notasParaElEquipo`):
 *
 *   - **De hoy en adelante.** Es lo que necesita quien va a ir —«traed los
 *     in-ear»— y deja fuera las actas de reuniones pasadas.
 *   - **Con la agenda encendida.** Apagada, el responsable no puede corregirlas
 *     ni borrarlas, porque su pantalla da 404: lo que nadie puede quitar no se
 *     enseña.
 */

/**
 * Cuántos días antes del turno se busca el ensayo.
 *
 * El día de hace una semana solo cuenta si la reunión fue DESPUÉS de la hora
 * del turno: el ensayo del domingo pasado a las 9:30 era para el culto de las
 * 11:00 de ese domingo, no para el de este.
 */
export const DIAS_ANTES_DEL_TURNO = 7;

export type ReunionDelEquipo = {
  id: string;
  titulo: string;
  fecha: string;
  /** `HH:MM`, o null si no tiene hora. */
  hora: string | null;
  lugar: string | null;
  notas: string | null;
};

const COLUMNAS = {
  id: reuniones.id,
  titulo: reuniones.titulo,
  fecha: reuniones.fecha,
  hora: reuniones.hora,
  lugar: reuniones.lugar,
  notas: reuniones.notas,
};

/** `HH:MM:SS` de Postgres a `HH:MM`, como en el resto de la agenda. */
function horaCorta(hora: string | null): string | null {
  return hora ? hora.slice(0, 5) : null;
}

/** Las notas que puede leer el equipo, o null. Ver la cabecera. */
function notasParaElEquipo(
  ctx: UserContext,
  reunion: { fecha: string; notas: string | null },
  modulos: unknown,
): string | null {
  if (!reunion.notas) return null;
  if (!tieneModulo(modulos, 'agenda')) return null;
  return reunion.fecha >= hoyEnLaIglesia(ctx.iglesia.timezone) ? reunion.notas : null;
}

/**
 * El ensayo de un turno: la reunión del mismo equipo más cercana antes de él.
 *
 * El mismo día solo cuenta si se sabe que va antes, es decir, si los dos tienen
 * hora y la de la reunión es anterior. La prueba de sonido de las 9:30 para el
 * culto de las 11:00 es un ensayo; una reunión sin hora el mismo domingo puede
 * ser la evaluación de después, y llamarla «ensayo» sería inventárselo.
 */
export async function ensayoAntesDelTurno(
  ctx: UserContext,
  turno: { ministerioId: string; fecha: string; hora: string | null },
): Promise<ReunionDelEquipo | null> {
  const desde = sumarDias(turno.fecha, -DIAS_ANTES_DEL_TURNO);

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ ...COLUMNAS, modulos: ministerios.modulos })
      .from(reuniones)
      .innerJoin(ministerios, eq(ministerios.id, reuniones.ministerioId))
      .where(
        and(
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          eq(reuniones.ministerioId, turno.ministerioId),
          gte(reuniones.fecha, desde),
          lte(reuniones.fecha, turno.fecha),
        ),
      )
      // Una semana de agenda de UN equipo son dos o tres filas. El tope es por
      // si alguien apunta treinta cosas en una semana, no por rendimiento.
      .limit(20),
  );

  // Los dos extremos de la ventana solo cuentan si se sabe de qué lado caen:
  // el mismo día, si va antes del turno; hace una semana, si fue después.
  const conHoras = (r: { hora: string | null }) => turno.hora !== null && r.hora !== null;

  const antes = filas
    .map((r) => ({ ...r, hora: horaCorta(r.hora) }))
    .filter((r) =>
      r.fecha === turno.fecha
        ? conHoras(r) && r.hora! < turno.hora!
        : r.fecha === desde
          ? conHoras(r) && r.hora! > turno.hora!
          : true,
    )
    // La más cercana primero: el día más tardío y, dentro del día, la hora más
    // tardía. Sin hora cuenta como la primera del día, que es lo prudente.
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) || (b.hora ?? '').localeCompare(a.hora ?? ''),
    );

  const ensayo = antes[0];
  if (!ensayo) return null;

  const { modulos, ...resto } = ensayo;
  // El panel no pinta las notas y el músico solo las que le tocan: aplicar la
  // regla aquí para todos deja un solo sitio donde mirarla.
  return { ...resto, notas: notasParaElEquipo(ctx, ensayo, modulos) };
}

export type ReunionParaMiembro = ReunionDelEquipo & {
  ministerio: { id: string; nombre: string; colorHex: string };
};

/**
 * Una reunión de equipo vista por alguien del equipo: el ensayo con su lugar y
 * sus notas, que es lo que el músico necesita y no le llegaba.
 *
 * El ámbito es EL EQUIPO, igual que `turnoParaMiembro`: quien no está en
 * alabanza no ve las notas del ensayo de alabanza escribiendo el uuid en la
 * barra. Las reuniones de la congregación (`ministerio_id` nulo) tampoco salen
 * por aquí: esas tienen su ficha en el panel, y ninguna lista las ofrece en
 * `/mi`.
 *
 * La reunión sale aunque la agenda del equipo esté apagada, por lo mismo que la
 * lista de canciones del turno: el ensayo que ya estaba apuntado sigue siendo
 * el jueves a las siete. Sus notas no (ver la cabecera).
 */
export async function reunionParaMiembro(
  ctx: UserContext,
  reunionId: string,
): Promise<ReunionParaMiembro | null> {
  // El id viene de la barra de direcciones. Sin esto, `/mi/agenda/reunion/abc`
  // llegaría a Postgres como uuid y saldría un 500 en vez de un 404.
  if (!z.string().uuid().safeParse(reunionId).success) return null;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        ...COLUMNAS,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
        ministerioColor: ministerios.colorHex,
        modulos: ministerios.modulos,
      })
      .from(reuniones)
      // `innerJoin` y no `leftJoin`: una reunión sin ministerio es del culto, y
      // aquí no tiene que salir.
      .innerJoin(ministerios, eq(ministerios.id, reuniones.ministerioId))
      .where(and(eq(reuniones.id, reunionId), eq(reuniones.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );

  const r = filas[0];
  // Fuera del equipo no existe, con el mismo 404 que un uuid inventado: así no
  // confirma que la reunión exista.
  if (!r || !ctx.ministerioIds.includes(r.ministerioId)) return null;

  return {
    id: r.id,
    titulo: r.titulo,
    fecha: r.fecha,
    hora: horaCorta(r.hora),
    lugar: r.lugar,
    notas: notasParaElEquipo(ctx, r, r.modulos),
    ministerio: {
      id: r.ministerioId,
      nombre: r.ministerioNombre,
      colorHex: r.ministerioColor,
    },
  };
}

/**
 * «viernes 16, 19:30», que es como se dice un ensayo en voz alta.
 *
 * Sin el mes: dentro de la semana del turno el número del día no se confunde
 * con nada, y la línea cabe en un móvil.
 */
export function diaYHora(fecha: string, hora: string | null): string {
  // Partida a mano, como `formatearFechaLarga`: `new Date('2026-10-16')` es
  // medianoche UTC, y en un huso por detrás se pinta el día anterior.
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(a!, m! - 1, d!).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
  });
  return hora ? `${dia}, ${hora}` : dia;
}
