import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Formularios: una maqueta y una altura de campo en todo el producto.
 *
 * Había tres maquetas (campos sueltos sobre el crema, tarjetas, columnas) y
 * seis alturas de campo (inventario, A7). Ahora:
 *
 *   <HojaFormulario>
 *     <Bloque titulo="Lo básico" descripcion="Lo que lee alguien que…">
 *       <Campo etiqueta="Título" htmlFor="titulo" error={errores.titulo}>
 *         <Input id="titulo" name="titulo" />
 *       </Campo>
 *     </Bloque>
 *     <PieFormulario>…botones…</PieFormulario>
 *   </HojaFormulario>
 *
 * El campo en sí es `<Input>` (40 px, 16 px de letra en el móvil para que
 * Safari no amplíe): aquí solo va lo que lo rodea.
 *
 * EL ERROR VA PEGADO AL CAMPO, Y CON ICONO
 * ----------------------------------------
 * Debajo del campo que falla y no arriba del formulario, y siempre con icono:
 * el rojo de error y el naranja de marca son vecinos de tono (regla 2). El
 * error sustituye a la ayuda mientras está, para no apilar dos líneas.
 *
 * `clsx` y no `cn`: `text-label` junto a un color de texto, y `tailwind-merge`
 * se comería el tamaño.
 */
export function Campo({
  etiqueta,
  htmlFor,
  opcional = false,
  ayuda,
  error,
  className,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  opcional?: boolean;
  ayuda?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline gap-1.5 text-label font-semibold"
      >
        {etiqueta}
        {opcional && (
          <span className="font-medium text-muted-foreground">opcional</span>
        )}
      </label>
      {children}
      {error ? (
        <span
          role="alert"
          className="anim-aparece flex items-center gap-1.5 text-label font-semibold text-badge-danger-fg"
        >
          <CircleAlert className="size-[15px] flex-none" strokeWidth={1.9} />
          {error}
        </span>
      ) : ayuda ? (
        <span className="text-label text-pretty text-muted-foreground">
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Un bloque del formulario: su título y una frase a la izquierda, los campos
 * a la derecha. En el móvil, apilado.
 */
export function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-border p-5 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold">{titulo}</h2>
        {descripcion && (
          <p className="text-label text-pretty text-muted-foreground">
            {descripcion}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** La tarjeta que reúne los bloques de un formulario. */
export function HojaFormulario({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col rounded-xl border border-border bg-surface',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Los botones del final, a la derecha: el de enviar, el último. */
export function PieFormulario({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border px-5 py-4 md:px-6">
      {children}
    </div>
  );
}
