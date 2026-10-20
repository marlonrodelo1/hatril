/**
 * Sube el número de la app en todos los sitios a la vez.
 *
 *   npm run app:version                  enseña los números y dice si cuadran
 *   npm run app:version -- build         +1 a la compilación de Android y de iOS
 *   npm run app:version -- build ios     +1 solo a la de iOS (o `android`)
 *   npm run app:version -- 1.0.1         versión nueva en los tres sitios,
 *                                        y +1 a las dos compilaciones
 *
 * CUÁNDO
 * ------
 * - Cada vez que se sube algo a una tienda, la compilación tiene que ser mayor
 *   que la última que esa tienda recibió: Google Play y App Store Connect
 *   rechazan un número repetido aunque el binario sea otro. Subir las dos de
 *   golpe es lo cómodo: un hueco en la cuenta de una tienda no molesta a nadie.
 * - La versión visible (1.0.0 → 1.0.1) cuando cambia lo que ve la gente.
 *
 * Nunca se baja ni se reinicia la compilación al cambiar de versión: Google
 * Play exige que crezca siempre, y así el número dice lo mismo en las dos.
 *
 * Toca ficheros del repo. Después, commit y push, ANTES de compilar en el Mac:
 * el Mac compila lo que hay en GitHub.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATRONES, RUTAS, descuadres, leerNumeros } from './numeros.mjs';

const raiz = process.cwd();

function parar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

function resumen(n) {
  const ios = n.ios ? `${n.ios.versiones[0]} (${n.ios.builds[0]})` : 'no existe ios/';
  const android = n.android ? `${n.android.version} (${n.android.build})` : 'no existe android/';
  return `  App (User-Agent)  HatrilApp/${n.agente}\n  Android           ${android}\n  iOS               ${ios}`;
}

/** 1.0.10 > 1.0.9, que una comparación de cadenas no ve. */
function mayor(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
}

function reescribir(ruta, cambiar) {
  const completa = join(raiz, ruta);
  const antes = readFileSync(completa, 'utf8');
  const despues = cambiar(antes);
  if (despues === antes) parar(`No he cambiado nada en ${ruta}: ¿ha cambiado su formato?`);
  writeFileSync(completa, despues);
}

const actual = leerNumeros(raiz);
const fallos = descuadres(actual);
const [orden, plataforma] = process.argv.slice(2);

if (!orden) {
  console.log(`\n${resumen(actual)}\n`);
  if (fallos.length) parar(`No cuadran:\n  - ${fallos.join('\n  - ')}`);
  console.log('✓ Cuadran.\n');
  process.exit(0);
}

// Con los números descuadrados, cualquier cambio arrastraría el error.
if (fallos.length) parar(`Antes de cambiar nada, esto no cuadra:\n  - ${fallos.join('\n  - ')}`);

let version = null;
let subirAndroid = true;
let subirIos = true;

if (orden === 'build') {
  if (plataforma === 'ios') subirAndroid = false;
  else if (plataforma === 'android') subirIos = false;
  else if (plataforma) parar(`¿«${plataforma}»? Usa \`build\`, \`build ios\` o \`build android\`.`);
} else if (/^\d+\.\d+\.\d+$/.test(orden)) {
  if (!mayor(orden, actual.agente)) parar(`${orden} no es mayor que la actual, ${actual.agente}.`);
  version = orden;
} else {
  parar(`No entiendo «${orden}». Usa \`build\` o una versión como 1.0.1.`);
}

if (version) {
  reescribir(RUTAS.config, (t) => t.replace(PATRONES.agente, `const AGENTE = 'HatrilApp/${version}'`));
}

if (actual.android && (version || subirAndroid)) {
  reescribir(RUTAS.gradle, (t) => {
    let r = t;
    if (version) r = r.replace(PATRONES.versionName, `versionName "${version}"`);
    if (subirAndroid) r = r.replace(PATRONES.versionCode, `versionCode ${actual.android.build + 1}`);
    return r;
  });
}

if (actual.ios && (version || subirIos)) {
  reescribir(RUTAS.pbxproj, (t) => {
    let r = t;
    if (version) r = r.replace(PATRONES.marketing, `MARKETING_VERSION = ${version};`);
    if (subirIos) r = r.replace(PATRONES.build, `CURRENT_PROJECT_VERSION = ${actual.ios.builds[0] + 1};`);
    return r;
  });
}

const nuevo = leerNumeros(raiz);
const quedan = descuadres(nuevo);
if (quedan.length) parar(`Ha quedado algo mal:\n  - ${quedan.join('\n  - ')}`);

console.log(`\n${resumen(nuevo)}\n\n✓ Hecho. Ahora commit y push, y después compila (en el Mac, tras git pull).\n`);
