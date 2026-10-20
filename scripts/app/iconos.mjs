/**
 * Iconos y pantalla de arranque de la app, todo de un solo dibujo:
 * `assets/icono.svg`.
 *
 *   npm run app:iconos
 *
 * Lanzarlo de nuevo tras cambiar el SVG. Funciona en Windows: los iconos de
 * iOS son ficheros del repo y no hace falta el Mac para generarlos.
 *
 * QUÉ HACE
 * --------
 * 1. Pasa el SVG a los PNG que lee @capacitor/assets:
 *      icon-only.png             1024, el cuadrado entero (iOS y Android 7)
 *      splash.png, splash-dark   2732, crema con el icono en el centro
 *
 *    No hay `icon.png`: para @capacitor/assets eso es el «modo fácil», que
 *    inventa su propio icono adaptable encogiendo el cuadrado entero.
 *    Y hay `splash-dark` aunque la app no tenga modo oscuro: sin él, un
 *    teléfono en oscuro enseñaría el arranque de ejemplo de Capacitor, que
 *    viene en las carpetas `-night`.
 *
 * 2. Lanza @capacitor/assets para Android e iOS. Nunca para PWA, que es lo
 *    que hace sin decirle nada, y tocaría el manifiesto de la web.
 *
 *    Con `npx --yes @capacitor/assets@3.0.5`, y NO como devDependency. Era
 *    devDependency y arrastraba sharp 0.32.6, cuya instalación descarga
 *    libvips de GitHub: el `npm ci` del Dockerfile lo hacía en cada despliegue,
 *    para una herramienta que solo se usa aquí, a mano, cuando cambia el
 *    icono. Fuera de package.json el despliegue no la ve, y la versión sigue
 *    fija en esta línea.
 *
 * 3. Escribe a mano el icono adaptable de Android (8 en adelante), en
 *    vectorial. El de @capacitor/assets son PNG de 48 dp estirados a 72: en
 *    una pantalla densa la H salía blanda. El vectorial es la misma H del SVG,
 *    nítida a cualquier tamaño, y sirve además de icono monocromo para los
 *    iconos temáticos de Android 13.
 *
 * 4. Quita del arranque de iOS los PNG de ejemplo de la plantilla de
 *    Capacitor: @capacitor/assets escribe los suyos al lado y los viejos se
 *    quedan sueltos, sin nadie que los use, con Xcode avisando de ellos.
 *
 *    El icono de iOS sale sin canal alfa, que es lo que exige App Store
 *    Connect: lo aplana @capacitor/assets (comprobado con sharp: 3 canales).
 *
 * 5. Deja en Versiones/Android la vista previa y el icono de 512 que pide la
 *    ficha de Google Play.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = process.cwd();
const assets = join(raiz, 'assets');
const res = join(raiz, 'android', 'app', 'src', 'main', 'res');
const versiones = join(raiz, 'Versiones', 'Android');

/** La versión exacta: un `npx` sin ella bajaría la última, sea la que sea. */
const ASSETS = '@capacitor/assets@3.0.5';

// El sharp de Next, que lo trae como dependencia opcional para optimizar
// imágenes. npm instala las opcionales salvo que se le diga lo contrario, así
// que en un `npm ci` normal está; si no, se dice en vez de reventar a medias.
let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('\n✗ No encuentro sharp en node_modules (lo trae Next como opcional). Prueba con `npm ci`.\n');
  process.exit(1);
}

const CREMA = '#FAF9F5';

const fuente = readFileSync(join(assets, 'icono.svg'), 'utf8');
const H = fuente.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
const NARANJA = fuente.match(/<rect[^>]*\sfill="(#[0-9A-Fa-f]{6})"/)?.[1];
if (!H || !NARANJA) {
  throw new Error('assets/icono.svg tiene que traer un <rect> de fondo con fill y un <path> con la letra.');
}

/** Un cuadrado con las esquinas de iOS (22,4 % del lado). */
const esquinas = (lado) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${lado * 0.2237}"/></svg>`,
  );

async function redondeado(lado) {
  const plano = await sharp(join(assets, 'icon-only.png')).resize(lado, lado).png().toBuffer();
  return sharp(plano).composite([{ input: esquinas(lado), blend: 'dest-in' }]).png().toBuffer();
}

async function rasterizar() {
  await sharp(join(assets, 'icono.svg')).resize(1024, 1024).png().toFile(join(assets, 'icon-only.png'));

  // El icono, a 440 de 2732. Cada pantalla se queda con el centro: en un
  // iPhone sale de unos 140 pt, en un Android antiguo de 80 a 110 dp.
  const icono = await redondeado(440);
  for (const nombre of ['splash.png', 'splash-dark.png']) {
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: CREMA } })
      .composite([{ input: icono, gravity: 'center' }])
      .png()
      .toFile(join(assets, nombre));
  }
}

