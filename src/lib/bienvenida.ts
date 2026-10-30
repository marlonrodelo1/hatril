/**
 * La bienvenida de la app: la presentación de la primera vez y la pregunta.
 *
 * Se guarda en una cookie que ya se vio, para que la presentación salga una
 * sola vez. Fuera de los componentes porque la leen el servidor (`/mi`, que
 * decide a dónde va quien abre la app sin sesión) y el cliente (la propia
 * presentación, que la escribe al terminar).
 */
export const COOKIE_BIENVENIDA = 'hatril_bienvenida';
