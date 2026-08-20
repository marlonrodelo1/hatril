/**
 * Las redes sociales de una iglesia.
 *
 * DATOS PUROS, SIN REACT
 * ----------------------
 * `src/lib/db/schema/iglesias.ts` importa el tipo `Red` de aquí. Ese import es
 * `import type` y desaparece al compilar, pero drizzle-kit compila el schema con
 * su propio esbuild: si este fichero llegara a arrastrar componentes o iconos,
 * el generador de migraciones se atragantaría con JSX. Los iconos y el pintado
 * se resuelven en quien lo usa.
 *
 * CATÁLOGO CERRADO, NO CLAVES LIBRES
 * ----------------------------------
 * `iglesias.redes` es un jsonb y está concedido a `anon` desde la migración
 * `0001`. Con claves libres, la web pública tendría que pintar cualquier cosa
 * que alguien escribiera —y, peor, una URL sin validar en una página pública es
 * phishing con el membrete de la iglesia. Por eso cada red trae su lista de
 * hosts admitidos y todo lo demás se rechaza. Es el mismo motivo por el que
 * `devocionales.videoUrl` valida dominio.
 *
 * Cinco y no diez: cada campo de más es una caja vacía en un formulario que se
 * rellena una vez en la vida.
 */

import { normalizarTelefono } from '../telefono/normalizar';

export const REDES = [
  'instagram',
  'facebook',
  'youtube',
  'whatsapp',
  'tiktok',
] as const;

export type Red = (typeof REDES)[number];

export const ETIQUETAS_REDES: Record<
  Red,
  { titulo: string; ejemplo: string; ayuda: string }
> = {
  instagram: {
    titulo: 'Instagram',
    ejemplo: '@miiglesia',
    ayuda: 'El nombre de usuario o la dirección completa.',
  },
  facebook: {
    titulo: 'Facebook',
    ejemplo: 'facebook.com/miiglesia',
    ayuda: 'La dirección de la página de la iglesia.',
  },
  youtube: {
    titulo: 'YouTube',
    ejemplo: '@miiglesia',
    ayuda: 'El canal donde subís las predicaciones.',
  },
  whatsapp: {
    titulo: 'WhatsApp',
    ejemplo: '300 123 4567',
    ayuda: 'Un número para escribiros, o el enlace de invitación a un grupo.',
  },
  tiktok: {
    titulo: 'TikTok',
    ejemplo: '@miiglesia',
    ayuda: 'El nombre de usuario o la dirección completa.',
  },
};

/**
 * Hosts admitidos por red.
 *
 * La comparación es exacta contra esta lista, nunca `endsWith('.tiktok.com')`:
 * un sufijo deja pasar `tiktok.com.attacker.net`, que es el error clásico.
 */
const HOSTS: Record<Red, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  whatsapp: ['wa.me', 'api.whatsapp.com', 'chat.whatsapp.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
};

/** Cómo se construye la dirección cuando la persona escribe solo su nombre. */
const DESDE_NOMBRE: Record<Exclude<Red, 'whatsapp'>, (n: string) => string> = {
  instagram: (n) => `https://www.instagram.com/${n}`,
  facebook: (n) => `https://www.facebook.com/${n}`,
  // YouTube y TikTok llevan la arroba DENTRO de la dirección; Instagram y
  // Facebook, no. Se guarda cada uno como lo sirve su web.
  youtube: (n) => `https://www.youtube.com/@${n}`,
  tiktok: (n) => `https://www.tiktok.com/@${n}`,
};

export type ResultadoRed =
  /** `url` a `null` significa que el campo venía vacío: la red se quita. */
  | { ok: true; url: string | null }
  | { ok: false; error: string };

/**
 * De lo que escribe el pastor a una dirección canónica, o a un error legible.
 *
 * Acepta las tres formas en que la gente copia esto: el nombre de usuario a
 * secas, con arroba delante, o la dirección entera pegada del navegador. Para
 * WhatsApp acepta además un teléfono, que es lo que casi todo el mundo va a
 * poner, y lo pasa por `normalizarTelefono` con el país de la iglesia — el mismo
 * que usa la ficha de miembro, para que un número no acabe guardado de dos
 * formas distintas en la misma congregación.
 */
