import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY no configurada');
  if (!_stripe) {
    _stripe = new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' as any });
  }
  return _stripe;
}

/**
 * Configuración de un intervalo de facturación dentro de un plan
 * (mensual o anual). El `precioMes` es el precio EFECTIVO al mes que el
 * dueño paga (útil para mostrar "27 €/mes facturado anual"). El
 * `precioCiclo` es el cargo real que Stripe hace por ciclo.
 */
export interface PrecioIntervalo {
  priceId: string | undefined;
  precioMes: number;
  precioCiclo: number;
}

export type IntervalPlan = 'mensual' | 'anual';
export type PlanId = 'basico' | 'plus';

export interface PlanConfig {
  id: PlanId;
  nombre: string;
  precios: Record<IntervalPlan, PrecioIntervalo>;
  /** Precio mostrado por defecto cuando no se especifica intervalo. */
  precio: number;
  /** priceId mensual — alias para retrocompatibilidad con código viejo. */
  priceId: string | undefined;
  features: string[];
  /** Solo Plus: nº mensajes WhatsApp incluidos antes de cobrar overage. */
  whatsappIncluidos?: number;
}

const BASICO_MENSUAL = 30;
const BASICO_ANUAL_TOTAL = 324; // 27 €/mes × 12 — ahorro 36 €/año (≈ 1,2 meses).
const BASICO_ANUAL_MES = BASICO_ANUAL_TOTAL / 12; // 27

const PLUS_MENSUAL = 39;
const PLUS_ANUAL_TOTAL = 421.2; // 35,10 €/mes × 12 — ahorro 46,8 €/año (10%).
const PLUS_ANUAL_MES = PLUS_ANUAL_TOTAL / 12; // 35,10

/** Precio del overage WhatsApp en EUR/msg para el Plan Plus. Lo cobra
 *  Stripe vía un metered price (usage records). Mostrarlo en la UI
 *  formateado con `OVERAGE_WHATSAPP_FMT` para precisión decimal. */
export const PRECIO_OVERAGE_WHATSAPP_EUR = 0.03;
export const OVERAGE_WHATSAPP_FMT = '0,030';
/** Mensajes WhatsApp incluidos en el Plan Plus antes de empezar a cobrar. */
export const WHATSAPP_INCLUIDOS_PLUS = 400;

/**
 * Price ID del metered overage en Stripe. Lo creas con
 *   pricing model = "Standard pricing"
 *   amount        = 0,030 €
 *   billing period = monthly
 *   usage is metered ✅
 *   aggregation    = sum of usage values
 *
 * Se añade como segundo item de la subscription Plus. No tiene quantity
 * (la consume `stripe.subscriptionItems.createUsageRecord`).
 */
export const STRIPE_PRICE_PLUS_OVERAGE = process.env.STRIPE_PRICE_PLUS_OVERAGE;

/**
 * Precio mensual por cada profesional adicional al primero (incluido en
 * el plan). Se cobra como un line item extra en la subscription del
 * salón vía Stripe seats (quantity-based con proration).
 *
 * Hay dos prices según el interval de la sub principal:
 *   - mensual: 7 €/mes por trabajador
 *   - anual:   84 €/año por trabajador (= 7 €/mes equivalente)
 *
 * El IGIC (7 %) va aparte: el tax rate de la subscription se hereda a
 * este line item, así que al dueño le aparecen 7,49 €/mes por seat.
 *
 * El dueño los crea en Stripe Dashboard y los expone en env vars.
 */
export const PRECIO_PROFESIONAL_EXTRA = 7;

/**
 * Profesionales incluidos en cada plan SIN coste de seat extra (contando
 * al dueño). El cobro de 7 €/mes por profesional adicional empieza a
 * partir de este número:
 *   - basico: 1 (solo el dueño)  → cobra desde el 2º profesional.
 *   - plus:   2 (dueño + 1)      → cobra desde el 3º profesional.
 */
export const PROFESIONALES_INCLUIDOS: Record<string, number> = {
  basico: 1,
  plus: 2,
};

/** Nº de profesionales incluidos para un plan dado (default 1). */
export function profesionalesIncluidos(
  plan: string | null | undefined,
): number {
  return PROFESIONALES_INCLUIDOS[plan ?? ''] ?? 1;
}

export const PRICE_PROFESIONAL_EXTRA = {
  mensual: process.env.STRIPE_PRICE_PROFESIONAL_EXTRA_MENSUAL,
  anual: process.env.STRIPE_PRICE_PROFESIONAL_EXTRA_ANUAL,
} as const;

/**
 * Precio del agente de voz al mes, SIN IGIC — igual que el resto de planes.
 * El 7 % se añade encima, heredado de `default_tax_rates` de la suscripción,
 * así que en la tarjeta del salón aparecen 63,13 €. Al contratar a mitad de
 * ciclo Stripe cobra solo la parte proporcional que queda.
 */
