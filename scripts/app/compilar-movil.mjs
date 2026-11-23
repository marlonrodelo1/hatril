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
 *
 * SUPABASE, TAMBIÉN EN EL MAC
 * ---------------------------
 * La app necesita la dirección de Supabase y su clave publicable al compilar
 * (`movil/src/lib/entorno.ts`). Vite las leía del `.env.local` de la raíz, que
 * no va a GitHub, y el Mac compila lo que hay en GitHub: allí salían vacías,
 * la compilación terminaba sin una queja y la app se paraba al abrirla en su
 * primera línea («Falta NEXT_PUBLIC_SUPABASE_URL»). En el iPhone, una pantalla
 * crema y nada más. Pasó con los builds 5 y 7 de iOS, el 23-nov.
 *
 * Las dos son públicas por diseño —van en el JavaScript de hatril.com, que
 * cualquiera descarga—, así que viven aquí, en `PUBLICO`, y se usan cuando el
 * entorno no las trae. Y después de compilar se mira que la dirección esté
 * dentro del JavaScript: si no está, se para antes de llegar a un teléfono.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARCA = 'hatril-api.json';

/**
 * Las de Supabase que van en el navegador. NUNCA la clave secreta ni la de la
 * base: esas no empiezan por `NEXT_PUBLIC_` y no salen del servidor.
 */
const PUBLICO = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://qutoggpigkdginvburjv.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ZcqY1dBRP9-DrfE93CTr0g_zSNM7mx3',
};

function parar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

/** Lo que trae el `.env.local` de la raíz, si existe (en el Windows sí; en el Mac, no). */
function leerEnvLocal(raiz) {
  const fichero = join(raiz, '.env.local');
  if (!existsSync(fichero)) return {};
  const salida = {};
  for (const linea of readFileSync(fichero, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) salida[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return salida;
}

/** `npm run movil:build` con `VITE_API_URL`. Para si algo falla. */
export function compilarMovil(raiz, servidor) {
  console.log(`\nCompilando la app (movil/) contra ${servidor.origin}…\n`);

  // El entorno manda, luego el `.env.local`, y si no hay ninguno, `PUBLICO`.
  const local = leerEnvLocal(raiz);
  const supabase = Object.fromEntries(
    Object.entries(PUBLICO).map(([clave, porDefecto]) => [clave, process.env[clave] || local[clave] || porDefecto]),
  );

  // La línea entera y con shell: en Windows `npm` es un .cmd (ver android.mjs).
  const r = spawnSync('npm run movil:build', {
    shell: true,
    stdio: 'inherit',
    cwd: raiz,
    env: { ...process.env, ...supabase, VITE_API_URL: servidor.origin },
  });
  if (r.status !== 0) parar('Falló la compilación de la app (npm run movil:build).');

  const dist = join(raiz, 'movil', 'dist');
  if (!existsSync(join(dist, 'index.html'))) parar('La compilación no ha dejado movil/dist/index.html.');

  // La prueba de que Supabase va dentro: sin su dirección, la app no arranca.
  const assets = join(dist, 'assets');
  const dentro = readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .some((f) => readFileSync(join(assets, f), 'utf8').includes(supabase.NEXT_PUBLIC_SUPABASE_URL));
  if (!dentro) {
    parar('La app compilada no lleva la dirección de Supabase: se quedaría en blanco al abrirla.');
  }

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
