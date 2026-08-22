/**
 * De la URL que pega el líder al identificador que necesita el reproductor.
 *
 * TRES FORMAS DE LA MISMA DIRECCIÓN
 * ---------------------------------
 * La gente pega lo que le da el botón «Compartir» de su móvil, y eso son tres
 * cosas distintas: `youtu.be/ID`, `youtube.com/watch?v=ID` y, cada vez más,
 * `youtube.com/shorts/ID`. Las tres tienen que valer, porque quien escribe el
 * devocional no tiene por qué saber cuál le tocó.
 *
 * `youtube-nocookie.com` entra también: es el dominio que ya acepta la
 * validación del panel y el que se usa para empotrar.
 *
 * VIMEO SE RECONOCE PERO NO SE EMPOTRA
 * ------------------------------------
 * La lista de dominios del panel lo admite desde el principio y ninguna iglesia
 * lo ha usado todavía. Devolver su id sin más serviría para pintar un
 * reproductor, pero Vimeo no da miniatura sin llamar a su API —una petición de
 * servidor más, con su clave— así que la fachada no se puede montar igual. Hasta
 * que haga falta de verdad, Vimeo se queda con el enlace de siempre.
 */
export type VideoDevocional = { plataforma: 'youtube'; id: string };

export function leerVideo(url: string | null | undefined): VideoDevocional | null {
  if (!url) return null;

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    // El panel valida el dominio al guardar, así que aquí solo llegan URLs que
    // pasaron por ahí. Aun así, una fila vieja o editada a mano en la base no
    // puede tumbar la pantalla del devocional.
    return null;
  }

  const host = u.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtu.be') {
    return idValido(u.pathname.slice(1));
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v');
    if (v) return idValido(v);

    // /shorts/ID y /embed/ID
    const partes = u.pathname.split('/').filter(Boolean);
    if (partes.length === 2 && (partes[0] === 'shorts' || partes[0] === 'embed')) {
      return idValido(partes[1]!);
    }
  }

  return null;
}

/**
 * Un id de YouTube son once caracteres de un alfabeto conocido.
 *
 * Se comprueba porque ese id se va a meter dentro de la URL de un `<iframe>`: lo
 * que llegue de la base de datos no se cose a un `src` sin mirarlo, aunque el
 * panel ya lo haya validado al guardar.
 */
function idValido(bruto: string): VideoDevocional | null {
  const id = bruto.trim();
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? { plataforma: 'youtube', id } : null;
}

/** La miniatura que sirve YouTube para un vídeo. */
export function miniaturaDe(video: VideoDevocional): string {
  return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

/**
 * La dirección del reproductor, en el dominio sin cookies.
 *
 * `youtube-nocookie.com` no evita que YouTube sepa quién ve qué —la petición
 * lleva la IP igual— pero sí que deje cookies de seguimiento antes de que se
 * pulse play. Es la diferencia entre «rastrea a quien ve el vídeo» y «rastrea a
 * quien abre la pantalla».
 */
export function urlDelReproductor(video: VideoDevocional): string {
  return `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`;
}
