import type { CapacitorConfig } from '@capacitor/cli';

/**
 * La app nativa de Hatril (Android e iOS).
 *
 * LAS PANTALLAS VAN DENTRO DEL BINARIO (20-nov)
 * --------------------------------------------
 * Hasta el build 3 la app era un WebView que cargaba https://hatril.com. Desde
 * aquí es una SPA empaquetada, como Pidoo y Gonper socio: React + Vite en
 * `movil/`, compilada en `movil/dist`, que Capacitor mete en el binario. Solo
 * los datos viajan por la red, a la API de hatril.com (`/api/v1/app/*`). El
 * plan y sus porqués, en `docs/app-nativa/plan-spa.md`.
 *
 * Lo que eso cambia aquí:
 *
 *   - `webDir` es `movil/dist`, y ya no hay `server.url`, `appStartPath`,
 *     `allowNavigation` ni `errorPath`: no se carga ninguna web. La pantalla
 *     de «sin conexión» la pinta la propia app cuando la API no contesta.
 *   - La dirección de la API se mete al COMPILAR la SPA, no aquí. La pone
 *     `scripts/app/android.mjs` / `ios.mjs` a partir de `CAP_SERVER_URL`, con
 *     la misma exigencia de https de siempre:
 *
 *       CAP_SERVER_URL=https://hatril.com npm run app:android
 *
 *     No lances `npx cap sync` a mano: copiaría lo que haya en `movil/dist`,
 *     que puede ser una compilación contra otra dirección. Los scripts
 *     compilan primero y comprueban después que lo copiado lleve la buena.
 *   - Los enlaces que no son de la app (el panel, «Dar», la política) se abren
 *     fuera, en el navegador del teléfono: Capacitor entrega al sistema todo
 *     `target="_blank"` (`movil/src/lib/fuera.ts`).
 *
 * Lo nativo no cambia: push, Apple, Google, barra de estado y arranque.
 */

/**
 * Lo que la app añade a su User-Agent. Con la SPA el servidor ya no decide
 * pantallas por él, pero sigue diciendo en los registros qué versión pidió
 * cada cosa. La versión tiene que ser la de `versionName` en
 * `android/app/build.gradle`: el script de compilación lo comprueba.
 */
const AGENTE = 'HatrilApp/1.0.0';

/** `--hatril-bg-base` de `globals.css`. */
const CREMA = '#FAF9F5';

const config: CapacitorConfig = {
  appId: 'app.hatril',
  appName: 'Hatril',
  webDir: 'movil/dist',

  // Lo que se ve mientras la app arranca. Sin esto, un destello blanco.
  backgroundColor: CREMA,

  android: { appendUserAgent: AGENTE },
  ios: { appendUserAgent: AGENTE },

  server: {
    // El origen de la app en Android, `https://localhost`. Es el de serie en
    // Capacitor 8; se escribe porque la API lo tiene en su lista de CORS
    // (`src/lib/api/cors-app.ts`) y cambiarlo dejaría a la app sin datos.
    // En iOS el origen es `capacitor://localhost`, también en esa lista.
    androidScheme: 'https',
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

    // Se esconde en cuanto la app se monta (`src/components/app-nativa.tsx`,
    // que la SPA usa tal cual). Ya no hay que esperar a la red, pero se deja
    // el tope por si algo falla antes de montar.
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: CREMA,
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },

    // Con la app abierta, iOS no enseña el aviso si no se le pide: llegaría
    // y nadie lo vería. Sin `badge`: el número del icono no lo lleva nadie y
    // se quedaría marcando un aviso ya leído. Android lo enseña siempre.
    FirebaseMessaging: {
      presentationOptions: ['alert', 'sound'],
    },

    // Entrar con Apple y con Google (`movil/src/pantallas/acceso/acceso-nativo.tsx`).
    // Solo esos dos: el plugin trae Facebook y Twitter de serie, y su script de
    // `cap sync` los quita del binario si aquí van a `false`. El SDK de
    // Facebook en una app de iglesias sería un rastreador más que declarar en
    // las fichas de las tiendas, sin usarse.
    SocialLogin: {
      providers: { google: true, apple: true, facebook: false, twitter: false },
      logLevel: 1,
    },
  },

  // Lo pide el README del plugin: sin esto, el paquete de Firebase choca con
  // otro del mismo nombre al resolver las dependencias de Swift en el Mac.
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
};

export default config;
