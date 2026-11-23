'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { getPlatform, isNativePlatform } from '@/lib/platform/native-client';
import { destinoSeguro } from '@/lib/url/destino-seguro';
import { registrarDispositivo } from '@/lib/push/acciones';

/**
 * Las notificaciones push dentro de la app: pedir permiso, apuntar el teléfono
 * y abrir la pantalla del aviso al tocarlo.
 *
 * EN EL LAYOUT RAÍZ, Y NO EN EL DE `/mi`
 * -------------------------------------
 * Por los oyentes. Si la app estaba cerrada y se abre tocando una push, el
 * plugin guarda ese toque hasta que alguien escucha: tiene que haber un oyente
 * pase lo que pase en la primera pantalla, y la primera puede ser el acceso.
 *
 * EL PERMISO, SOLO CON SESIÓN
 * ---------------------------
 * Pedirlo en la bienvenida, antes de saber qué es Hatril, es la forma segura
 * de que digan que no, y en iOS no se puede volver a preguntar. Se pide la
 * primera vez que se pisa `/mi` o `/panel`, que sin sesión redirigen al
 * acceso: estar ahí es estar dentro.
 *
 * En la web no hace nada, ni se descarga: el plugin se importa dentro del
 * efecto, después de comprobar que esto es la app (como `app-nativa.tsx`).
 */
export function PushNativo() {
  const router = useRouter();
  const ruta = usePathname();
  const apuntado = useRef(false);

  // Los oyentes, una vez por arranque de la app.
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelado = false;
    const quitar: (() => void)[] = [];

    (async () => {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      if (cancelado) return;

      const oyentes = await Promise.all([
        // Tocar la push: a la pantalla del aviso. La ruta viene del servidor,
        // pero se valida igual: es lo que hay escrito dentro de un mensaje.
        FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
          const datos = (notification.data ?? {}) as { enlace?: unknown };
          router.push(destinoSeguro(datos.enlace) ?? '/mi/avisos');
        }),
        // Con la app abierta, que la campana se entere sin recargar.
        FirebaseMessaging.addListener('notificationReceived', () => router.refresh()),
        // Firebase cambia el token cuando quiere (reinstalar, borrar datos).
        FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
          void registrarDispositivo(token, getPlatform()).catch(() => {});
        }),
      ]);

      if (cancelado) oyentes.forEach((o) => void o.remove());
      else quitar.push(...oyentes.map((o) => () => void o.remove()));
    })().catch(() => {
      // Sin Firebase (un build sin el plist), la app sigue: sin avisos.
    });

    return () => {
      cancelado = true;
      quitar.forEach((q) => q());
    };
  }, [router]);

  // El permiso y el token, la primera vez que se entra con sesión.
  useEffect(() => {
    if (apuntado.current || !isNativePlatform()) return;
    if (!ruta.startsWith('/mi') && !ruta.startsWith('/panel')) return;
    apuntado.current = true;

    (async () => {
      const { FirebaseMessaging, Importance } = await import('@capacitor-firebase/messaging');

      let { receive } = await FirebaseMessaging.checkPermissions();
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        ({ receive } = await FirebaseMessaging.requestPermissions());
      }
      if (receive !== 'granted') return;

      // El canal de Android al que apunta el AndroidManifest. Crearlo otra vez
      // no cambia nada: si ya existe, Android se queda con lo que eligió la
      // persona (sonido, silencio).
      if (getPlatform() === 'android') {
        await FirebaseMessaging.createChannel({
          id: 'avisos',
          name: 'Avisos',
          description: 'Solicitudes, turnos y lo que pasa en el muro',
          importance: Importance.High, // suena y asoma arriba
        }).catch(() => {});
      }

      const { token } = await FirebaseMessaging.getToken();
      await registrarDispositivo(token, getPlatform());
    })().catch(() => {
      // Sin red o sin Firebase: se reintenta en el siguiente arranque.
      apuntado.current = false;
    });
  }, [ruta]);

  return null;
}
