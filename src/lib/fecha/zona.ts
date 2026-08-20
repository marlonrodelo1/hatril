/**
 * Hora de pared de una iglesia ↔ instante absoluto.
 *
 * PARA QUÉ
 * --------
 * Los eventos se guardan en `timestamptz` —un instante— y se escriben en un
 * formulario donde el pastor teclea la hora de SU congregación. Estas dos
 * funciones son el puente, y son inversas la una de la otra.
 *
 * `src/lib/fecha/hoy.ts` resuelve el otro problema, el de los días sin hora
 * (`date`), y no se mezclan: allí «hoy» es una fecha de calendario, aquí un
 * momento en la línea del tiempo.
 *
 * SIN LIBRERÍAS
 * -------------
 * Se formatea el instante en la zona objetivo con `Intl` y se mide el desfase.
 * `Intl` conoce la base de datos de husos horarios del sistema, así que sabe de
 * cambios de hora y de cambios históricos de huso; una tabla de offsets escrita
 * a mano no.
 */

/**
 * Cuánto se aparta la hora de pared de esta zona respecto a UTC EN ESE
 * INSTANTE, en milisegundos. Madrid en agosto: +2 h. En enero: +1 h.
 */
function desfase(instante: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    // `hourCycle: 'h23'` y no `hour12: false`. Son casi lo mismo, pero
    // `hour12: false` selecciona el ciclo h24, que pinta la medianoche como
    // «24». De ahí venía el parche de abajo.
    hourCycle: 'h23',
  });

  const p = fmt.formatToParts(instante).reduce<Record<string, string>>(
    (acc, x) => {
      if (x.type !== 'literal') acc[x.type] = x.value;
      return acc;
    },
    {},
  );

  /*
   * El «24» de la medianoche, que sigue aquí a propósito.
   *
   * Con `hourCycle: 'h23'` no debería aparecer, pero la salida de ICU cambia
   * entre versiones de Node y este cinturón cuesta una línea.
   *
   * Y OJO A CÓMO SE TRATA: ICU pinta la medianoche del ciclo h24 con la fecha
   * del día que EMPIEZA, no la del que termina. Así que se pone la hora a cero
   * y NO se toca el día. Quien lo «arregle» restando un día se lleva todos los
   * eventos de medianoche a la jornada anterior.
   */
  const hora = p.hour === '24' ? 0 : Number(p.hour);

  const comoSiFueraUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hora,
    Number(p.minute),
    Number(p.second),
  );

  return comoSiFueraUtc - instante.getTime();
}

/**
 * De la hora que el pastor escribe (`2026-03-29`, `01:30`) al instante real.
 *
 * DOS PASADAS, Y NO ES UN ADORNO
 * ------------------------------
 * La versión de una sola pasada medía el desfase EN `baseUtc` —la fecha y hora
 * escritas interpretadas como si fueran UTC— y no en el instante de verdad, que
 * está una o dos horas más allá. Los días normales da igual porque el desfase es
 * el mismo a ambos lados; las noches del cambio de hora, no:
 *
 *   fechaLocalATimestamp('2026-03-29', '01:30', 'Europe/Madrid')  →  00:30
 *   fechaLocalATimestamp('2026-10-25', '01:30', 'Europe/Madrid')  →  02:30
 *
 * Una hora de desfase en la madrugada del último domingo de marzo y del de
 * octubre. Colombia no tiene horario de verano, así que el fallo está dormido en
 * el mercado inicial y despierta con la primera iglesia española.
 *
 * La segunda pasada mide el desfase en el instante aproximado, que ya cae del
 * lado correcto del salto.
 *
 * LO QUE NO ARREGLA, PORQUE NO TIENE ARREGLO
 * ------------------------------------------
 * Las 02:30 del 29 de marzo en Madrid NO EXISTEN: el reloj salta de las 2:00 a
 * las 3:00. Y las 02:30 del 25 de octubre existen DOS VECES. Para la hora que no
 * existe se devuelve el instante de después del salto, que es lo que hace
 * cualquier calendario; para la repetida, la primera. Un evento a esa hora es
 * un caso que no se da —nadie convoca un culto a las dos y media de la
 * madrugada del cambio de hora— y resolverlo bien exigiría preguntar al pastor
 * cuál de las dos quiere.
 */
export function fechaLocalATimestamp(
  fechaIso: string,
  horaHHMM: string,
  timezone: string,
): Date {
  const baseUtc = new Date(`${fechaIso}T${horaHHMM}:00Z`);
  const aprox = new Date(baseUtc.getTime() - desfase(baseUtc, timezone));
  return new Date(baseUtc.getTime() - desfase(aprox, timezone));
}

/**
 * La vuelta: del instante guardado a lo que va en el formulario de editar.
 *
 * Sin esto, el pastor abre «editar» y ve la hora UTC en vez de la suya, la
 * guarda tal cual y el evento se desplaza dos horas cada vez que alguien toca
 * una coma. Es el hueco que tenía este fichero.
 *
 * Devuelve las dos mitades por separado porque es lo que piden los `<input
 * type="date">` y `<input type="time">`, y juntas con una T en medio son
 * exactamente lo que quiere un `datetime-local`.
 */
export function timestampAFechaHoraLocal(
  instante: Date,
  timezone: string,
): { fecha: string; hora: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const p = fmt.formatToParts(instante).reduce<Record<string, string>>(
    (acc, x) => {
      if (x.type !== 'literal') acc[x.type] = x.value;
      return acc;
    },
    {},
  );

  const hora = p.hour === '24' ? '00' : p.hour;

  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${hora}:${p.minute}`,
  };
}

/**
 * Parsea el valor de un `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`)
 * interpretándolo en la zona de la iglesia. `null` si el formato no encaja.
 *
 * Se asume que quien escribe mira el calendario de su congregación y no el de su
 * propio huso: la hora que teclea es la hora de la iglesia. Es lo correcto
 * incluso cuando el pastor está de viaje, que es justo cuando importa.
 */
export function parseFechaHoraLocal(
  raw: string | null | undefined,
  timezone: string,
): Date | null {
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(raw.trim());
  if (!m) return null;
  return fechaLocalATimestamp(m[1]!, m[2]!, timezone);
}

/**
 * Para pintar: «jueves, 3 de septiembre, 19:00».
 *
 * SIEMPRE con `timeZone`, nunca con el huso del servidor. El contenedor de Next
 * corre en Europa y la mitad de las congregaciones están en Bogotá: sin esta
 * opción, un culto de las 19:00 sale a las 2:00 del día siguiente.
 */
export function formatearInstante(
  instante: Date,
  timezone: string,
  opciones: { conAnio?: boolean } = {},
): string {
  const texto = new Intl.DateTimeFormat('es', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(opciones.conAnio ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante);

  // `capitalize` de Tailwind pondría mayúscula a CADA palabra —«Jueves, 3 De
  // Septiembre»—, así que la inicial se pone aquí y en la clase va
  // `first-letter:uppercase` si hace falta.
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
