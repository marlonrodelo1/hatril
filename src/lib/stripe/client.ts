import 'server-only';

import Stripe from 'stripe';

/**
 * Cliente de Stripe y catálogo de planes.
 *
 * SIN `apiVersion`
 * ----------------
 * El SDK ya fija la versión con la que fue generado (v22.5 → `2026-07-29.dahlia`)
 * y sus tipos corresponden a esa. Gonper escribe
 * `new Stripe(key, { apiVersion: '2024-12-18.acacia' as any })`: fija una
 * versión de hace año y medio y silencia con `as any` el error que avisa de que
 * los tipos ya no encajan. Es decir, apaga justo la comprobación que le diría
 * que el objeto que recibe no tiene la forma que el código supone.
 *
 * Omitirlo es lo correcto: el SDK y los tipos van a una.
 */

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripe) return stripe;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error('Falta STRIPE_SECRET_KEY.');
  }

  stripe = new Stripe(apiKey, {
    // Reintentos ante fallos de red. Stripe es idempotente en las operaciones
    // que importan, así que reintentar es seguro y evita que un corte de dos
    // segundos deje a una iglesia sin poder suscribirse.
    maxNetworkRetries: 2,
    telemetry: false,
  });

  return stripe;
}

/** Planes de pago. `trial` y `cancelado` son estados, no planes comprables. */
export type PlanId = 'esencial' | 'comunidad' | 'plus';
export type Periodicidad = 'mensual' | 'anual';

export interface PlanConfig {
  id: PlanId;
  nombre: string;
  /** Para quién es, en una línea, tal como se lee en la pantalla de precios. */
  para: string;
  /** Tope de fichas de miembro. `null` = sin tope. */
  limiteMiembros: number | null;
  incluye: string[];
  precios: Record<Periodicidad, { priceId: string | undefined }>;
}

/**
 * EL PRECIO NO ESTÁ AQUÍ, Y ES DELIBERADO
 * ---------------------------------------
 * Solo viven los identificadores de precio de Stripe, que salen de variables de
 * entorno. La cifra vive en el panel de Stripe.
 *
 * El motivo es de negocio, no de arquitectura: la competencia directa
 * (ekklesiaonline.app, Ekklesia Web, ChurchTrac) va de 9 a 70 USD al mes
 * escalados por número de miembros, y una iglesia colombiana media tiene un
 * presupuesto muy distinto al de una española. Ese precio se va a ajustar
 * varias veces después de las primeras conversaciones de venta, y cada ajuste
 * no puede costar un despliegue.
 *
 * Gonper tiene los importes escritos en el código (`30`, `39`, `7`, `59`).
 * Funciona porque su precio ya está validado; el de Hatril no lo está.
 *
 * El escalado por número de miembros es el modelo que usa todo el sector, y
 * encaja: una iglesia de 40 personas y una de 800 no obtienen el mismo valor
 * del mismo producto.
 */
export const PLANES: Record<PlanId, PlanConfig> = {
  esencial: {
    id: 'esencial',
    nombre: 'Esencial',
    para: 'Congregaciones que empiezan a organizarse',
    limiteMiembros: 100,
    incluye: [
      'Hasta 100 personas',
      'Miembros y ministerios',
      'Página pública de la iglesia',
      'Dos personas en el equipo',
    ],
    precios: {
      mensual: { priceId: process.env.STRIPE_PRICE_ESENCIAL_MENSUAL },
      anual: { priceId: process.env.STRIPE_PRICE_ESENCIAL_ANUAL },
    },
  },
  comunidad: {
    id: 'comunidad',
    nombre: 'Comunidad',
    para: 'La mayoría de las iglesias',
    limiteMiembros: 400,
    incluye: [
      'Hasta 400 personas',
      'Todo lo del plan Esencial',
      'Equipo sin límite, con permisos por rol',
      'Solicitudes de ingreso desde el directorio',
    ],
    precios: {
      mensual: { priceId: process.env.STRIPE_PRICE_COMUNIDAD_MENSUAL },
      anual: { priceId: process.env.STRIPE_PRICE_COMUNIDAD_ANUAL },
    },
  },
  plus: {
    id: 'plus',
    nombre: 'Plus',
    para: 'Congregaciones grandes',
    limiteMiembros: null,
    incluye: [
      'Personas sin límite',
      'Todo lo del plan Comunidad',
      'Dominio propio',
      'Registro de accesos a datos protegidos',
    ],
    precios: {
      mensual: { priceId: process.env.STRIPE_PRICE_PLUS_MENSUAL },
      anual: { priceId: process.env.STRIPE_PRICE_PLUS_ANUAL },
    },
  },
};

/**
 * Del identificador de precio de Stripe de vuelta al plan.
 *
 * Lo necesita el webhook: los eventos de suscripción traen el `price.id`, no el
 * nombre del plan. Sin esta vuelta, habría que guardar el plan solo desde los
 * metadatos del Checkout —y los cambios de plan hechos desde el portal de
 * cliente de Stripe no pasan por ahí, así que la iglesia acabaría pagando un
 * plan y disfrutando de otro.
 */
export function planDesdePriceId(priceId: string): PlanId | null {
  for (const plan of Object.values(PLANES)) {
    for (const { priceId: id } of Object.values(plan.precios)) {
      if (id && id === priceId) return plan.id;
    }
  }
  return null;
}

/**
 * Comprueba al arrancar que los seis identificadores de precio están puestos.
 *
 * Un `priceId` a `undefined` no falla al desplegar: falla cuando una iglesia
 * pulsa «suscribirme», que es el peor momento posible para enterarse.
 */
export function preciosConfigurados(): { ok: boolean; faltan: string[] } {
  const faltan: string[] = [];

  for (const plan of Object.values(PLANES)) {
    for (const [periodo, { priceId }] of Object.entries(plan.precios)) {
      if (!priceId) faltan.push(`${plan.id}/${periodo}`);
    }
  }

  return { ok: faltan.length === 0, faltan };
}
