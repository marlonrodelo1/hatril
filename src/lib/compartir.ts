/**
 * Compartir un texto, y si hace falta un enlace a la web, con la hoja de
 * compartir del sistema: donde están el WhatsApp y el Telegram de la persona.
 * Hatril no manda nada a nadie: quien comparte elige a quién y por dónde.
 *
 * Esta es la de la web. La app empaquetada usa la suya
 * (`movil/src/shims/compartir.ts`, sustituida al compilar en
 * `movil/vite.config.ts`), y por eso los componentes que comparten llaman
 * aquí y no a `navigator.share`. Así se encontró (26-nov): «Invita a tu
 * iglesia» no hacía nada en el iPhone de Marlon. Dentro de la app,
 * `navigator.share` es lo que el WebView quiera dar —el de Android no lo
 * tiene—, y el enlace salía de `window.location.origin`, que en la app es
 * `capacitor://localhost`: aunque la hoja se hubiera abierto, habría
 * compartido una dirección que no abre nada fuera del teléfono.
 *
 * `ruta` es una ruta de la web (`/`, `/i/cuerpo-de-cristo`): cada lado le pone
 * su origen.
 */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'copiado' | 'fallo';

export async function compartir({
  titulo,
  texto,
  ruta,
}: {
  titulo?: string;
  texto: string;
  ruta?: string;
}): Promise<ResultadoCompartir> {
  const url = ruta === undefined ? undefined : new URL(ruta, window.location.origin).toString();

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titulo, text: texto, url });
      return 'compartido';
    } catch (e) {
      // Cerrar el menú del sistema es una respuesta, no un error.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
      // Cualquier otro fallo: se copia, que es lo que haría sin el menú.
    }
  }

  // En escritorio casi ningún navegador tiene el menú: se copia al portapapeles.
  try {
    await navigator.clipboard.writeText(url ? `${texto} ${url}` : texto);
    return 'copiado';
  } catch {
    return 'fallo';
  }
}
