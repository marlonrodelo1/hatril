import { cn } from '@/lib/utils';

/**
 * Las tres piezas que repiten las cinco pantallas de acceso: el encabezado, la
 * tarjeta del formulario y los caminos de al lado.
 *
 * Están aquí y no copiadas en cada página porque son la cara de la app nativa
 * —lo primero que se ve al abrirla—, y una diferencia de dos píxeles entre
 * «Entrar» y «Crear cuenta» se nota justo al pasar de una a otra.
 */

/** Título y una frase, centrados encima de la tarjeta. */
export function Encabezado({
  titulo,
  children,
}: {
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <h1 className="t-titulo text-balance">{titulo}</h1>
      {children && (
        <p className="max-w-[36ch] text-body leading-relaxed text-pretty text-muted-foreground">
          {children}
        </p>
      )}
    </header>
  );
}

/**
 * El formulario va en tarjeta, nunca suelto sobre el crema (regla de la guía
 * visual). El aviso de error va dentro, arriba: pegado a los campos que lo
 * provocan y no flotando entre el título y la tarjeta.
 */
export function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 sm:p-6">
      {children}
    </section>
  );
}

/** Los otros caminos («crear cuenta», «volver»), discretos y debajo. */
export function Caminos({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center text-body text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * Enlace de texto con el foco bien visible.
 *
 * El contorno global es el naranja al 30 %, que sobre el crema casi no se ve;
 * quien recorre la pantalla con el teclado tiene que saber dónde está.
 */
export const claseEnlace =
  'rounded-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring';

/**
 * El botón de enviar ocupa la tarjeta entera: en el móvil es la zona que se
 * pulsa con el pulgar, y en una tarjeta de 400 px un botón corto se queda
 * colgando a un lado. Y el foco, separado del relleno: el anillo de serie es
 * naranja sobre naranja.
 */
export function claseEnviar(className?: string) {
  return cn(
    'w-full focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    className,
  );
}
