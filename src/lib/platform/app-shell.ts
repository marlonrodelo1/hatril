import { cookies, headers } from 'next/headers';

/**
 * "Modo app": ¿renderizamos la experiencia de app (barra inferior, sin
 * Royce, categorías con imagen…) en vez de la web normal?
 *
 * Es true si:
 *   - El User-Agent trae `HatrilApp/` (la app nativa Capacitor lo inyecta), o
 *   - Existe la cookie `app_shell=1` (para PREVISUALIZAR el modo app en el
 *     navegador durante el desarrollo, sin tener que compilar la app).
 *
 * La web pública normal NO trae ninguna de las dos → ve el diseño de siempre.
 */
export async function isAppShell(): Promise<boolean> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const ua = h.get('user-agent') ?? '';
  if (ua.includes('HatrilApp/')) return true;
  return c.get('app_shell')?.value === '1';
}
