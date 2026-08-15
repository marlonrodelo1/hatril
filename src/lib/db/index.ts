/**
 * Punto único de entrada a la base de datos.
 *
 * Hay dos puertas y hay que elegir una a conciencia:
 *
 *   - `withUser(authUserId, tx => …)` → la normal. Aplica la RLS.
 *   - `dbAdmin`                       → la salta. Crons, webhooks, super admin
 *                                       y el alta de iglesia.
 *
 * El porqué está explicado en `./client.ts`.
 */

export { dbAdmin } from './client';
export { withUser, withAnon } from './with-tenant';
export * from './schema';
