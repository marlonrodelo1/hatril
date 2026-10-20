import type { CapacitorConfig } from '@capacitor/cli';

/**
 * La app nativa de Hatril (Android e iOS).
 *
 * ES LA WEB DE VERDAD, NO UNA COPIA
 * ---------------------------------
 * El WebView carga la aplicación desplegada (`server.url`). No se exporta Next
 * a estático porque no se puede: todo es SSR con la sesión en cookies, y una
 * copia empaquetada se quedaría sin servidor. Lo único que viaja dentro del
 * binario es `app-shell/`: la página de «sin conexión» y el `index.html` que
 * Capacitor exige aunque no se llegue a pintar.
 *
 * LA DIRECCIÓN NO SE ESCRIBE AQUÍ
 * -------------------------------
 * Sale de `CAP_SERVER_URL` al hacer el sync, y sin ella no hay sync: este
 * fichero lanza y Capacitor no copia nada. Escribirla a mano es la forma de
 * subir a la tienda un binario que apunta a la dirección de pruebas sin que
 * nadie se dé cuenta. Y tiene que ser https: no se abre ni `cleartext` ni
 * nada parecido, ni siquiera mientras el dominio definitivo no exista.
 *
 *   CAP_SERVER_URL=https://hatril.com npm run app:android
 *
 * La de traefik.me, la temporal de Dokploy, lleva un certificado que Android
 * e iOS rechazan, y lo que se compila con ella sale marcado como PRUEBA
 * (`scripts/app/android.mjs`).
 */
function direccionDelServidor(): URL {
  const cruda = process.env.CAP_SERVER_URL?.trim();

  if (!cruda) {
    throw new Error(
      'Falta CAP_SERVER_URL: la dirección https de la web que carga la app. ' +
        'Ejemplo: CAP_SERVER_URL=https://hatril.com npm run app:android',
    );
  }

  let url: URL;
  try {
    url = new URL(cruda);
  } catch {
    throw new Error(`CAP_SERVER_URL no es una dirección válida: «${cruda}».`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(
      `CAP_SERVER_URL tiene que ser https y es «${url.protocol}». ` +
        'La app no carga nada sin cifrar.',
    );
  }

  return url;
}

const servidor = direccionDelServidor();

/**
 * Lo que `src/lib/platform` busca en el User-Agent para saber que la petición
 * viene de la app. La versión tiene que ser la de `versionName` en
 * `android/app/build.gradle`: el script de compilación lo comprueba y se niega
 * a compilar si no coinciden.
 */
const AGENTE = 'HatrilApp/1.0.0';

/** `--hatril-bg-base` de `globals.css`. */
const CREMA = '#FAF9F5';

const config: CapacitorConfig = {
  appId: 'app.hatril',
  appName: 'Hatril',
  webDir: 'app-shell',

  // Lo que se ve mientras la web no ha pintado. Sin esto, un destello blanco
  // entre el arranque y la primera pantalla.
  backgroundColor: CREMA,

  android: { appendUserAgent: AGENTE },
  ios: { appendUserAgent: AGENTE },

  server: {
    // Solo el origen: la ruta la pone `appStartPath`. Si la dirección trajera
    // barra final, Capacitor pegaría las dos y abriría `//mi`.
    url: servidor.origin,

    // `/mi` es el desvío que decide a dónde va cada quien: sin sesión, al
    // acceso; el miembro, al muro; quien lleva algo, a lo suyo. La portada es
    // publicidad para pastores y dentro de la app no pinta nada.
    //
    // Que la primera carga sea una redirección es seguro en un Android al día,
    // y no lo sería en uno con el WebView sin actualizar en años. Capacitor
    // solo pide él las páginas —siguiendo la redirección por su cuenta y
    // entregando el destino con la dirección pedida— cuando el WebView no
    // sabe inyectar su puente al empezar el documento (DOCUMENT_START_SCRIPT,
    // `Bridge.loadWebView` y `WebViewLocalServer.handleProxyRequest`). Si lo
    // sabe, se aparta y el WebView navega solo, como un navegador. Probado en
    // el emulador: la barra dice /acceso?next=%2Fmi y el formulario envía
    // ahí. Detalle y límite en docs/app-nativa/android.md.
    appStartPath: '/mi',

    // El propio host ya está permitido por ser el de `url`; se escribe para que
    // quede dicho. Todo lo demás —Stripe, WhatsApp, mapas— se abre fuera, en
    // el navegador del teléfono.
    allowNavigation: [servidor.host],

    // Dentro de `app-shell/`. Se sirve desde el origen local de la app, no
    // desde la web: lleva todo dentro, y la dirección a la que vuelve se la
    // escribe el sync (`scripts/app/destino.mjs`). En Android, además, la
    // abre MainActivity cuando falla el certificado, que Capacitor no cubre.
    errorPath: 'sin-conexion.html',
  },

  plugins: {
    // El de Capacitor 8 que gestiona las barras del sistema. Con objetivo
    // Android 16 el sistema obliga a dibujar de borde a borde y la barra de
    // estado deja de tener color propio: se ve lo que hay detrás, que es el
    // `windowBackground` del tema (crema, en `styles.xml`). Aquí solo se pide
    // que los iconos sean oscuros, también con el teléfono en modo oscuro: la
    // app tiene un solo modo, el claro.
    SystemBars: {
      style: 'LIGHT',
    },

    // `backgroundColor` solo vale hasta Android 14; desde el 15 lo de arriba.
    // `LIGHT` quiere decir «fondo claro, iconos oscuros».
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: CREMA,
      overlaysWebView: false,
    },

    // Se esconde sola a los 2,5 s, o antes si la web llega a montarse
    // (`src/components/app-nativa.tsx`). No se deja en manual: si no hay red
    // la web no llega, y la página de error no puede esconderla en Android.
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: CREMA,
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
