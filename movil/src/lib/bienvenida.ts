import { COOKIE_BIENVENIDA } from '@/lib/bienvenida';

/**
 * Si ya se vio la presentación de la primera vez. No es un dato de nadie:
 * solo dice que este teléfono ya pasó por ella.
 *
 * DOS MARCAS, Y POR QUÉ
 * ---------------------
 * La `Presentacion` de la web, que la app usa tal cual, apunta una cookie
 * `hatril_bienvenida` al terminar. En Android vale, porque la app vive en
 * `https://localhost`. En iOS vive en `capacitor://localhost`, y el WebView
 * de Apple no guarda cookies de un esquema que no sea http: la presentación
 * saldría en cada arranque. Así que la app apunta además su propia marca al
 * llegar a «Empezar», que es a donde lleva la presentación al terminar o al
 * saltarla.
 */
const CLAVE = 'hatril-bienvenida-vista';

export function bienvenidaVista(): boolean {
  try {
    if (localStorage.getItem(CLAVE) === '1') return true;
    return document.cookie.split('; ').includes(`${COOKIE_BIENVENIDA}=1`);
  } catch {
    return false;
  }
}

export function marcarBienvenidaVista(): void {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento, la presentación saldrá otra vez. No pasa nada.
  }
}
