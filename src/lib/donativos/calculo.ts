/**
 * Las cuentas de la página de dar. Sin `server-only`: el formulario las usa
 * para enseñar el total mientras se escribe, y el servidor las vuelve a hacer
 * al abrir el pago. Lo que se cobra es SIEMPRE lo que calcula el servidor; lo
 * del navegador es solo para que la persona vea la cifra antes de pulsar.
 */

export const TIPOS_DONATIVO = ['diezmo', 'ofrenda'] as const;
export type TipoDonativo = (typeof TIPOS_DONATIVO)[number];

export const NOMBRE_TIPO: Record<TipoDonativo, string> = {
  diezmo: 'Diezmo',
  ofrenda: 'Ofrenda',
};

/** Hasta tres cosas en un pago: lo que se aprobó en la presentación. */
export const MAX_LINEAS = 3;

/** Por debajo de 1 € la comisión fija de Stripe se come la mitad. */
export const MINIMO_LINEA = 1;

/**
 * Tope por línea. No es una regla de Stripe: es que 10.000 € tecleados de una
 * vez en una página pública casi siempre son un cero de más, y la tarjeta lo
 * cobraría igual.
 */
export const MAXIMO_LINEA = 10_000;

/**
 * La tarifa de Stripe en España para tarjetas europeas, 1,5 % + 0,25 €
 * (stripe.com/es/pricing, consultado el 18-nov-2026). Solo sirve para la
 * casilla «Cubro la comisión»: lo que Stripe cobra de verdad se lee después
 * del cargo y se apunta tal cual en Finanzas.
 */
export const COMISION_PORCENTAJE = 0.015;
export const COMISION_FIJA = 0.25;

/**
 * Lo que hay que sumar para que, quitada la comisión, a la iglesia le llegue
 * `base` entera. No es `base * 1,5 % + 0,25`: la comisión se cobra también
 * sobre lo añadido, así que se despeja: `(base + fija) / (1 - %) - base`.
 * Redondeado hacia arriba al céntimo, para no quedarse corto por uno.
 */
export function comisionACubrir(base: number): number {
  if (!(base > 0)) return 0;
  const exacta = (base + COMISION_FIJA) / (1 - COMISION_PORCENTAJE) - base;
  return Math.ceil(Math.round(exacta * 10_000) / 100) / 100;
}

/** Euros a céntimos sin los decimales fantasma de la coma flotante. */
export function aCentimos(euros: number): number {
  return Math.round(euros * 100);
}

/** «50,00 €». Para el navegador y para el servidor, el mismo formato. */
export function formatearEuros(euros: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    // `es-ES` no agrupa los números de cuatro cifras («1240,00 €»): con esto,
    // «1.240,00 €», igual que las de cinco.
    useGrouping: 'always',
  }).format(euros);
}
