import { getPlatform, isNativePlatform } from '@/lib/platform/native-client';
import { destinoSeguro } from '@/lib/url/destino-seguro';
import { pedir } from './api';
import { supabase } from './supabase';

/**
 * Las push en la app. Es `src/components/push-nativo.tsx` con la API en vez
 * de la action: lo nativo (el plugin, el `AppDelegate`, el canal) no cambia.
 * El detalle, en `docs/app-nativa/push.md`.
 *
 * El token de ESTE teléfono se recuerda aquí, en memoria y en el
 * almacenamiento de la app, para poder borrarlo al salir (`./salir.ts`). En
 * la web eso lo hacía la cookie `hatril_push`.
 */
const CLAVE_TOKEN = 'hatril-push-token';

function tokenGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

function guardarToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento, al salir no se podrá borrar: lo limpia FCM.
  }
}

async function apuntar(token: string): Promise<void> {
  const plataforma = getPlatform();
  if (plataforma === 'web') return;
  // Firebase avisa de su token al arrancar, haya sesión o no. Sin sesión no
  // hay cuenta a la que apuntarlo: se apuntará al entrar
  // (`pedirPermisoYApuntar`). Probado en el emulador: sin esto, la app pedía
  // `/push` en la bienvenida.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await pedir('/push', { method: 'POST', datos: { token, plataforma } });
  guardarToken(token);
}

/**
 * Los oyentes, una vez por arranque. Tocar una push lleva a su `enlace`, que
 * es una ruta de la web y, por ser las mismas rutas, también de la app.
 * Devuelve la función que los quita.
 */
export function escucharPush(navegar: (ruta: string) => void, alLlegar: () => void): () => void {
  if (!isNativePlatform()) return () => {};

  let cancelado = false;
  const quitar: (() => void)[] = [];

  (async () => {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    if (cancelado) return;

    const oyentes = await Promise.all([
      FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
        const datos = (notification.data ?? {}) as { enlace?: unknown };
        navegar(destinoSeguro(datos.enlace) ?? '/mi/avisos');
      }),
      // Con la app abierta, que la campana se entere sin esperar.
      FirebaseMessaging.addListener('notificationReceived', () => alLlegar()),
      // Firebase cambia el token cuando quiere (reinstalar, borrar datos).
      FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
        void apuntar(token).catch(() => {});
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
}

/**
 * El permiso y el token. Solo con sesión: pedirlo en la bienvenida, antes de
 * saber qué es Hatril, es la forma segura de que digan que no, y en iOS no se
 * puede volver a preguntar.
 */
export async function pedirPermisoYApuntar(): Promise<void> {
  if (!isNativePlatform()) return;
  const { FirebaseMessaging, Importance } = await import('@capacitor-firebase/messaging');

  let { receive } = await FirebaseMessaging.checkPermissions();
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    ({ receive } = await FirebaseMessaging.requestPermissions());
  }
  if (receive !== 'granted') return;

  if (getPlatform() === 'android') {
    await FirebaseMessaging.createChannel({
      id: 'avisos',
      name: 'Avisos',
      description: 'Solicitudes, turnos y lo que pasa en el muro',
      importance: Importance.High,
    }).catch(() => {});
  }

  const { token } = await FirebaseMessaging.getToken();
  await apuntar(token);
}

/** Al salir: este teléfono deja de recibir los avisos de esta cuenta. */
export async function olvidarEsteTelefono(): Promise<void> {
  const token = tokenGuardado();
  if (!token) return;
  try {
    await pedir('/push', { method: 'DELETE', datos: { token } });
  } finally {
    guardarToken(null);
  }
}
