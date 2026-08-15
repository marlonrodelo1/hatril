export { captureException, captureMessage } from './sentry';
export { track, identify } from './posthog';

import { captureException } from './sentry';
import { track } from './posthog';

/**
 * Envuelve una server action añadiendo tracking en PostHog y captura de
 * excepciones en Sentry. Si la función falla, registra el error y re-lanza.
 *
 * Uso:
 * ```ts
 * export async function crearCita(...) {
 *   return wrapServerAction('crearCita', async () => {
 *     // ...lógica...
 *   });
 * }
 * ```
 */
export async function wrapServerAction<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  await track('server_action_called', { name });
  try {
    const result = await fn();
    await track('server_action_success', { name });
    return result;
  } catch (err) {
    await captureException(err, { action: name });
    throw err;
  }
}
