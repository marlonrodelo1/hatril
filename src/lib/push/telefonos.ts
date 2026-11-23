import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { dispositivosPush } from '@/lib/db/schema';

/**
 * Apuntar y olvidar el teléfono de una cuenta para las push.
 *
 * Lo usan la action de la web (`./acciones.ts`, `./dispositivo.ts`) y la API
 * de la app (`/api/v1/app/push`). El detalle, en `docs/app-nativa/push.md`.
 *
 * Escribir solo se puede con `registrar_dispositivo_push(token, plataforma)`,
 * que saca la cuenta de `auth.uid()` y mueve el token si en ese teléfono entra
 * otra persona. Por eso va por `withUser`: la cuenta la pone la sesión, no
 * quien llama.
 */
export async function apuntarTelefono(
  authUserId: string,
  token: string,
  plataforma: 'ios' | 'android',
): Promise<void> {
  await withUser(authUserId, (tx) =>
    tx.execute(sql`select public.registrar_dispositivo_push(${token}, ${plataforma})`),
  );
}

/** Solo si el token es de esta cuenta: el `where` lleva las dos cosas. */
export async function olvidarTelefono(authUserId: string, token: string): Promise<void> {
  await withUser(authUserId, (tx) =>
    tx
      .delete(dispositivosPush)
      .where(and(eq(dispositivosPush.token, token), eq(dispositivosPush.authUserId, authUserId))),
  );
}
