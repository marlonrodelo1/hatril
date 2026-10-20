/**
 * Iconos y pantalla de arranque de la app, y los iconos de la web, todo de
 * `assets/icono.svg` (y, a 16 y 32 px, de los dos favicons dibujados a mano
 * que hay a su lado).
 *
 *   npm run app:iconos
 *
 * Lanzarlo de nuevo tras cambiar el SVG. Funciona en Windows: los iconos de
 * iOS son ficheros del repo y no hace falta el Mac para generarlos.
 *
 * QUÉ HACE
 * --------
 * 1. Pasa el SVG a los PNG que lee @capacitor/assets:
 *      icon-only.png             1024, el cuadrado entero (Android 7; el de
 *                                iOS se sobrescribe en el paso 4)
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
 *    una pantalla densa el dibujo salía blando. El vectorial es el mismo
 *    trazado del SVG, nítido a cualquier tamaño, y sirve además de icono
 *    monocromo para los iconos temáticos de Android 13.
 *
 * 4. Quita del arranque de iOS los PNG de ejemplo de la plantilla de
 *    Capacitor: @capacitor/assets escribe los suyos al lado y los viejos se
 *    quedan sueltos, sin nadie que los use, con Xcode avisando de ellos.
 *
 *    Y escribe el icono de iOS con el atril más grande (ver `iconoIos`),
 *    encima del que deja @capacitor/assets. Sin canal alfa, que es lo que
 *    exige App Store Connect: se aplana aquí y se comprueba (3 canales).
 *
 * 5. Deja en Versiones/Android la vista previa y el icono de 512 que pide la
 *    ficha de Google Play.
 *
 * 6. Escribe los iconos de la web con los nombres que Next 16 convierte solo
 *    en etiquetas <link> (node_modules/next/dist/docs/01-app/
 *    03-api-reference/03-file-conventions/01-metadata/app-icons.md):
 *      src/app/favicon.ico      16, 32 y 48 en un fichero, para quien lo pide
 *                               a ciegas en /favicon.ico (y el buscador)
 *      src/app/icon1.png        16, el favicon dibujado a mano
 *      src/app/icon2.png        32, ídem
 *      src/app/apple-icon.png   180, el de iOS: cuadrado entero y sin alfa
 *
 *    Sin icon.svg, y a propósito: el navegador prefiere un SVG a cualquier
 *    PNG, y escalaría el dibujo grande a 16 px, donde el libro y el pupitre se
 *    funden en un bloque. Con los dos PNG de tamaño exacto, la pestaña coge el
 *    de 16 en una pantalla normal y el de 32 en una retina.
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
const DIBUJO = fuente.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
const NARANJA = fuente.match(/<rect[^>]*\sfill="(#[0-9A-Fa-f]{6})"/)?.[1];
if (!DIBUJO || !NARANJA) {
  throw new Error('assets/icono.svg tiene que traer un <rect> de fondo con fill y un <path> con el dibujo.');
}

/*
 * El atril de iOS, más grande que el de icono.svg.
 *
 * icono.svg está dibujado para Android: el atril cabe en el círculo del 66 %,
 * que es lo único que un icono adaptable garantiza enseñar con cualquier
 * máscara. iOS no recorta así: enseña el cuadrado entero con sus esquinas, y
 * el mismo dibujo se quedaba en un tercio del ancho, perdido en el naranja.
 *
 * Aquí la caja del atril pasa a medir LADO_IOS del lado en su dimensión mayor,
 * que es el alto (en icono.svg, el 57 %). Al 66 %, el tope del rango que se
 * buscaba: es un símbolo estrecho, y por debajo de eso seguía pareciendo
 * pequeño en la pantalla de inicio al lado de otros iconos.
 *
 * Se escala alrededor del centro del lienzo y no del de la caja, y eso es el
 * centrado óptico: el dibujo ya trae la caja unos píxeles por debajo del
 * centro (516,75 de 1024) porque el peso, libro y pupitre, está arriba (su
 * centro de masas cae en 501,5). Centrar la caja a secas subiría el atril.
 */
const LADO_IOS = 0.66;

/** La caja del atril en las unidades del SVG (1024), medida sobre el alfa. */
async function cajaDelDibujo() {
  const escala = 2;
  const muestra = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${1024 * escala}" height="${1024 * escala}"><path fill="#FFFFFF" d="${DIBUJO}"/></svg>`;
  const { data, info } = await sharp(Buffer.from(muestra))
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { ancho: (x1 + 1 - x0) / escala, alto: (y1 + 1 - y0) / escala };
}

