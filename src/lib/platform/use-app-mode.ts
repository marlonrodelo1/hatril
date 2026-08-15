'use client';

import { useEffect, useState } from 'react';
import { isNativePlatform } from './native-client';

/**
 * Hook client-side: ¿estamos en "modo app"? (Capacitor nativo o cookie de
 * preview `app_shell=1`). Devuelve false en el primer render (SSR) y true tras
 * montar si aplica, para evitar desajustes de hidratación.
 */
export function useIsAppMode(): boolean {
  const [appMode, setAppMode] = useState(false);
  useEffect(() => {
    const cookie =
      typeof document !== 'undefined' &&
      document.cookie.split('; ').some((c) => c === 'app_shell=1');
    setAppMode(isNativePlatform() || cookie);
  }, []);
  return appMode;
}
