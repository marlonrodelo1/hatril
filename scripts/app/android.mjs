/**
 * Compila la app de Android firmada y la deja en Versiones/Android.
 *
 *   CAP_SERVER_URL=https://hatril.com npm run app:android          (bash)
 *   $env:CAP_SERVER_URL='https://hatril.com'; npm run app:android  (PowerShell)
 *
 * Sale el .aab, que es lo que se sube a Google Play, y el .apk, que se instala
 * a mano en un teléfono para probar. Los dos firmados con la clave de subida.
 *
 *   Versiones/Android/Hatril-<versionName>-<versionCode>.aab
 *   Versiones/Android/Hatril-<versionName>-<versionCode>.apk
 *
 * LO QUE SE COMPILA CONTRA LA DIRECCIÓN DE PRUEBAS SE LLAMA ASÍ
 * -------------------------------------------------------------
 * Con una dirección de *.traefik.me —la temporal de Dokploy— los ficheros
 * salen con «-PRUEBA» en el nombre. Ese certificado no lo aceptan ni Android
 * ni iOS, así que la app abriría directamente la pantalla de sin conexión:
 * sirve para ver el icono, el arranque y que el binario se firma, no para
 * subirlo. Con el dominio definitivo sale sin la marca.
 *
 * ANTES DE COMPILAR SE NIEGA SI
 * -----------------------------
 * - falta CAP_SERVER_URL o no es https (lo comprueba también
 *   capacitor.config.ts, que es quien manda);
 * - el `HatrilApp/x.y.z` de capacitor.config.ts no coincide con el
 *   versionName de android/app/build.gradle: la web distingue versiones por
 *   ahí, y una que mienta es peor que ninguna;
 * - no está la firma (android/keystore.properties y el .jks al que apunta):
 *   Gradle compilaría igual, sin firmar, y Google Play lo rechazaría.
 *
 * Usa el Java de Android Studio y el SDK de siempre si no se le dicen otros
 * (JAVA_HOME, ANDROID_HOME). En Windows, macOS y Linux.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';

const raiz = process.cwd();
const android = join(raiz, 'android');
const destino = join(raiz, 'Versiones', 'Android');
const windows = platform() === 'win32';

function parar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

/**
 * En Windows, `npx` y `gradlew` son .cmd/.bat y Node solo los lanza a través
 * del intérprete de órdenes; se le pasa la línea entera, ya montada, para no
 * mezclar `shell` con argumentos sueltos (Node 24 avisa de eso).
 */
function ejecutar(orden, args, opciones = {}) {
  const linea = [orden, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
  return spawnSync(linea, { shell: true, ...opciones });
}

function lanzar(orden, args, opciones = {}) {
  const r = ejecutar(orden, args, { stdio: 'inherit', ...opciones });
  if (r.status !== 0) parar(`Falló: ${orden} ${args.join(' ')}`);
}

// --- La dirección -----------------------------------------------------------

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

// --- La versión -------------------------------------------------------------

const gradle = readFileSync(join(android, 'app', 'build.gradle'), 'utf8');
const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1];
if (!versionName || !versionCode) parar('No encuentro versionName / versionCode en android/app/build.gradle.');

const config = readFileSync(join(raiz, 'capacitor.config.ts'), 'utf8');
const agente = config.match(/const AGENTE = 'HatrilApp\/([^']+)'/)?.[1];
if (agente !== versionName) {
  parar(
    `capacitor.config.ts dice HatrilApp/${agente} y build.gradle versionName ${versionName}. ` +
      'Súbelos a la vez.',
  );
}

// --- La firma ---------------------------------------------------------------

const propiedades = join(android, 'keystore.properties');
if (!existsSync(propiedades)) {
  parar(
    'Falta android/keystore.properties: sin él la release sale sin firmar. ' +
      'Apunta al .jks de Versiones/Android/firma (ver CLAVES.txt).',
  );
}
const storeFile = readFileSync(propiedades, 'utf8').match(/^storeFile=(.+)$/m)?.[1]?.trim();
if (!storeFile || !existsSync(resolve(android, storeFile))) {
  parar(`android/keystore.properties apunta a un .jks que no existe: ${storeFile}`);
}

