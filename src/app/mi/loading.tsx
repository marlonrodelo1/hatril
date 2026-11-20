/**
 * Lo que se ve en el instante de tocar una pestaña de abajo, mientras llega la
 * pantalla de verdad.
 *
 * POR QUÉ HACE FALTA (19-nov)
 * ---------------------------
 * Marlon, en el iPhone: Comunidad, Devocional, Agenda y Biblia «sí abren,
 * pero tardan como 2 segundos». Cada pestaña se pinta en el servidor con su
 * sesión y sus consultas, y sin este fichero Next no enseña NADA hasta tenerla
 * entera: el dedo toca, la pestaña no se mueve, y parece que no ha hecho caso.
 * Con él, Next tiene este esqueleto ya precargado (los `<Link>` de la barra lo
 * piden por adelantado) y cambia de pantalla al momento; el contenido entra en
 * cuanto llega. La barra de abajo vive en el layout, fuera de esto, así que la
 * pestaña elegida se marca en el mismo toque.
 *
 * Imita la cabecera de `CabeceraMiembro` y unas tarjetas, sin pretender ser
 * ninguna pantalla en concreto: es un instante, y un hueco con la forma de la
 * cabecera evita el salto cuando llega la de verdad.
 */
export default function Cargando() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col">
      <span className="sr-only">Cargando…</span>

      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[620px] items-center gap-3 px-4 py-3 sm:px-5">
          <Bloque className="size-9 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bloque className="h-3.5 w-24" />
            <Bloque className="h-2.5 w-36" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Bloque className="size-9 rounded-full" />
            <Bloque className="size-9 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 pt-4 sm:px-5">
        <Bloque className="h-24 rounded-xl" />
        <Bloque className="h-40 rounded-xl" />
        <Bloque className="h-28 rounded-xl" />
      </div>
    </div>
  );
}

/** Un hueco gris claro que late despacio; quieto si se piden menos movimientos. */
function Bloque({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={'block animate-pulse rounded-md bg-surface-active motion-reduce:animate-none ' + className}
    />
  );
}
