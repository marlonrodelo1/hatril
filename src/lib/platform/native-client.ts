'use client';

/**
 * Detección client-side de Capacitor para UI condicional (status bar, botón
 * atrás, avisos "instala la app", etc.).
 *
 * Leemos `window.Capacitor` directamente en vez de importar `@capacitor/core`
 * para que el build web NO dependa del paquete (se instala en el Bloque A).
 * Con guard de `typeof window` para que sea seguro en SSR.
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Capacitor?: CapacitorGlobal };
  return w.Capacitor ?? null;
}

/** True si corremos dentro de la app nativa (Android/iOS). */
export function isNativePlatform(): boolean {
  return getCapacitor()?.isNativePlatform?.() ?? false;
}

/** 'ios' | 'android' | 'web'. */
export function getPlatform(): 'ios' | 'android' | 'web' {
  const p = getCapacitor()?.getPlatform?.() ?? 'web';
  return p === 'ios' || p === 'android' ? p : 'web';
}
