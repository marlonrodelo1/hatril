import type { HorarioSemanal } from '@/lib/db/schema';

/**
 * Cuál es la próxima reunión y cuánto falta.
 *
 * Es la pregunta que trae a alguien a la web de una iglesia. Hoy la contesta
 * leyendo una lista y haciendo la cuenta de cabeza; esto la contesta directamente.
 *
 * EL DÍA ES TEXTO LIBRE, Y HAY QUE ASUMIRLO
 * -----------------------------------------
 * `horarios.dia` lo escribe el pastor a mano en Ajustes: llega «Domingo»,
 * «domingos», «DOMINGO» o «Dom». Se normaliza quitando acentos y comparando por
 * prefijo, que cubre todo eso. Lo que no se reconoce simplemente no entra en el
 * cálculo: la reunión sigue apareciendo en la lista, solo que sin contar para
 * «la próxima». Preferible a inventarse un día.
 *
 * LA HORA ES LA DE LA IGLESIA, NO LA DEL SERVIDOR
 * -----------------------------------------------
 * El servidor está en Europa y las primeras congregaciones en Bogotá: son siete
 * horas. Calcular con la hora del servidor haría que el domingo por la mañana en
 * Colombia el sitio dijera que el culto «ya pasó». Por eso todo se hace sobre la
 * zona de la iglesia, que se guarda por congregación justamente para esto.
 */

const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** 0 = domingo … 6 = sábado. `null` si no se reconoce. */
export function indiceDia(dia: string): number | null {
  const limpio = normalizar(dia);
  const i = DIAS.findIndex((d) => limpio.startsWith(d.slice(0, 3)));
  return i === -1 ? null : i;
}

/** Minutos desde medianoche. `null` si no parece una hora. */
function minutosDeHora(hora: string): number | null {
  const m = hora.match(/(\d{1,2})[:.h]?(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Qué día y qué hora es AHORA en la zona de la iglesia. */
function ahoraEnLaIglesia(timezone: string): { dia: number; minutos: number } {
  // `Intl` en vez de aritmética con offsets: el horario de verano cambia el
  // desfase dos veces al año y hacerlo a mano se rompe justo esas semanas.
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const buscar = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? '';

  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dia = dias.indexOf(buscar('weekday'));

  return {
    dia: dia === -1 ? 0 : dia,
    minutos: Number(buscar('hour')) * 60 + Number(buscar('minute')),
  };
}

export type ProximaReunion = {
  horario: HorarioSemanal;
  /** «Hoy», «Mañana», «Este jueves»… ya redactado. */
  cuando: string;
};

export function proximaReunion(
  horarios: HorarioSemanal[],
  timezone: string,
): ProximaReunion | null {
  const ahora = ahoraEnLaIglesia(timezone);

  let mejor: { horario: HorarioSemanal; enDias: number } | null = null;

  for (const h of horarios) {
    const dia = indiceDia(h.dia);
    const minutos = minutosDeHora(h.hora);
    if (dia === null || minutos === null) continue;

    // Días que faltan, dando la vuelta a la semana. Si es hoy pero la hora ya
    // pasó, cuenta como dentro de siete días: la de esta semana ya no sirve.
    let enDias = (dia - ahora.dia + 7) % 7;
    if (enDias === 0 && minutos <= ahora.minutos) enDias = 7;

    if (!mejor || enDias < mejor.enDias) mejor = { horario: h, enDias };
  }

  if (!mejor) return null;

  const cuando =
    mejor.enDias === 0
      ? 'Hoy'
      : mejor.enDias === 1
        ? 'Mañana'
        : mejor.enDias === 7
          ? `El ${mejor.horario.dia.toLowerCase()} que viene`
          : `Este ${mejor.horario.dia.toLowerCase()}`;

  return { horario: mejor.horario, cuando };
}