/** El icono de iOS a 1024, opaco. */
async function iconoIos() {
  const { ancho, alto } = await cajaDelDibujo();
  const factor = (LADO_IOS * 1024) / Math.max(ancho, alto);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <rect width="1024" height="1024" fill="${NARANJA}"/>
    <g transform="translate(512 512) scale(${factor.toFixed(4)}) translate(-512 -512)"><path fill="#FFFFFF" d="${DIBUJO}"/></g>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).flatten({ background: NARANJA }).removeAlpha().png().toBuffer();
  const { channels } = await sharp(png).metadata();
  if (channels !== 3) throw new Error(`El icono de iOS sale con ${channels} canales; App Store Connect lo rechaza con alfa.`);
  console.log(
    `Icono de iOS: atril de ${Math.round(ancho * factor)} × ${Math.round(alto * factor)} sobre 1024 (×${factor.toFixed(3)}).`,
  );
  return png;
}

/** Un cuadrado con las esquinas de iOS (22,4 % del lado). */
const esquinas = (lado) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${lado * 0.2237}"/></svg>`,
  );

async function redondeado(lado, fuente = join(assets, 'icon-only.png')) {
  const plano = await sharp(fuente).resize(lado, lado).png().toBuffer();
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
  // 108 y el lanzador enseña los 72 del centro. Así el atril queda en la zona
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
        <path android:fillColor="#FFFFFF" android:pathData="${DIBUJO}" />
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

/** El nombre es el que deja @capacitor/assets en Contents.json: un solo 1024. */
function escribirIconoIos(png) {
  const carpeta = join(raiz, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (!existsSync(carpeta)) return;
  writeFileSync(join(carpeta, 'AppIcon-512@2x.png'), png);
}

/** El adaptable tal como lo pinta un lanzador: la zona visible, con su máscara. */
async function adaptable(lado, mascara) {
  const forma =
    mascara === 'circulo'
      ? `<circle cx="512" cy="512" r="512"/>`
      : `<rect width="1024" height="1024" rx="307"/>`;
  const dibujo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${lado}" height="${lado}">
    <clipPath id="m">${forma}</clipPath>
    <g clip-path="url(#m)"><rect width="1024" height="1024" fill="${NARANJA}"/><path fill="#FFFFFF" d="${DIBUJO}"/></g>
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

async function vistaPrevia(ios) {
  mkdirSync(versiones, { recursive: true });

  // Sobre un escalón más tostado que el crema, para que el teléfono se vea.
  // Los dos redondeados (320 y 60) son el de iOS; los circulares, Android.
  const piezas = [
    { input: await redondeado(320, ios), left: 60, top: 80 },
    { input: await adaptable(200, 'circulo'), left: 440, top: 80 },
    { input: await adaptable(200, 'redondeado'), left: 440, top: 320 },
    { input: await adaptable(96, 'circulo'), left: 700, top: 80 },
    { input: await adaptable(64, 'circulo'), left: 716, top: 200 },
    { input: await adaptable(48, 'circulo'), left: 724, top: 290 },
    { input: await redondeado(60, ios), left: 718, top: 370 },
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

/** Un .ico de los de ahora: un PNG dentro por tamaño (Windows Vista en adelante). */
function ico(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(imagenes.length, 4);
  let desde = 6 + 16 * imagenes.length;
  const entradas = imagenes.map(({ lado, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado, 0);
    e.writeUInt8(lado, 1);
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(desde, 12);
    desde += png.length;
    return e;
  });
  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.png)]);
}

async function web(ios) {
  const app = join(raiz, 'src', 'app');
  // A 72 ppp el SVG de 16 sale a 16 píxeles justos: cada cuadradito del
  // dibujo cae en un píxel, sin suavizado que lo emborrone.
  const f16 = await sharp(join(assets, 'favicon-16.svg'), { density: 72 }).png().toBuffer();
  const f32 = await sharp(join(assets, 'favicon-32.svg'), { density: 72 }).png().toBuffer();
  // A 48 ya se lee el dibujo vectorial, con las esquinas del símbolo de la web
  // (src/components/marca/logo.tsx).
  const f48 = await redondeado(48);

  writeFileSync(
    join(app, 'favicon.ico'),
    ico([
      { lado: 16, png: f16 },
      { lado: 32, png: f32 },
      { lado: 48, png: f48 },
    ]),
  );
  writeFileSync(join(app, 'icon1.png'), f16);
  writeFileSync(join(app, 'icon2.png'), f32);
  // iOS pone las esquinas y pinta de negro lo transparente: cuadrado entero.
  // Es el de la pantalla de inicio del iPhone, así que lleva el atril de iOS.
  await sharp(ios)
    .resize(180, 180)
    .removeAlpha()
    .png()
    .toFile(join(app, 'apple-icon.png'));
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
const ios = await iconoIos();
escribirIconoIos(ios);
await vistaPrevia(ios);
await web(ios);

console.log(
  '\nIconos y arranque generados, también los de la web (src/app). Vista previa en Versiones/Android/icono-vista-previa.png',
);
