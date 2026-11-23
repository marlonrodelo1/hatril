import { z } from 'zod';

/**
 * Contrato de `/api/v1/app/push` y de la action `registrarDispositivo`.
 * Un token de FCM son letras, cifras, dos puntos, guiones y guiones bajos.
 */
export const EsquemaTokenPush = z.string().min(20).max(4096).regex(/^[A-Za-z0-9:_-]+$/);

export const EsquemaTelefonoPush = z.object({
  token: EsquemaTokenPush,
  plataforma: z.enum(['ios', 'android']),
});

export const EsquemaOlvidarPush = z.object({ token: EsquemaTokenPush });
