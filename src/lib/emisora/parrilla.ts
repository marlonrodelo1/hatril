import { DIAS_PARRILLA, type Programa } from './config';

/**
 * «Ahora suena» y «a continuación», sacados de la parrilla de la iglesia.
 *
 * DE LA PARRILLA, NO DEL SERVIDOR DE LA EMISORA
 * ---------------------------------------------
 * Icecast y Shoutcast dicen qué canción va, pero leerlo exige CORS en su
 * servidor o que el nuestro lo pida —y el nuestro no pide nunca la señal, ver
 * `config.ts`—. La parrilla la escribe la iglesia y dice lo que de verdad le
 * importa al oyente: qué programa es y cuál viene después.
 *
 * EN LA HORA DE LA IGLESIA
 * ------------------------
 * Un oyente de Bogotá con el móvil en hora de Madrid vería el programa
 * equivocado. Se calcula con `Intl` en la zona de la iglesia, como
 * `proximaReunion()`, y por eso funciona igual en el servidor que en el
 * navegador.
 *
 * Todo en minutos desde el lunes a las 00:00. Así un programa que empieza el
 * domingo a las 23:00 y dura dos horas sigue «en antena» el lunes a la 00:30,
 * y no hace falta tratar la medianoche como caso aparte.
 */

const MINUTOS_SEMANA = 7 * 24 * 60;

export type AhoraYLuego = {
  ahora: Programa | null;
  luego: { programa: Programa; cuando: string } | null;
};

/** Qué minuto de la semana es en la zona de la iglesia (0 = lunes 00:00). */
function minutoDeLaSemana(timezone: string, fecha: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);

  const buscar = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? '';

  const dia = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(
    buscar('weekday'),
  );
  return (
    Math.max(dia, 0) * 1440 + Number(buscar('hour')) * 60 + Number(buscar('minute'))
  );
}

function inicioDe(p: Programa): number {
  const [h, m] = p.hora.split(':').map(Number);
  return DIAS_PARRILLA.indexOf(p.dia) * 1440 + h! * 60 + m!;
}

export function ahoraYLuego(
  parrilla: Programa[],
  timezone: string,
  fecha: Date = new Date(),
): AhoraYLuego {
  if (parrilla.length === 0) return { ahora: null, luego: null };

  const ahora = minutoDeLaSemana(timezone, fecha);

  let enAntena: { programa: Programa; desde: number } | null = null;
  let siguiente: { programa: Programa; falta: number } | null = null;

  for (const p of parrilla) {
    // Cuánto hace que empezó, dando la vuelta a la semana.
    const desde = (ahora - inicioDe(p) + MINUTOS_SEMANA) % MINUTOS_SEMANA;
    if (desde < p.duracion_min) {
      // Si dos se pisan, manda el que empezó más tarde: es el que suena.
      if (!enAntena || desde < enAntena.desde) enAntena = { programa: p, desde };
      // Y no cuenta como «luego»: su próxima vez es dentro de una semana.
      continue;
    }

    const falta = (MINUTOS_SEMANA - desde) % MINUTOS_SEMANA;
    if (falta > 0 && (!siguiente || falta < siguiente.falta)) {
      siguiente = { programa: p, falta };
    }
  }

  return {
    ahora: enAntena?.programa ?? null,
    luego: siguiente
      ? {
          programa: siguiente.programa,
          cuando: cuandoEmpieza(siguiente.programa, ahora, siguiente.falta),
        }
      : null,
  };
}

/** «a las 18:00», «mañana a las 07:00», «el jueves a las 20:00». */
function cuandoEmpieza(p: Programa, ahora: number, falta: number): string {
  const diaAhora = Math.floor(ahora / 1440);
  const diaDelPrograma = Math.floor(((ahora + falta) % MINUTOS_SEMANA) / 1440);
  const enDias = (diaDelPrograma - diaAhora + 7) % 7;

  if (enDias === 0 && falta < 1440) return `a las ${p.hora}`;
  if (enDias === 1) return `mañana a las ${p.hora}`;
  // Mismo día de la semana pero dentro de siete: «el lunes» dicho un lunes se
  // lee como hoy.
  if (enDias === 0) return `el próximo ${p.dia.toLowerCase()} a las ${p.hora}`;
  return `el ${p.dia.toLowerCase()} a las ${p.hora}`;
}

/**
 * Dos programas que se pisan, dicho para quien los escribió. `null` si no hay.
 *
 * Una radio emite una cosa cada vez: si dos se pisan, «ahora suena» elige uno
 * y el otro desaparece a media emisión sin que nadie sepa por qué. Y dos filas
 * iguales salían dos veces en la programación. Se mira al guardar, con la
 * misma cuenta en minutos de la semana que `ahoraYLuego()`, así que también
 * cuenta el programa del domingo por la noche que entra en el lunes.
 */
export function choqueEnParrilla(parrilla: Programa[]): string | null {
  for (let i = 0; i < parrilla.length; i++) {
    for (let j = i + 1; j < parrilla.length; j++) {
      const a = parrilla[i]!;
      const b = parrilla[j]!;
      const ia = inicioDe(a);
      const ib = inicioDe(b);

      if (ia === ib) {
        return a.nombre === b.nombre
          ? `«${a.nombre}» está dos veces el ${a.dia.toLowerCase()} a las ${a.hora}.`
          : `«${a.nombre}» y «${b.nombre}» empiezan los dos el ${a.dia.toLowerCase()} a las ${a.hora}.`;
      }

      const [primero, segundo] =
        (ib - ia + MINUTOS_SEMANA) % MINUTOS_SEMANA < a.duracion_min
          ? [a, b]
          : (ia - ib + MINUTOS_SEMANA) % MINUTOS_SEMANA < b.duracion_min
            ? [b, a]
            : [null, null];

      if (primero && segundo) {
        return `«${primero.nombre}» (${primero.dia.toLowerCase()}, ${franjaDe(primero)}) se pisa con «${segundo.nombre}», que empieza el ${segundo.dia.toLowerCase()} a las ${segundo.hora}.`;
      }
    }
  }
  return null;
}

/** Qué día de la parrilla es hoy en la iglesia. */
export function diaDeHoy(
  timezone: string,
  fecha: Date = new Date(),
): (typeof DIAS_PARRILLA)[number] {
  return DIAS_PARRILLA[Math.floor(minutoDeLaSemana(timezone, fecha) / 1440)]!;
}

/** La parrilla agrupada por día, sin los días vacíos, de lunes a domingo. */
export function parrillaPorDia(
  parrilla: Programa[],
): { dia: (typeof DIAS_PARRILLA)[number]; programas: Programa[] }[] {
  return DIAS_PARRILLA.map((dia) => ({
    dia,
    programas: parrilla
      .filter((p) => p.dia === dia)
      .sort((a, b) => a.hora.localeCompare(b.hora)),
  })).filter((d) => d.programas.length > 0);
}

/** «09:00 – 10:30». */
export function franjaDe(p: Programa): string {
  const fin = (inicioDe(p) + p.duracion_min) % 1440;
  const hh = String(Math.floor(fin / 60)).padStart(2, '0');
  const mm = String(fin % 60).padStart(2, '0');
  return `${p.hora} – ${hh}:${mm}`;
}
