import { Share } from '@capacitor/share';

import { WEB_URL } from '@movil/lib/entorno';

/**
 * `compartir` dentro de la app: la hoja de compartir NATIVA (`@capacitor/share`),
 * y el enlace siempre a la web pública. Se sustituye al compilar
 * (`movil/vite.config.ts`); el porqué está en la de la web, `src/lib/compartir.ts`.
 *
 * Con `npm run movil:dev`, en un navegador, el plugin cae en su versión web
 * (`navigator.share`), y si el navegador no la tiene, se copia.
 */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'copiado' | 'fallo';

/** Cerrar la hoja: el plugin lo rechaza con «Share canceled» en iOS y Android. */
function esCancelacion(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  const mensaje = e instanceof Error ? e.message : String(e);
  return /cancel|in progress/i.test(mensaje);
}

export async function compartir({
  titulo,
  texto,
  ruta,
}: {
  titulo?: string;
  texto: string;
  ruta?: string;
}): Promise<ResultadoCompartir> {
  const url = ruta === undefined ? undefined : new URL(ruta, `${WEB_URL}/`).toString();

  try {
    await Share.share({ title: titulo, text: texto, url, dialogTitle: titulo });
    return 'compartido';
  } catch (e) {
    if (esCancelacion(e)) return 'cancelado';
  }

  try {
    await navigator.clipboard.writeText(url ? `${texto} ${url}` : texto);
    return 'copiado';
  } catch {
    return 'fallo';
  }
}
