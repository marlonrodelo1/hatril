import type { HorarioSemanal } from '@/lib/db/schema';
import { indiceDia } from '@/lib/iglesias/proxima-reunion';

/**
 * La semana de la iglesia: qué día es hoy allí, qué reuniones caen en cada día
 * y cuál es la próxima.
 *
 * Todo recibe el instante como parámetro, nada lee el reloj por su cuenta
 * salvo `minutoDeGeneracion()`, que es justo el que se pasa. Es lo que deja
 * pintar lo mismo en el servidor y en el primer fotograma del navegador, y
 * recalcular después con la hora de verdad (`horarios-reloj.ts`).
 *
 * POR QUÉ NO `proximaReunion()`
 * -----------------------------
 * Se reutiliza su `indiceDia()`, que es donde está lo difícil (el día lo
 * escribe el pastor a mano). La próxima se calcula aquí por tres motivos:
 *
 *   - Lee `new Date()` dentro, así que el servidor y el navegador pueden dar
 *     respuestas distintas, y con ISR la del servidor puede ser de hace horas.
 *   - No devuelve cuánto falta, y la cuenta atrás lo necesita.
 *   - Entre dos reuniones del mismo día se queda con la primera que el pastor
 *     escribió, no con la más temprana: con «Culto 11:00» antes que «Escuela
 *     dominical 9:00», a las 8 diría que lo próximo es el culto.
 *
 * La regla de fondo es la misma: si es hoy pero la hora ya pasó, cuenta la de
 * la semana que viene.
 */

/**
 * Lunes primero, que es como se lee una semana en Colombia y en España.
 * `indice` es el de `indiceDia()`: 0 = domingo.
 */
export const COLUMNAS = [
  { corta: 'L', nombre: 'lunes', indice: 1 },
  { corta: 'M', nombre: 'martes', indice: 2 },
  { corta: 'X', nombre: 'miércoles', indice: 3 },
  { corta: 'J', nombre: 'jueves', indice: 4 },
  { corta: 'V', nombre: 'viernes', indice: 5 },
  { corta: 'S', nombre: 'sábado', indice: 6 },
  { corta: 'D', nombre: 'domingo', indice: 0 },
] as const;

const UN_DIA = 86_400_000;

/**
 * El minuto en que el servidor genera esta copia de la página: lo que se pinta
 * hasta que el navegador hidrata y pasa a su propio reloj.
 *
 * Fuera del componente porque la regla de pureza de React no distingue un
 * componente de servidor, que con ISR se ejecuta una vez por copia, de uno de
 * cliente que se repinta: allí un `Date.now()` sí daría resultados que bailan.
 * Solo para `SeccionHorarios`; en el navegador la hora la da `useMinuto`.
 */
