/**
 * Escribe en la página de sin conexión YA COPIADA al proyecto nativo la
 * dirección a la que vuelve su botón de «Reintentar».
 *
 * Lo lanza Capacitor solo, al terminar cada copia (`capacitor:copy:after` en
 * package.json), con la configuración ya resuelta en `CAPACITOR_CONFIG`. Así
 * da igual si el sync viene de `npm run app:android` o de un `npx cap sync` a
 * mano: la página siempre lleva la dirección con la que se está compilando.
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * La página de error no vive en la web: Capacitor la sirve desde el origen
 * local de la app (https://localhost en Android, capacitor://localhost en
 * iOS), así que no tiene forma de saber dónde está la web. Y no puede leerlo
 * de otro fichero: en Android todo lo que esa página pide fuera de sí misma
 * se va a la red, que es justo lo que falta. La dirección tiene que ir
 * DENTRO del HTML.
 *
 * Se toca la copia y no `app-shell/`: el original lleva el marcador
 * `__HATRIL_DESTINO__` y se queda así, porque la dirección no se commitea.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARCADOR = '__HATRIL_DESTINO__';

function parar(mensaje) {
  console.error(`destino.mjs: ${mensaje}`);
  process.exit(1);
}

const crudo = process.env.CAPACITOR_CONFIG;
const plataforma = process.env.CAPACITOR_PLATFORM_NAME;
const raiz = process.env.CAPACITOR_ROOT_DIR ?? process.cwd();
if (!crudo || !plataforma) parar('lo lanza Capacitor al copiar; no se usa a mano.');

// Capacitor también copia para «web», que aquí no existe; nada que hacer.
if (plataforma !== 'android' && plataforma !== 'ios') process.exit(0);

const config = JSON.parse(crudo);
const url = config.server?.url;
if (!url || !url.startsWith('https://')) parar('la configuración no trae una server.url https.');

const destino = new URL(config.server.appStartPath ?? '/', url).toString();

const publica =
  plataforma === 'android'
    ? join(raiz, config.android?.path ?? 'android', 'app', 'src', 'main', 'assets', 'public')
    : join(raiz, config.ios?.path ?? 'ios', 'App', 'App', 'public');
const pagina = join(publica, config.server.errorPath ?? 'sin-conexion.html');

if (!existsSync(pagina)) parar(`no encuentro la página de error copiada en ${pagina}.`);
const html = readFileSync(pagina, 'utf8');
if (!html.includes(MARCADOR)) parar(`${pagina} no lleva el marcador ${MARCADOR}.`);

// JSON.stringify da una cadena de JavaScript bien escapada; se quitan las
// comillas porque el marcador ya va entre comillas en el HTML.
writeFileSync(pagina, html.replaceAll(MARCADOR, JSON.stringify(destino).slice(1, -1)));
