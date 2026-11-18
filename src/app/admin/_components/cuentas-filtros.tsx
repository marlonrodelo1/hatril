import Link from 'next/link';
import { clsx } from 'clsx';

/**
 * Los filtros con su número de `/admin`: «Todas 14», «Super admin 2»…
 *
 * Nació para Cuentas y lo usa también Registro; el nombre del fichero es por
 * dónde nació, no por lo que hace.
 *
 * ENLACES Y NO BOTONES
 * --------------------
 * El filtro se aplica en el servidor (`?ver=`, `?tipo=`), así que cada
 * pastilla es un enlace a la misma pantalla con otro parámetro: se puede
 * copiar, volver atrás con el navegador y funciona sin JavaScript. El número
 * viene ya contado de la página. `aria-current` dice cuál está puesto.
 *
 * EL ELEGIDO VA EN CARBÓN
 * -----------------------
 * Es lo que aprobó Marlon en la zona 4 del rediseño, y no el
 * `bg-accent` de la regla de selección de la guía. Van justo encima de una
 * lista cuyas insignias son de tonos suaves —«Super admin» en naranja suave—,
 * y un filtro relleno de carbón no se confunde con ninguna. El número del
 * elegido va en `support-muted-foreground`, el gris claro que existe para ir
 * sobre el carbón.
 *
 * `clsx` y no `cn`: `text-label` junto a un color de texto, y `tailwind-merge`
 * se comería el tamaño.
 */
export type OpcionFiltro = {
  href: string;
  texto: string;
  n: number;
  activa: boolean;
};

export function Filtros({
  etiqueta,
  opciones,
}: {
  /** Para el lector de pantalla: «Filtrar las cuentas». */
  etiqueta: string;
  opciones: OpcionFiltro[];
}) {
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          scroll={false}
          aria-current={o.activa ? 'true' : undefined}
          className={clsx(
            'inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-label whitespace-nowrap no-underline transition-colors duration-150 hover:no-underline motion-reduce:transition-none',
            o.activa
              ? 'border-support bg-support text-secondary-foreground hover:text-secondary-foreground'
              : 'border-border bg-surface text-foreground hover:bg-surface-alt hover:text-foreground',
          )}
        >
          {o.texto}
          <span
            className={clsx(
              'font-semibold tabular-nums',
              o.activa ? 'text-support-muted-foreground' : 'text-muted-foreground',
            )}
          >
            {o.n}
          </span>
        </Link>
      ))}
    </nav>
  );
}
