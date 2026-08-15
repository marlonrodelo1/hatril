/**
 * Estado de la suscripción de un salón. FUENTE ÚNICA DE VERDAD.
 *
 * Esta lógica vivía como función local dentro de `src/app/panel/layout.tsx`, así
 * que solo la aplicaba el panel web. La app del negocio no la miraba por ningún
 * lado: un salón con la prueba vencida seguía trabajando con normalidad desde el
 * móvil mientras la web le cerraba la puerta. Sale aquí para que las dos
 * superficies —y cualquier futura— decidan con el MISMO criterio.
 *
 * No lleva `server-only`: son cuentas sobre campos que la app ya recibe en
 * `/api/panel-app/me`, y la pantalla del móvil necesita poder repetirlas para
 * pintar el aviso sin esperar a que el servidor le diga que no.
 */

/** Planes de pago. Cualquier otro valor ('trial', 'cancelado', ...) no lo es. */
export const PLANES_ACTIVOS = new Set(['basico', 'plus', 'solo', 'studio', 'pro']);

/** Precio mensual por plan, para el texto del aviso de cortesía. */
const PRECIO_POR_PLAN: Record<string, number> = {
  basico: 30,
  plus: 39,
  pro: 49,
  solo: 19,
  studio: 59,
};

export interface EstadoSuscripcion {
  trialExpirado: boolean;
  planActivo: boolean;
  sinSuscripcion: boolean;
  diasRestantesTrial: number | null;
  /**
   * Caso "plan de cortesía": el salón está en plan='plus' (o similar) sin
   * suscripción Stripe activa, vinculado a un `trial_until` futuro. Son cuentas
   * activadas a mano que aún deben meter tarjeta. Con este flag el aviso
   * menciona el plan concreto y su precio en vez del texto genérico de prueba.
   */
  planCortesia: { plan: string; precioMensual: number } | null;
}

/**
 * Acepta tanto la fila de Drizzle (`trialUntil`, `stripeSubscriptionId`) como la
 * forma cruda de Supabase (`trial_until`, `stripe_subscription_id`), porque el
 * panel web lee el salón por una vía y la app por otra.
 */
type SalonLike = Record<string, unknown> | null | undefined;

function comoFecha(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function leerEstadoSuscripcion(salon: SalonLike): EstadoSuscripcion {
  if (!salon) {
    return {
      trialExpirado: false,
      planActivo: false,
      sinSuscripcion: false,
      diasRestantesTrial: null,
      planCortesia: null,
    };
  }

  const plan = typeof salon.plan === 'string' ? salon.plan : null;
  const subscriptionId =
    (salon.stripe_subscription_id as string | null | undefined) ??
    (salon.stripeSubscriptionId as string | null | undefined) ??
    null;
  const trialUntilRaw = salon.trial_until ?? salon.trialUntil ?? null;

  const enPlanDePago = plan != null && PLANES_ACTIVOS.has(plan);

  // Plan de cortesía: plan de pago SIN suscripción Stripe pero con plazo aún
  // válido. Se trata como una prueba extendida sobre ese plan.
  if (enPlanDePago && !subscriptionId && trialUntilRaw) {
    const fin = comoFecha(trialUntilRaw);
    if (fin) {
      const ms = fin.getTime() - Date.now();
      const expirado = ms <= 0;
      const dias = expirado ? 0 : Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
      return {
        trialExpirado: expirado,
        planActivo: false, // si vence, queremos bloquear
        sinSuscripcion: expirado,
        diasRestantesTrial: expirado ? 0 : dias,
        planCortesia: expirado
          ? null
          : { plan, precioMensual: PRECIO_POR_PLAN[plan] ?? 30 },
      };
    }
  }

  // Plan de pago con Stripe al día → libre.
  if (enPlanDePago) {
    return {
      trialExpirado: false,
      planActivo: true,
      sinSuscripcion: false,
      diasRestantesTrial: null,
      planCortesia: null,
    };
  }

  // Prueba gratuita: no se bloquea mientras `trial_until` esté en el futuro.
  if (plan === 'trial' && trialUntilRaw) {
    const fin = comoFecha(trialUntilRaw);
    if (fin) {
      const ms = fin.getTime() - Date.now();
      const expirado = ms <= 0;
      const dias = expirado ? 0 : Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
      return {
        trialExpirado: expirado,
        planActivo: false,
        sinSuscripcion: false,
        diasRestantesTrial: expirado ? 0 : dias,
        planCortesia: null,
      };
    }
  }

  // Sin prueba válida y sin Stripe activo → bloquear. Cubre el plan
  // 'cancelado' (Stripe dio de baja), el trial sin fecha y las cuentas viejas.
  return {
    trialExpirado: true,
    planActivo: false,
    sinSuscripcion: !subscriptionId,
    diasRestantesTrial: 0,
    planCortesia: null,
  };
}

/**
 * ¿Puede este salón seguir operando? Es el criterio que aplica el muro del panel
 * web y, desde ahora, la API de la app.
 */
export function suscripcionBloquea(estado: EstadoSuscripcion): boolean {
  return estado.trialExpirado && !estado.planActivo;
}

/**
 * Etiqueta corta del estado, en castellano y para el dueño. La app la pintaba
 * por su cuenta y le decía "Cuenta activa · Tienes todo en marcha" a un salón
 * CANCELADO; el texto se decide aquí para que no vuelva a pasar.
 */
export function etiquetaEstadoSuscripcion(estado: EstadoSuscripcion): {
  tono: 'ok' | 'aviso' | 'alerta';
  titulo: string;
  detalle: string;
} {
  if (estado.planActivo) {
    return {
      tono: 'ok',
      titulo: 'Cuenta activa',
      detalle: 'Tu suscripción está al día.',
    };
  }
  if (suscripcionBloquea(estado)) {
    return {
      tono: 'alerta',
      titulo: 'Cuenta sin suscripción',
      detalle:
        'Tu acceso está limitado. Activa la suscripción para volver a usarlo con normalidad.',
    };
  }
  const dias = estado.diasRestantesTrial ?? 0;
  const cuenta = dias === 1 ? 'Queda 1 día' : `Quedan ${dias} días`;
  if (estado.planCortesia) {
    return {
      tono: 'aviso',
      titulo: `${cuenta} de cortesía`,
      detalle: `Después se cobrarán ${estado.planCortesia.precioMensual} €/mes por el plan ${estado.planCortesia.plan}.`,
    };
  }
  return {
    tono: 'aviso',
    titulo: `${cuenta} de prueba`,
    detalle: 'Activa la suscripción antes de que termine para no perder el acceso.',
  };
}