function adaptableAndroid() {
  if (!existsSync(res)) return;

  // Lienzo de 1536 = el 1024 del SVG más el margen hasta 108 dp: la capa mide
  // 108 y el lanzador enseña los 72 del centro. Así la H queda en la zona
  // visible exactamente como en icono.svg.
  writeFileSync(
    join(res, 'drawable', 'ic_launcher_foreground.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/app/iconos.mjs desde assets/icono.svg. No editar. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="1536"
    android:viewportHeight="1536">
    <group android:translateX="256" android:translateY="256">
        <path android:fillColor="#FFFFFF" android:pathData="${H}" />
    </group>
</vector>
`,
  );

  writeFileSync(
    join(res, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/app/iconos.mjs desde assets/icono.svg. No editar. -->
<resources>
    <color name="ic_launcher_background">${NARANJA}</color>
</resources>
`,
  );

  const adaptable = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/app/iconos.mjs. No editar. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
  writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptable);
  writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptable);

  // Lo que sobra: el logo de Capacitor de la plantilla (el de `-v24` ganaría
  // al nuestro en cualquier Android de los que soporta la app) y las capas en
  // PNG si alguna vez se generaron.
  rmSync(join(res, 'drawable-v24', 'ic_launcher_foreground.xml'), { force: true });
  rmSync(join(res, 'drawable', 'ic_launcher_background.xml'), { force: true });
  for (const carpeta of readdirSync(res).filter((c) => c.startsWith('mipmap-'))) {
    for (const capa of ['ic_launcher_foreground.png', 'ic_launcher_background.png']) {
      rmSync(join(res, carpeta, capa), { force: true });
    }
  }
}

function arranqueIos() {
  const carpeta = join(raiz, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
  if (!existsSync(carpeta)) return;
  for (const f of readdirSync(carpeta).filter((f) => /^splash-2732x2732(-\d)?\.png$/.test(f))) {
    rmSync(join(carpeta, f));
  }
}

/** El adaptable tal como lo pinta un lanzador: la zona visible, con su máscara. */
async function adaptable(lado, mascara) {
  const forma =
    mascara === 'circulo'
      ? `<circle cx="512" cy="512" r="512"/>`
      : `<rect width="1024" height="1024" rx="307"/>`;
  const dibujo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${lado}" height="${lado}">
    <clipPath id="m">${forma}</clipPath>
    <g clip-path="url(#m)"><rect width="1024" height="1024" fill="${NARANJA}"/><path fill="#FFFFFF" d="${H}"/></g>
  </svg>`;
  return sharp(Buffer.from(dibujo)).png().toBuffer();
}

/** La pantalla de arranque dentro de un teléfono esquemático. */
async function telefono(ancho, alto) {
  const pantalla = await sharp(join(assets, 'splash.png')).resize(ancho, alto).png().toBuffer();
  const recorte = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="${ancho}" height="${alto}" rx="34"/></svg>`;
  const marco = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect x="0.5" y="0.5" width="${ancho - 1}" height="${alto - 1}" rx="34" fill="none" stroke="#E0DFDB"/></svg>`;
  return sharp(pantalla)
    .composite([
      { input: Buffer.from(recorte), blend: 'dest-in' },
      { input: Buffer.from(marco) },
    ])
    .png()
    .toBuffer();
}

async function vistaPrevia() {
  mkdirSync(versiones, { recursive: true });

  // Sobre un escalón más tostado que el crema, para que el teléfono se vea.
  const piezas = [
    { input: await redondeado(320), left: 60, top: 80 },
    { input: await adaptable(200, 'circulo'), left: 440, top: 80 },
    { input: await adaptable(200, 'redondeado'), left: 440, top: 320 },
    { input: await adaptable(96, 'circulo'), left: 700, top: 80 },
    { input: await adaptable(64, 'circulo'), left: 716, top: 200 },
    { input: await adaptable(48, 'circulo'), left: 724, top: 290 },
    { input: await redondeado(60), left: 718, top: 370 },
    { input: await telefono(260, 540), left: 860, top: 40 },
  ];
  await sharp({ create: { width: 1180, height: 620, channels: 4, background: '#F0EEE6' } })
    .composite(piezas)
    .png()
    .toFile(join(versiones, 'icono-vista-previa.png'));

  // La ficha de Google Play pide 512 × 512 y cuadrado entero: las esquinas
  // las pone la tienda.
  await sharp(join(assets, 'icon-only.png')).resize(512, 512).png().toFile(join(versiones, 'icono-play-512.png'));
}

await rasterizar();

// La línea entera y con shell: en Windows `npx` es un .cmd (ver android.mjs).
const generar = spawnSync(`npx --yes ${ASSETS} generate --android --ios`, { shell: true, stdio: 'inherit' });
if (generar.status !== 0) {
  console.error(`\n✗ Falló ${ASSETS}. La primera vez descarga el paquete: hace falta red.\n`);
  process.exit(1);
}

adaptableAndroid();
arranqueIos();
await vistaPrevia();

console.log('\nIconos y arranque generados. Vista previa en Versiones/Android/icono-vista-previa.png');
