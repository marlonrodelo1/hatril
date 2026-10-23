import { z } from 'zod';

import { configDeModulo } from '@/lib/ministerios/modulos';

/**
 * La radio de una iglesia: su nombre, la dirección de la señal y la parrilla.
 *
 * SIN TABLA, EN `ministerios.modulos.emisora`
 * -------------------------------------------
 * Son reglas y no filas, como los horarios de la iglesia y los puestos de los
 * turnos: se leen siempre junto a su ministerio y su RLS sería la misma. Lo
 * guarda `guardarEmisora` con `conConfigDeModulo()`.
 *
 * LO QUE ESTE FICHERO NO HACE: DESCARGAR LA SEÑAL
 * -----------------------------------------------
 * Nada en el servidor pide nunca `stream_url`: ni para comprobar que suena, ni
 * para leer «qué canción va», ni para hacer de puente. Una URL que escribe un
 * líder y que el servidor visita es una puerta a la red interna de la máquina
 * (SSRF), y hacer de puente nos convertiría en quien emite la obra —con su
 * ancho de banda por oyente y sus derechos—. La comprueba el navegador de quien
 * pulsa «Probar» o ▶, y nadie más.
 *
 * Sin `server-only`: lo usan la action, las pantallas y los reproductores.
 */

/** Los días como se guardan. El orden es el de la semana en España y Colombia. */
export const DIAS_PARRILLA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

export type DiaParrilla = (typeof DIAS_PARRILLA)[number];

/**
 * 60 y no 40, que era el primer tope: no hay forma de marcar «de lunes a
 * viernes» en una sola fila, así que un programa diario gasta siete, y una radio
 * con seis programas al día ya pasaba de 40. Varios días por fila sería lo
 * cómodo; hasta que haga falta, el tope alto y un aviso cuando se llega.
 */
export const MAX_PROGRAMAS = 60;
export const MAX_LARGO_NOMBRE_EMISORA = 60;
export const MAX_LARGO_PROGRAMA = 80;
export const MAX_LARGO_TEMA = 140;
export const MAX_LARGO_SENAL = 500;
export const DURACION_MIN = 15;
export const DURACION_MAX = 480;

/**
 * Un programa de la parrilla.
 *
 * Con la forma de `HorarioSemanal` —`dia`, `hora`, `nombre`— más el tema y la
 * duración, a propósito: así `cultosEntre()` la expande a fechas sin adaptador
 * el día que los turnos se planifiquen desde la parrilla y no desde los cultos.
 *
 * Que dos programas no se pisen no lo mira este esquema sino
 * `choqueEnParrilla()`, porque necesita la parrilla entera y no una fila.
 */
export const EsquemaPrograma = z.object({
  dia: z.enum(DIAS_PARRILLA, 'Elige el día.'),
  hora: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Revisa la hora: tiene que ser como 09:30.'),
  nombre: z
    .string()
    .trim()
    .min(2, 'Ponle nombre al programa.')
    .max(MAX_LARGO_PROGRAMA, 'El nombre del programa es demasiado largo.'),
  /**
   * De qué va el programa, en una línea: «La Biblia leída de principio a fin»,
   * «Música y oración para empezar el día». Es el mismo cada semana: el tema de
   * UNA emisión concreta necesita una columna en `turnos` y está fuera.
   */
  tema: z
    .string()
    .trim()
    .max(MAX_LARGO_TEMA, `De qué va: hasta ${MAX_LARGO_TEMA} caracteres.`)
    .optional(),
  duracion_min: z.coerce
    .number('Revisa la duración.')
    .int('La duración va en minutos enteros.')
    .min(DURACION_MIN, `Un programa dura al menos ${DURACION_MIN} minutos.`)
    .max(DURACION_MAX, 'Un programa no puede durar más de 8 horas.'),
});

export type Programa = z.infer<typeof EsquemaPrograma>;

/**
 * Por qué no vale una dirección, en palabras de quien la pegó. `null` si vale.
 *
 * Los casos con nombre propio son los que se pegan de verdad, no hipótesis:
 *
 *   - `http://`. Desde 2020 Chrome, y después Firefox y Safari, sube a https el
 *     audio de una página https y lo corta si el servidor no contesta en https.
 *     Hatril va con HSTS, así que una señal http no sonaría NUNCA, y no hay
 *     nada que hacer desde aquí salvo pedir la dirección segura al proveedor.
 *   - Listas `.pls` / `.m3u` / `.asx`. Es lo que descarga el botón «Escuchar»
 *     de muchas emisoras: un fichero de texto con la dirección dentro, que un
 *     `<audio>` no sabe abrir.
 *   - `.m3u8` (HLS). Necesita una librería en el navegador: fuera de la v1.
 *   - La ficha de la emisora en zeno.fm, que es una página web y no el audio.
 *   - Usuario y contraseña dentro de la dirección: la señal sale a todo el que
 *     abra la app, y en la web pública si el pastor la publica.
 *   - Una dirección de la red de casa (192.168…, localhost). Solo suena dentro
 *     de esa red, y desde el móvil de un oyente apunta a SU router.
 */