export function minutoDeGeneracion(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/** De `indiceDia()` (0 = domingo) a columna (0 = lunes). */
function columnaDe(indice: number): number {
  return (indice + 6) % 7;
}

/**
 * Minutos desde medianoche. `null` si no parece una hora.
 *
 * La misma lectura que hace `proximaReunion()`, que no la exporta: la hora
 * también es texto libre («19:30», «7.30», «19h»).
 */
export function minutosDeHora(hora: string): number | null {
  const m = hora.match(/(\d{1,2})[:.h]?(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export type HoyEnLaIglesia = {
  /** 0 = lunes … 6 = domingo. */
  columna: number;
  /** Minutos desde la medianoche de la iglesia. */
  minutos: number;
  /** El número del mes de cada día de esta semana, de lunes a domingo. */
  fechas: number[];
};

/**
 * Qué día y qué hora es en la iglesia. Una persona en Madrid que mira la web
 * de una iglesia de Bogotá ve la semana de Bogotá: a las 2 de la madrugada del
 * miércoles en Madrid, allí todavía es martes por la noche.
 */
export function hoyEnLaIglesia(timezone: string, instante: number): HoyEnLaIglesia {
  // `hourCycle: 'h23'` y no `hour12: false`: con lo segundo hay navegadores
  // que escriben «24» a la medianoche, y de 00:00 a 00:59 el día entero
  // parecería pasado.
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instante));

  const buscar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';

  const columna = Math.max(
    0,
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(buscar('weekday')),
  );

  // Las fechas, contando días sobre una medianoche UTC: aquí solo se suman
  // días, y en UTC no hay cambio de hora que convierta uno en 23 horas.
  const base = Date.UTC(
    Number(buscar('year')),
    Number(buscar('month')) - 1,
    Number(buscar('day')),
  );
  const fechas = COLUMNAS.map((_, c) =>
    new Date(base + (c - columna) * UN_DIA).getUTCDate(),
  );

  return {
    columna,
    minutos: Number(buscar('hour')) * 60 + Number(buscar('minute')),
    fechas,
  };
}

/**
 * Las reuniones de cada día, de lunes a domingo y por hora. Las que tienen un
 * día que no se entiende van aparte: no se sabe en qué columna ponerlas, pero
 * tampoco se pueden perder.
 */
export function repartirPorDias(horarios: HorarioSemanal[]): {
  dias: HorarioSemanal[][];
  sinDia: HorarioSemanal[];
} {
  const dias: HorarioSemanal[][] = COLUMNAS.map(() => []);
  const sinDia: HorarioSemanal[] = [];

  for (const h of horarios) {
    const indice = indiceDia(h.dia);
    if (indice === null) sinDia.push(h);
    else dias[columnaDe(indice)]!.push(h);
  }

  // Una hora que no se entiende va al final del día, no al principio.
  const orden = (h: HorarioSemanal) => minutosDeHora(h.hora) ?? 24 * 60;
  for (const dia of dias) dia.sort((a, b) => orden(a) - orden(b));

  return { dias, sinDia };
}

export type Proxima = {
  horario: HorarioSemanal;
  /** «hoy», «mañana», «este jueves», «el martes que viene». */
  cuando: string;
  /** Minutos que faltan, solo si es hoy. Mañana a las 11 no es una cuenta atrás. */
  faltan: number | null;
};

export function proximaEnLaSemana(
  dias: HorarioSemanal[][],
  hoy: HoyEnLaIglesia,
): Proxima | null {
  // Hasta siete días: el séptimo es hoy de la semana que viene, para las de
  // hoy cuya hora ya pasó.
  for (let paso = 0; paso <= 7; paso++) {
    const columna = (hoy.columna + paso) % 7;
    for (const horario of dias[columna]!) {
      const minutos = minutosDeHora(horario.hora);
      if (minutos === null) continue;
      // A la hora en punto ya no es «lo próximo»: ha empezado.
      if (paso === 0 && minutos <= hoy.minutos) continue;

      const nombre = COLUMNAS[columna]!.nombre;
      const cuando =
        paso === 0
          ? 'hoy'
          : paso === 1
            ? 'mañana'
            : paso === 7
              ? `el ${nombre} que viene`
              : `este ${nombre}`;

      return {
        horario,
        cuando,
        faltan: paso === 0 ? minutos - hoy.minutos : null,
      };
    }
  }
  return null;
}

/** «Empieza en 2 h 15 min», «Empieza en 40 min», «Empieza en 3 h». */
export function textoCuentaAtras(faltan: number): string {
  const h = Math.floor(faltan / 60);
  const min = faltan % 60;
  if (h === 0) return `Empieza en ${min} min`;
  if (min === 0) return `Empieza en ${h} h`;
  return `Empieza en ${h} h ${min} min`;
}

/**
 * La primera reunión después de un día sin ninguna, dando la vuelta a la
 * semana. Para la línea «La siguiente es Culto, el domingo a las 11:00».
 */
export function siguienteTras(
  dias: HorarioSemanal[][],
  columna: number,
): { horario: HorarioSemanal; columna: number } | null {
  for (let paso = 1; paso < 7; paso++) {
    const c = (columna + paso) % 7;
    const primera = dias[c]![0];
    if (primera) return { horario: primera, columna: c };
  }
  return null;
}