export const PRECIO_VOZ = 59;
/** Precio anual del agente de voz: 636 € = 53 €/mes, dos meses de regalo. */
export const PRECIO_VOZ_ANUAL = 636;
/** Equivalente mensual del anual, para poder enseñar el ahorro. */
export const PRECIO_VOZ_ANUAL_MES = Math.round((PRECIO_VOZ_ANUAL / 12) * 100) / 100;

/**
 * Add-on del agente de voz que contesta el teléfono del salón.
 *
 * Es una línea MÁS en la suscripción, no un plan: cualquier salón puede tenerlo
 * con Básico o con Plus. Su derecho a la feature vive en
 * `salones.stripe_voz_item_id`, NUNCA derivado de `plan` — ese es el fallo de
 * `whatsapp_activo`, que cualquier subscription.updated pisa a false.
 */
export const PRICE_VOZ = {
  mensual: process.env.STRIPE_PRICE_VOZ_MENSUAL,
  anual: process.env.STRIPE_PRICE_VOZ_ANUAL,
} as const;

/**
 * Tax Rate ID del IGIC (Impuesto General Indirecto Canario) — 7 %
 * exclusivo. Se aplica como `default_tax_rates` a la subscription que
 * crea el Checkout, y por herencia a cualquier line item que se añada
 * después (p. ej. seats de trabajadores extra).
 *
 * Configurado en Stripe Dashboard → Catálogo de productos → Tipos de
 * impuesto. Si está vacío, el checkout funciona pero no se cobra IGIC
 * (modo legacy para depurar). Producción Live: crear el Tax Rate
 * equivalente en el dashboard Live y poner ese ID aquí.
 */
export const STRIPE_TAX_RATE_IGIC = process.env.STRIPE_TAX_RATE_IGIC;

export const PLANES: Record<PlanId, PlanConfig> = {
  basico: {
    id: 'basico',
    nombre: 'Básico',
    precio: BASICO_MENSUAL,
    priceId: process.env.STRIPE_PRICE_BASIC,
    precios: {
      mensual: {
        priceId: process.env.STRIPE_PRICE_BASIC,
        precioMes: BASICO_MENSUAL,
        precioCiclo: BASICO_MENSUAL,
      },
      anual: {
        priceId: process.env.STRIPE_PRICE_BASIC_ANUAL,
        precioMes: BASICO_ANUAL_MES,
        precioCiclo: BASICO_ANUAL_TOTAL,
      },
    },
    features: [
      'Reserva por web personalizada con tu URL',
      'Recordatorios automáticos por email + Telegram',
      'Confirmación + liberación de huecos',
      'Lista de espera',
      'Personalización del agente (nombre, género, tono)',
      'Personalización de la web pública (promociones, galería, reseñas)',
      '1 profesional incluido · +7 €/mes por cada profesional adicional',
      'Servicios ilimitados',
      'Estadísticas y métricas',
      'Tienda online de cosmética con Stripe Connect (cobros directos al salón)',
    ],
  },
  plus: {
    id: 'plus',
    nombre: 'Plus',
    precio: PLUS_MENSUAL,
    priceId: process.env.STRIPE_PRICE_PLUS_MENSUAL,
    precios: {
      mensual: {
        priceId: process.env.STRIPE_PRICE_PLUS_MENSUAL,
        precioMes: PLUS_MENSUAL,
        precioCiclo: PLUS_MENSUAL,
      },
      anual: {
        priceId: process.env.STRIPE_PRICE_PLUS_ANUAL,
        precioMes: PLUS_ANUAL_MES,
        precioCiclo: PLUS_ANUAL_TOTAL,
      },
    },
    whatsappIncluidos: WHATSAPP_INCLUIDOS_PLUS,
    features: [
      'Todo lo del plan Básico',
      'Recordatorios + confirmaciones por WhatsApp interactivo',
      'Botones Confirmar / Cancelar en el chat del cliente',
      'Aviso instantáneo al dueño cuando confirma o cancela',
      `${WHATSAPP_INCLUIDOS_PLUS} mensajes WhatsApp incluidos al mes`,
      `Mensajes adicionales: ${OVERAGE_WHATSAPP_FMT} €/msg (≈ 3 céntimos)`,
      '2 profesionales incluidos · +7 €/mes por cada profesional adicional',
    ],
  },
};

/**
 * Ahorro total en euros por año al elegir el plan anual frente al mensual.
 * Útil para mostrar "Ahorra X € al año" en la UI.
 */
export function ahorroAnualPlan(planId: PlanId): number {
  const p = PLANES[planId];
  return p.precios.mensual.precioCiclo * 12 - p.precios.anual.precioCiclo;
}

/**
 * Dado un priceId de Stripe, devuelve el plan al que corresponde y el
 * interval. Útil en el webhook para mapear sub.items.data[].price.id →
 * `salones.plan`.
 */
export function planFromPriceId(
  priceId: string | null | undefined,
): { plan: PlanId; interval: IntervalPlan } | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANES)) {
    if (plan.precios.mensual.priceId === priceId) {
      return { plan: plan.id, interval: 'mensual' };
    }
    if (plan.precios.anual.priceId === priceId) {
      return { plan: plan.id, interval: 'anual' };
    }
  }
  return null;
}