// --- Las herramientas -------------------------------------------------------

const primero = (...rutas) => rutas.find((r) => r && existsSync(r));

const javaHome = primero(
  windows ? 'C:/Program Files/Android/Android Studio/jbr' : null,
  platform() === 'darwin' ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home' : null,
  process.env.JAVA_HOME,
);
const androidHome = primero(
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  windows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : null,
  join(homedir(), 'Library', 'Android', 'sdk'),
  join(homedir(), 'Android', 'Sdk'),
);
if (!javaHome) parar('No encuentro Java. Instala Android Studio o define JAVA_HOME.');
if (!androidHome) parar('No encuentro el SDK de Android. Define ANDROID_HOME.');

const entorno = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome };

// --- Compilar ---------------------------------------------------------------

const nombre = `Hatril-${versionName}-${versionCode}${esPrueba ? '-PRUEBA' : ''}`;
console.log(`\nHatril ${versionName} (${versionCode}) → ${servidor.origin}${esPrueba ? '   [PRUEBA]' : ''}\n`);

const inicio = Date.now();
lanzar('npx', ['cap', 'sync', 'android'], { env: entorno });
// Con la ruta entera: hay entornos de Windows (NoDefaultCurrentDirectoryInExePath)
// en los que cmd no busca en la carpeta actual.
const gradlew = join(android, windows ? 'gradlew.bat' : 'gradlew');
lanzar(gradlew, ['bundleRelease', 'assembleRelease'], { cwd: android, env: entorno });

const salidas = [
  [join(android, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'), `${nombre}.aab`],
  [join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), `${nombre}.apk`],
];

mkdirSync(destino, { recursive: true });
for (const [origen, final] of salidas) {
  // Si Gradle dejó el antiguo sin tocar, mejor saberlo que entregarlo.
  if (!existsSync(origen) || statSync(origen).mtimeMs < inicio) parar(`Gradle no ha generado ${origen}.`);
  copyFileSync(origen, join(destino, final));
}

// --- Comprobar la firma -----------------------------------------------------

const aab = join(destino, `${nombre}.aab`);
const apk = join(destino, `${nombre}.apk`);

const jarsigner = join(javaHome, 'bin', windows ? 'jarsigner.exe' : 'jarsigner');
const firmaAab = spawnSync(jarsigner, ['-verify', aab], { encoding: 'utf8', env: entorno });
if (firmaAab.status !== 0 || !/jar verified/i.test(firmaAab.stdout)) {
  parar(`El .aab no pasa jarsigner -verify:\n${firmaAab.stdout}${firmaAab.stderr}`);
}

const herramientas = join(androidHome, 'build-tools');
const ultima = readdirSync(herramientas)
  .filter((v) => existsSync(join(herramientas, v, windows ? 'apksigner.bat' : 'apksigner')))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .pop();
if (!ultima) parar('No encuentro apksigner en el SDK (build-tools).');
const apksigner = join(herramientas, ultima, windows ? 'apksigner.bat' : 'apksigner');
const firmaApk = ejecutar(apksigner, ['verify', '--print-certs', apk], { encoding: 'utf8', env: entorno });
if (firmaApk.status !== 0) parar(`El .apk no pasa apksigner verify:\n${firmaApk.stdout}${firmaApk.stderr}`);
const huella = firmaApk.stdout.match(/SHA-256 digest:\s*([0-9a-f]+)/i)?.[1];

console.log(`
✓ Firmados y comprobados (jarsigner -verify, apksigner verify):
  ${aab}
  ${apk}
  Certificado SHA-256: ${huella ?? '?'}
`);

if (esPrueba) {
  console.log(
    '⚠ PRUEBA: apunta a traefik.me, cuyo certificado rechazan Android e iOS.\n' +
      '  No lo subas a Google Play. Recompila con el dominio definitivo.\n',
  );
}
