/**
 * Prepara el proyecto de iOS para compilar: comprueba y sincroniza.
 *
 *   CAP_SERVER_URL=https://hatril.com npm run app:ios
 *
 * Es `npx cap sync ios` con tres comprobaciones delante. Se lanza en el Mac
 * después de cada `git pull` y antes de abrir Xcode o de archivar: lo que
 * escribe el sync —la configuración con la dirección y la página de sin
 * conexión ya rellena— está en el .gitignore y no viaja por GitHub. Sin él,
 * Xcode no encuentra `App/App/public` ni `capacitor.config.json` y no compila.
 *
 * Compilar y subir no lo hace: eso es Xcode o `xcodebuild`, y los pasos están
 * en docs/app-nativa/ios.md.
 *
 * SE NIEGA SI
 * -----------
 * - falta CAP_SERVER_URL o no es https (también lo mira capacitor.config.ts);
 * - la versión de capacitor.config.ts, la de Android y la de iOS no cuadran
 *   (`npm run app:version` dice cuáles);
 * - no existe ios/ (hay que traerlo de GitHub, no generarlo otra vez).
 *
 * Con una dirección de traefik.me avisa de que es una PRUEBA: ese certificado
 * no lo acepta iOS y la app abriría directamente «Sin conexión».
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { descuadres, leerNumeros } from './numeros.mjs';

const raiz = process.cwd();

function parar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

const cruda = process.env.CAP_SERVER_URL?.trim();
if (!cruda) parar('Falta CAP_SERVER_URL (la dirección https de la web).');
let servidor;
try {
  servidor = new URL(cruda);
} catch {
  parar(`CAP_SERVER_URL no es una dirección válida: «${cruda}».`);
}
if (servidor.protocol !== 'https:') parar('CAP_SERVER_URL tiene que ser https.');
const esPrueba = /(^|\.)traefik\.me$/i.test(servidor.hostname);

if (!existsSync(join(raiz, 'ios', 'App', 'App.xcodeproj'))) {
  parar('No existe ios/App/App.xcodeproj. Viene en el repo: haz git pull, no `npx cap add ios`.');
}

const numeros = leerNumeros(raiz);
const fallos = descuadres(numeros);
if (fallos.length) parar(`Los números de versión no cuadran:\n  - ${fallos.join('\n  - ')}\n  Déjalos iguales a mano (los sitios están en scripts/app/numeros.mjs) y comprueba con npm run app:version.`);

const version = numeros.ios.versiones[0];
const build = numeros.ios.builds[0];
console.log(`\nHatril iOS ${version} (${build}) → ${servidor.origin}${esPrueba ? '   [PRUEBA]' : ''}\n`);

// La línea entera y con shell: en Windows `npx` es un .cmd (ver android.mjs).
const sync = spawnSync('npx cap sync ios', { shell: true, stdio: 'inherit' });
if (sync.status !== 0) parar('Falló npx cap sync ios.');

const pagina = join(raiz, 'ios', 'App', 'App', 'public', 'sin-conexion.html');
// La rellena el hook de Capacitor (scripts/app/destino.mjs). Si no lleva la
// dirección, «Reintentar» no llevaría a ninguna parte.
if (!existsSync(pagina) || !readFileSync(pagina, 'utf8').includes(servidor.origin)) {
  parar(`La página de sin conexión no lleva la dirección: ${pagina}`);
}

console.log(`
✓ ios/ sincronizado con ${servidor.origin}.
  Siguiente: abrir ios/App/App.xcodeproj en Xcode, o archivar con xcodebuild
  (docs/app-nativa/ios.md).
`);

if (esPrueba) {
  console.log(
    '⚠ PRUEBA: apunta a traefik.me, cuyo certificado rechaza iOS.\n' +
      '  No lo subas a App Store Connect. Sincroniza con el dominio definitivo.\n',
  );
}