export function normalizarRed(
  red: Red,
  raw: string | null | undefined,
  pais: string,
): ResultadoRed {
  const limpio = (raw ?? '').trim();
  if (!limpio) return { ok: true, url: null };

  const etiqueta = ETIQUETAS_REDES[red].titulo;

  // ¿Es una dirección? Se admite sin protocolo porque nadie escribe «https://»
  // a mano al copiar de la barra del navegador.
  const pareceUrl = /^(https?:\/\/|www\.)/i.test(limpio) || limpio.includes('/');

  if (pareceUrl) {
    const conProtocolo = /^https?:\/\//i.test(limpio)
      ? limpio
      : `https://${limpio}`;

    let url: URL;
    try {
      url = new URL(conProtocolo);
    } catch {
      return { ok: false, error: `La dirección de ${etiqueta} no es válida.` };
    }

    // `javascript:` y `data:` no llegan aquí porque el prefijo forzado es
    // https, pero se comprueba igual: la lista de esquemas admitidos es de una
    // línea y esta URL va a acabar en un `href` de una página pública.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { ok: false, error: `La dirección de ${etiqueta} no es válida.` };
    }

    if (!HOSTS[red].includes(url.hostname.toLowerCase())) {
      return {
        ok: false,
        error: `Esa dirección no es de ${etiqueta}. Revisa que la has copiado de la web correcta.`,
      };
    }

    // Siempre https, y sin el rastro de campañas que trae el copiar y pegar.
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    return { ok: true, url: url.toString() };
  }

  if (red === 'whatsapp') {
    const telefono = normalizarTelefono(limpio, pais);
    if (!telefono || !telefono.startsWith('+')) {
      return {
        ok: false,
        error:
          'El WhatsApp tiene que ser un teléfono o el enlace de un grupo (chat.whatsapp.com).',
      };
    }
    // `wa.me` quiere el número internacional SIN el más.
    return { ok: true, url: `https://wa.me/${telefono.slice(1)}` };
  }

  const nombre = limpio.replace(/^@+/, '');
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(nombre)) {
    return {
      ok: false,
      error: `El nombre de usuario de ${etiqueta} solo puede llevar letras, números, puntos, guiones y guiones bajos.`,
    };
  }

  return { ok: true, url: DESDE_NOMBRE[red](nombre) };
}

/**
 * Lo guardado, listo para pintar.
 *
 * Tolerante a propósito: la columna puede traer claves de un catálogo anterior o
 * escritas a mano por SQL, y se ignoran en vez de romper la web pública de la
 * iglesia. Mismo criterio que `resolverPermisos()` con un permiso desconocido.
 */
export function redesParaPintar(
  redes: Partial<Record<Red, string>> | Record<string, string> | null,
): { red: Red; titulo: string; url: string }[] {
  if (!redes) return [];

  return REDES.flatMap((red) => {
    const url = (redes as Record<string, unknown>)[red];
    if (typeof url !== 'string' || !url.startsWith('https://')) return [];
    return [{ red, titulo: ETIQUETAS_REDES[red].titulo, url }];
  });
}

/**
 * Lo guardado, listo para volver a editar.
 *
 * Se devuelve la dirección entera y no el nombre de usuario: es lo que el
 * formulario acaba de guardar, así que se reconoce, y volver a recortarla para
 * enseñar «@miiglesia» sería adivinar el formato de cinco webs distintas.
 */
export function redesParaEditar(
  redes: Partial<Record<Red, string>> | Record<string, string> | null,
): Record<Red, string> {
  const salida = {} as Record<Red, string>;
  for (const red of REDES) {
    const url = redes ? (redes as Record<string, unknown>)[red] : undefined;
    salida[red] = typeof url === 'string' ? url : '';
  }
  return salida;
}