export function problemaDeLaSenal(valor: string): string | null {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return 'Pega la dirección entera de la señal, la que empieza por https://';
  }

  if (url.protocol === 'http:') {
    return 'La señal tiene que ir por https://. Las direcciones http no suenan dentro de una web segura: pide a tu proveedor la dirección https (en Shoutcast e Icecast suele ser otro puerto).';
  }
  if (url.protocol !== 'https:') {
    return 'Pega la dirección entera de la señal, la que empieza por https://';
  }
  if (url.username || url.password) {
    return 'Quita el usuario y la contraseña de la dirección: la señal la ve todo el que escucha.';
  }

  const ruta = url.pathname.toLowerCase();
  if (ruta.endsWith('.m3u8')) {
    return 'Esa dirección es HLS (.m3u8), y todavía no se puede reproducir aquí. Pide a tu proveedor la dirección directa en MP3 o AAC.';
  }
  if (/\.(pls|m3u|asx|xspf)$/.test(ruta)) {
    return 'Eso es una lista de reproducción, no la señal. Ábrela con el bloc de notas y copia la dirección que hay dentro.';
  }

  const host = url.hostname.toLowerCase();
  if (host === 'zeno.fm' || host === 'www.zeno.fm') {
    return 'Esa es la página de la emisora en Zeno, no el audio. La dirección de la señal empieza por https://stream.zeno.fm/';
  }
  // Pasaba la validación y el reproductor se quedaba mudo: un canal de
  // YouTube es una página, no un audio que un <audio> pueda abrir. La primera
  // iglesia real tiene su radio justo así.
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    return 'YouTube no es una señal de audio y aquí no sonaría. Pon el canal en Ajustes, en Redes, y aquí la dirección de la emisión en MP3 o AAC que da tu proveedor.';
  }
  if (esDeRedLocal(host)) {
    return 'Esa dirección solo funciona dentro de tu red. Hace falta la que da tu proveedor para internet.';
  }

  return null;
}

function esDeRedLocal(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  // IPv6 entre corchetes: nadie da un certificado https para una IPv6 suelta, y
  // las que se pegan son de la red de casa.
  if (host.startsWith('[')) return true;

  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!ip) return false;
  const a = Number(ip[1]);
  const b = Number(ip[2]);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** La dirección de la señal: https, hasta 500 caracteres, y nada de lo de arriba. */
export const EsquemaSenal = z
  .string()
  .trim()
  .max(MAX_LARGO_SENAL, 'Esa dirección es demasiado larga.')
  .superRefine((valor, ctx) => {
    const problema = problemaDeLaSenal(valor);
    if (problema) ctx.addIssue({ code: 'custom', message: problema });
  });

/**
 * Lo que guarda la action. Estricto: es lo que se ESCRIBE.
 *
 * `stream_url` es opcional para poder guardar el nombre y la parrilla antes de
 * tener la señal. Sin ella no sale el reproductor en ningún sitio.
 */
export const EsquemaEmisora = z.object({
  nombre: z
    .string()
    .trim()
    .max(MAX_LARGO_NOMBRE_EMISORA, 'El nombre de la emisora es demasiado largo.')
    .optional(),
  stream_url: EsquemaSenal.optional(),
  parrilla: z
    .array(EsquemaPrograma)
    .max(MAX_PROGRAMAS, `La parrilla admite hasta ${MAX_PROGRAMAS} programas.`),
  en_web: z.boolean(),
});

export type ConfigEmisora = z.infer<typeof EsquemaEmisora>;

/** La emisora ya leída, con todo resuelto para pintarla. */
export type Emisora = {
  nombre: string | null;
  /** `null` si no hay señal, o si la guardada ya no pasa la validación. */
  streamUrl: string | null;
  parrilla: Programa[];
  enWeb: boolean;
};

/**
 * La emisora de un ministerio a partir de su jsonb, tolerante con lo guardado.
 *
 * Campo a campo y no con `EsquemaEmisora` entero: una sola fila de la parrilla
 * escrita a mano en la base no puede dejar a la iglesia sin radio. Lo que no
 * valida se descarta.
 *
 * Y la señal se vuelve a validar al LEER, no solo al guardar. No hay CHECK en
 * la base que lo garantice —la v1 va sin migraciones—, así que esta es la
 * segunda capa: una dirección http o `javascript:` que llegara por otro camino
 * no se le pasa a ningún `<audio>`.
 */
export function emisoraDeModulos(modulos: unknown): Emisora {
  return emisoraDeConfig(configDeModulo(modulos, 'emisora'));
}

/**
 * Lo mismo, a partir de la config del módulo ya extraída. Es lo que reciben las
 * consultas que piden solo `modulos -> 'emisora'` y no el jsonb entero.
 */
export function emisoraDeConfig(valor: unknown): Emisora {
  const config =
    valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};

  const nombre = EsquemaEmisora.shape.nombre.safeParse(config.nombre);
  const senal = EsquemaSenal.safeParse(config.stream_url);
  const filas = Array.isArray(config.parrilla) ? config.parrilla : [];

  return {
    nombre: nombre.success && nombre.data ? nombre.data : null,
    streamUrl: senal.success && senal.data ? senal.data : null,
    parrilla: ordenarParrilla(
      filas
        .map((f) => EsquemaPrograma.safeParse(f))
        .filter((r) => r.success)
        .map((r) => r.data)
        .slice(0, MAX_PROGRAMAS),
    ),
    enWeb: config.en_web === true,
  };
}

/** De lunes a domingo, y dentro del día por hora. */
export function ordenarParrilla(parrilla: Programa[]): Programa[] {
  return [...parrilla].sort(
    (a, b) =>
      DIAS_PARRILLA.indexOf(a.dia) - DIAS_PARRILLA.indexOf(b.dia) ||
      a.hora.localeCompare(b.hora),
  );
}

/**
 * «stream.zeno.fm», para decir a dónde se conecta quien pulsa ▶ antes de que
 * pulse. Lo mismo que `sitioDe()` del repertorio, sin quitar el `www.`: aquí
 * importa el servidor exacto.
 */
export function servidorDe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
