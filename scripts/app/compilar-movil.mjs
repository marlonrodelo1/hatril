/**
 * Compila la app empaquetada (`movil/`) contra una dirección de la API y
 * comprueba, después del `cap sync`, que lo copiado al proyecto nativo es esa
 * compilación y no otra.
 *
 * Lo usan `android.mjs` e `ios.mjs`. No se lanza a mano.
 *
 * POR QUÉ LA MARCA
 * ----------------
 * La dirección de la API va dentro del JavaScript de la app, metida al
 * compilar. Un `movil/dist` de otra compilación —contra localhost, contra la
 * dirección de pruebas— se copiaría al binario sin que nada avisara, y la app
 * saldría a la tienda hablando con el servidor que no es. Por eso la
 * compilación deja `hatril-api.json` con su dirección, y tras el sync se mira
 * en la copia que va dentro del proyecto nativo.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARCA = 'hatril-api.json';

function parar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

/** `npm run movil:build` con `VITE_API_URL`. Para si algo falla. */
export function compilarMovil(raiz, servidor) {
  console.log(`\nCompilando la app (movil/) contra ${servidor.origin}…\n`);
  // La línea entera y con shell: en Windows `npm` es un .cmd (ver android.mjs).
  const r = spawnSync('npm run movil:build', {
    shell: true,
    stdio: 'inherit',
    cwd: raiz,
    env: { ...process.env, VITE_API_URL: servidor.origin },
  });
  if (r.status !== 0) parar('Falló la compilación de la app (npm run movil:build).');

  const dist = join(raiz, 'movil', 'dist');
  if (!existsSync(join(dist, 'index.html'))) parar('La compilación no ha dejado movil/dist/index.html.');
  writeFileSync(join(dist, MARCA), JSON.stringify({ api: servidor.origin, compilada: new Date().toISOString() }));
}

/** Tras `cap sync`: la copia del proyecto nativo lleva la dirección buena. */
export function comprobarCopia(publica, servidor) {
  const marca = join(publica, MARCA);
  if (!existsSync(marca)) parar(`No está ${marca}: el sync no ha copiado la app recién compilada.`);
  const { api } = JSON.parse(readFileSync(marca, 'utf8'));
  if (api !== servidor.origin) {
    parar(`La app copiada habla con ${api} y se pidió ${servidor.origin}. Vuelve a lanzar el script.`);
  }
}
