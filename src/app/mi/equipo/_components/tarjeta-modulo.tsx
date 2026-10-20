import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  CircleDashed,
  TriangleAlert,
} from 'lucide-react';

import type { Pendiente } from '@/lib/ministerios/en-la-app/contrato';
import type { TarjetaDePortada } from '@/lib/ministerios/en-la-app/portada';

/**
 * La tarjeta de un módulo en la portada del ministerio.
 *
 * No sabe de qué módulo es: pinta lo que trae `ResumenDeModulo`, con el nombre
 * y el icono del catálogo. Es la otra mitad del contrato, y por eso un módulo
 * nuevo sale aquí sin tocar este fichero.
 *
 * SIN BOTONES, SOLO FILAS
 * -----------------------
 * Cada cosa pendiente es una fila que lleva a donde se arregla. Un botón por
 * fila serían seis botones en la primera pantalla, y la regla es un naranja por
 * pantalla: aquí no hay ninguno, porque la portada se mira y se elige.
 *
 * Lo urgente lleva icono además de color —regla 2 del sistema—: el ámbar del
 * aviso y el naranja de marca son vecinos de tono, y sin el triángulo no se
 * distinguen de un vistazo.
 */
export function TarjetaModulo({ tarjeta }: { tarjeta: TarjetaDePortada }) {
  const { modulo, resumen, href, abrir } = tarjeta;
  const pendientes = resumen?.pendientes ?? [];
  const total = pendientes.length + (resumen?.restantes ?? 0);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2.5 px-4 pb-1 pt-3.5">
        <modulo.Icono
          className="size-[18px] flex-none text-muted-foreground"
          strokeWidth={1.8}
          aria-hidden
        />
        {/* Sin `truncate`: «Seguimiento de personas» con su insignia al lado
            se quedaba en «Seguimiento de perso…» a 375 px. Mejor dos líneas. */}
        <h2 className="min-w-0 flex-1 text-[15.5px] font-bold leading-tight tracking-[-0.015em]">
          {modulo.nombre}
        </h2>
        {total > 0 && (
          <span className="flex-none rounded-md bg-badge-warning-bg px-2 py-0.5 text-[12px] font-semibold text-badge-warning-fg">
            {total === 1 ? '1 pendiente' : `${total} pendientes`}
          </span>
        )}
      </header>

      {tarjeta.sinAdaptador ? (
        <p className="px-4 pb-3 pt-1 text-pretty text-[14px] leading-relaxed text-muted-foreground">
          Esta herramienta todavía se lleva desde el panel.
        </p>
      ) : !resumen ? (
        <p className="flex items-start gap-2 px-4 pb-3 pt-1 text-[14px] leading-relaxed text-danger">
          <TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={1.9} aria-hidden />
          No se ha podido cargar ahora. Ábrela para ver cómo está.
        </p>
      ) : (
        <ul className="flex flex-col">
          {pendientes.map((p, i) => (
            <li key={i}>
              <FilaPendiente pendiente={p} />
            </li>
          ))}
          {resumen.proximo && (
            <li>
              <Link
                href={resumen.proximo.href}
                className="flex items-start gap-3 px-4 py-2.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline"
              >
                <CalendarDays
                  className="mt-0.5 size-4 flex-none text-muted-foreground"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14.5px] font-semibold leading-snug">
                    {resumen.proximo.texto}
                  </span>
                  {resumen.proximo.detalle && (
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      {resumen.proximo.detalle}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )}
          {pendientes.length === 0 && !resumen.proximo && resumen.vacio && (
            <li className="px-4 pb-1 pt-1 text-pretty text-[14px] leading-relaxed text-muted-foreground">
              {resumen.vacio}
            </li>
          )}
        </ul>
      )}

      <Link
        href={href}
        className="mt-1 flex min-h-11 items-center gap-1.5 border-t border-border px-4 py-2.5 text-[14px] font-semibold text-foreground no-underline hover:bg-surface-alt hover:no-underline"
      >
        <span className="flex-1">
          {abrir}
          {(resumen?.restantes ?? 0) > 0 && (
            <span className="font-normal text-muted-foreground">
              {' '}
              · y {resumen!.restantes} más
            </span>
          )}
        </span>
        <ChevronRight
          className="size-4 flex-none text-disabled-text"
          strokeWidth={1.9}
          aria-hidden
        />
      </Link>
    </section>
  );
}

function FilaPendiente({ pendiente: p }: { pendiente: Pendiente }) {
  const Icono = p.urgente ? TriangleAlert : CircleDashed;

  return (
    <Link
      href={p.href}
      className="flex items-start gap-3 px-4 py-2.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline"
    >
      <Icono
        className={
          'mt-0.5 size-4 flex-none ' +
          (p.urgente ? 'text-warning' : 'text-muted-foreground')
        }
        strokeWidth={1.9}
        aria-label={p.urgente ? 'Urgente' : undefined}
        aria-hidden={p.urgente ? undefined : true}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14.5px] font-semibold leading-snug">{p.texto}</span>
        {p.detalle && (
          <span className="text-pretty text-[13px] leading-snug text-muted-foreground">
            {p.detalle}
          </span>
        )}
      </span>
    </Link>
  );
}
