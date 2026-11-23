import 'server-only';

import type { UserContext } from '@/lib/auth/user-context';

/**
 * El contexto de quien pide, recortado a lo que pintan las vistas que la app
 * comparte con la web.
 *
 * Las vistas de `/mi/equipo` reciben `ctx` porque la web se lo pasa entero, y
 * la API no debe mandarlo tal cual al teléfono: lleva el objeto de usuario de
 * Supabase entero y datos de la iglesia que la pantalla no usa (el plan, la
 * suscripción de Stripe). Aquí va lo que se pinta —el nombre de la iglesia, su
 * zona, su moneda, su logo, la ficha y el nombre de la cuenta— y nada más. Si
 * una vista empieza a usar otro campo de `ctx`, se añade aquí a propósito.
 */
export function ctxParaLaApp(ctx: UserContext): UserContext {
  const recortado = {
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      user_metadata: { nombre: ctx.user.user_metadata?.nombre },
    },
    iglesia: {
      id: ctx.iglesia.id,
      nombre: ctx.iglesia.nombre,
      slug: ctx.iglesia.slug,
      timezone: ctx.iglesia.timezone,
      moneda: ctx.iglesia.moneda,
      logoUrl: ctx.iglesia.logoUrl,
    },
    miembroId: ctx.miembroId,
  };
  // El tipo dice `UserContext` porque es lo que esperan las vistas; lo que
  // viaja es solo lo de arriba.
  return recortado as unknown as UserContext;
}
