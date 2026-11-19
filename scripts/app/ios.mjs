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
 * - no existe ios/ (hay que traerlo de GitHub, no generarlo otra vez);
 * - el GoogleService-Info.plist de Firebase no está, no es el de Hatril o no
 *   va dentro del target App (las push; ver abajo por qué se mira);
 * - la ruta de arranque (`appStartPath`) no existe dentro de app-shell/: en
 *   iOS la app se cerraría al abrirla;
 * - falta lo que piden «Continuar con Apple» y «Continuar con Google»: la
 *   clave de Apple en los entitlements y el esquema de Google en el Info.plist.
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

/*
 * El plist de Firebase, que necesitan las push. En Gonper, un build salió sin
 * él dentro del binario y la app se cerraba al abrirla, siempre; y otro con
 * una copia pegada a medias por terminal, con la API_KEY de 8 caracteres,
 * hacía lo mismo. Los dos se compilaron, firmaron y subieron a TestFlight sin
 * una queja. Aquí el plugin ya no arranca Firebase sin el plist, pero un
 * build sin él saldría sin avisos y nadie lo notaría hasta probarlo: mejor
 * pararlo aquí, que no cuesta un build.
 */
const plist = join(raiz, 'ios', 'App', 'App', 'GoogleService-Info.plist');
if (!existsSync(plist)) {
  parar('Falta ios/App/App/GoogleService-Info.plist (viene en el repo: git pull). Sin él no hay push.');
}
const textoPlist = readFileSync(plist, 'utf8');
const valorPlist = (clave) =>
  textoPlist.match(new RegExp(`<key>${clave}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? '';
if (valorPlist('BUNDLE_ID') !== 'app.hatril' || !/^hatril-/.test(valorPlist('PROJECT_ID'))) {
  parar('El GoogleService-Info.plist no es el de Hatril (BUNDLE_ID o PROJECT_ID no cuadran).');
}
if (!/^[A-Za-z0-9_-]{30,}$/.test(valorPlist('API_KEY'))) {
  parar('La API_KEY del GoogleService-Info.plist está cortada o rota. Vuelve a traerlo de GitHub.');
}
const proyecto = readFileSync(join(raiz, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
if (!proyecto.includes('GoogleService-Info.plist in Resources')) {
  parar('El GoogleService-Info.plist no está en los Resources del target App (project.pbxproj).');
}

/*
 * La ruta de arranque tiene que existir DENTRO de app-shell/, aunque la app
 * cargue la web desplegada: Capacitor iOS lo comprueba antes de nada y, si no
 * está, cierra la app con exit(1). El build 2 de TestFlight (19-nov) se
 * instalaba y se cerraba en negro por esto. Android no lo mira.
 */
const config = readFileSync(join(raiz, 'capacitor.config.ts'), 'utf8');
const rutaDeArranque = config.match(/appStartPath:\s*'([^']+)'/)?.[1];
if (rutaDeArranque && !existsSync(join(raiz, 'app-shell', rutaDeArranque))) {
  parar(`Falta app-shell${rutaDeArranque} (appStartPath). Sin ella, la app de iOS se cierra al abrirla. Ver app-shell/mi/index.html.`);
}

/*
 * Entrar con Apple y con Google. Los dos fallos de aquí no los ve nadie hasta
 * pulsar el botón en un iPhone de verdad: sin la clave de Apple en los
 * entitlements, la ventana de Apple sale y devuelve un error 1000; sin el
 * esquema de URL del cliente de Google en el Info.plist, la librería de Google
 * CIERRA LA APP. El cliente de iOS vive en src/lib/auth/google.ts por eso
 * mismo: aquí se lee de ahí y se exige su esquema.
 */
const entitlements = readFileSync(join(raiz, 'ios', 'App', 'App', 'App.entitlements'), 'utf8');
if (!entitlements.includes('com.apple.developer.applesignin')) {
  parar('Falta com.apple.developer.applesignin en ios/App/App/App.entitlements: «Continuar con Apple» fallaría.');
}
const textoGoogle = readFileSync(join(raiz, 'src', 'lib', 'auth', 'google.ts'), 'utf8');
const clienteIos = textoGoogle.match(/ios:\s*\{[^}]*?cliente:\s*'([^']*)'/)?.[1] ?? '';
if (clienteIos) {
  const esquema = clienteIos.split('.').reverse().join('.');
  const infoPlist = readFileSync(join(raiz, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
  if (!infoPlist.includes(`<string>${esquema}</string>`)) {
    parar(`El Info.plist no lleva el esquema ${esquema} (CFBundleURLTypes). Sin él, «Continuar con Google» cierra la app.`);
  }
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
