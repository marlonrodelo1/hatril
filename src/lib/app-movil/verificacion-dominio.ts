import { APP_PACKAGE_ANDROID } from './deep-link';

/**
 * Datos para que Android e iOS acepten que gonperstudio.shop y la app son del
 * mismo dueño ("verificación de dominio"). Sin esto, un enlace normal
 * https://gonperstudio.shop/s/mi-salon compartido por WhatsApp abre el
 * navegador aunque el móvil tenga la app instalada.
 *
 * Los dos ficheros que lo hacen posible se sirven desde /.well-known/ y su
 * contenido sale de aquí:
 *   - assetlinks.json               → Android (App Links)
 *   - apple-app-site-association    → iOS (Universal Links)
 *
 * Los valores van por variable de entorno y NO tienen valor por defecto a
 * propósito: si se publica un fichero con una huella o un Team ID inventados,
 * Google y Apple lo cachean como "dominio no verificado" durante días. Sin las
 * variables, la ruta responde 404 — que es el estado correcto de "todavía no
 * configurado" y no envenena ninguna caché.
 *
 * Se reclama SOLO `/abrir/*`, y esto es deliberado.
 *
 * La tentación era reclamar también `/s/*`, que es la URL que la gente
 * comparte de verdad. El problema es que bajo /s/ no hay una página, hay
 * siete: la ficha, /reservar, /reservar/datos, /reservar/exito, /resena,
 * /resena/gracias y /flyer. Reclamar el prefijo entero se lo lleva TODO a la
 * app, y la app solo sabe abrir dos de ellas. El caso que lo tumba: el email
 * post-visita manda `/s/<slug>/resena?token=...`; si lo captura la app, que no
 * tiene pantalla de reseñas, el cliente se queda sin poder dejarla y sin forma
 * de volver al navegador.
 *
 * Android no permite afinar: `pathPattern` no sabe excluir la barra (no hay
 * clases de caracteres) y `pathAdvancedPattern` pide API 31, muy por encima de
 * nuestro minSdk 24. Así que la línea se traza donde es segura: `/abrir/*` es
 * una ruta que existe SOLO para esto y que la app entiende entera.
 *
 * Lo que se pierde: compartir `/s/mi-salon` por WhatsApp abre el navegador. Se
 * pierde poco — ahí está el banner con "Abrir en la app", que es un toque más.
 */

export const RUTAS_RECLAMADAS = ['/abrir/*'] as const;

/**
 * Huellas SHA-256 del certificado con el que se FIRMA el APK que instala la
 * gente. Con Play App Signing esa NO es la huella del keystore local: hay que
 * copiar la de Play Console → Integridad de la app → Firma de apps. Se admite
 * una lista separada por comas para poder incluir también la de subida (o una
 * de depuración) mientras se prueba.
 */
export function huellasAndroid(): string[] {
  return (process.env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((h) => h.trim().toUpperCase())
    .filter((h) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(h));
}

/** Team ID de Apple (App Store Connect → Membership). 10 caracteres. */
export function teamIdApple(): string | null {
  const id = (process.env.IOS_TEAM_ID ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(id) ? id : null;
}

/** Bundle ID de la app del cliente — coincide con el package de Android. */
export const BUNDLE_ID_IOS = APP_PACKAGE_ANDROID;

export function assetlinks() {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: APP_PACKAGE_ANDROID,
        sha256_cert_fingerprints: huellasAndroid(),
      },
    },
  ];
}

export function appleAppSiteAssociation(teamId: string) {
  const appID = `${teamId}.${BUNDLE_ID_IOS}`;
  return {
    applinks: {
      // `apps` vacío es obligatorio en el formato de Apple aunque no se use.
      apps: [],
      details: [
        {
          appIDs: [appID],
          components: RUTAS_RECLAMADAS.map((ruta) => ({ '/': ruta })),
          // `appID` + `paths` es el formato antiguo. Se mantiene porque iOS
          // 12 y anteriores ignoran `components` y no leerían nada.
          appID,
          paths: [...RUTAS_RECLAMADAS],
        },
      ],
    },
  };
}
