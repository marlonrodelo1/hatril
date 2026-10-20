'use client';

import { useEffect } from 'react';

import { isNativePlatform } from '@/lib/platform/native-client';

/** `--hatril-bg-base` de globals.css. */
const CREMA = '#faf9f5';

/**
 * Lo que hace que la app no parezca una web metida en una caja: el botón atrás
 * de Android, la barra de estado y el final del arranque.
 *
 * Va montado UNA vez, en el layout raíz y no en el de `/mi`: dentro de la app
 * también se pasa por el acceso y por el panel, y ahí el botón atrás tiene que
 * funcionar igual.
 *
 * EN LA WEB NO HACE NADA, NI SE DESCARGA
 * --------------------------------------
 * Antes de nada mira `window.Capacitor`, que solo existe dentro del WebView
 * nativo. Los plugins se importan dentro del efecto, así que van en un trozo
 * aparte que el navegador de un ordenador no llega a pedir.
 */
export function AppNativa() {
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelado = false;
    let quitarAtras: (() => void) | undefined;

    (async () => {
      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
      ]);
      if (cancelado) return;

      // Iconos oscuros sobre crema. El color de fondo solo lo respeta Android
      // hasta el 14 (desde el 15 manda el tema, ver styles.xml) y iOS no lo
      // tiene: los dos fallos se tragan, que no hay nada que hacer con ellos.
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: CREMA }).catch(() => {});

      // La web ya está aquí: fuera el arranque sin esperar a que caduque solo.
      SplashScreen.hide().catch(() => {});

      // Al registrar el oyente, Android deja de hacer nada por su cuenta con
      // el botón: a partir de aquí todo lo decide esta función.
      const oyente = await App.addListener('backButton', ({ canGoBack }) => {
        if (cerrarLoQueFlota()) return;
        if (canGoBack) window.history.back();
        else App.exitApp();
      });

      if (cancelado) oyente.remove();
      else quitarAtras = () => void oyente.remove();
    })().catch(() => {
      // Si un plugin falla, la app sigue siendo la web: peor atrás, pero usable.
    });

    return () => {
      cancelado = true;
      quitarAtras?.();
    };
  }, []);

  return null;
}

/**
 * Con una hoja, un diálogo o un menú abiertos, atrás los cierra en vez de
 * cambiar de pantalla, que es lo que espera cualquiera en Android.
 *
 * Base UI marca lo que está abierto con `data-open` y lo cierra con Escape,
 * así que basta con mandarle un Escape. Se manda al elemento con el foco, que
 * está dentro de lo abierto, y sube hasta el documento, que es donde escucha.
 */
function cerrarLoQueFlota(): boolean {
  const abierto = document.querySelector(
    '[data-open]:is([role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"])',
  );
  if (!abierto) return false;

  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
  return true;
}
