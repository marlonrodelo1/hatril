'use client';

/**
 * Salta a un elemento por id forzando además la "revelación" (.in) de la
 * sección destino y de todo lo que queda por encima de ella.
 *
 * Por qué: useReveal() usa un IntersectionObserver para añadir `.in` a los
 * elementos `.reveal` cuando entran al viewport. En iOS Safari y en el
 * WebView de la app (WKWebView) ese observer NO se dispara de forma fiable
 * durante un scroll PROGRAMÁTICO (`scrollIntoView`). Resultado: al saltar a
 * `#reservar` la sección destino se quedaba en `opacity:0` (en blanco) hasta
 * que el usuario tocaba la pantalla. Aquí marcamos `.in` nosotros mismos para
 * que el contenido esté visible sí o sí, en cualquier navegador.
 *
 * Es seguro: todos los `.reveal` de la web pública del salón tienen className
 * estático, así que React no reescribe el atributo class ni borra el `.in`
 * añadido imperativamente.
 */
export function revealAndScrollTo(
  id: string,
  behavior: ScrollBehavior = 'smooth',
): void {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(id);
  if (!target) return;

  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    const pos = target.compareDocumentPosition(el);
    const esAnterior = pos & Node.DOCUMENT_POSITION_PRECEDING;
    const estaDentro = pos & Node.DOCUMENT_POSITION_CONTAINED_BY;
    if (el === target || esAnterior || estaDentro) {
      el.classList.add('in');
    }
  });

  target.scrollIntoView({ behavior, block: 'start' });
}
