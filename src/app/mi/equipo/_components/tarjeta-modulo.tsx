import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  CircleDashed,
  TriangleAlert,
} from 'lucide-react';

import type { Pendiente } from '@/lib/ministerios/en-la-app/contrato';
import type { TarjetaDePortada } from '@/lib/ministerios/en-la-app/portada';
import { Insignia } from './insignia';

/**
 * La tarjeta de un módulo en la portada del equipo.
 *
 * No sabe de qué módulo es: pinta lo que trae `ResumenDeModulo`, con el nombre
 * y el icono del catálogo. Es la otra mitad del contrato, y por eso un módulo
 * nuevo sale aquí sin tocar este fichero.
 *
 * UNA LISTA, NO UN CUADRO DE MANDOS
 * ---------------------------------
 * Cada cosa pendiente es una fila que lleva a donde se arregla, con su texto y
 * nada más: ni cifras grandes ni colores de adorno. Un botón por fila serían
 * seis botones en la primera pantalla, y la regla es un naranja por pantalla:
 * aquí no hay ninguno, porque la portada se mira y se elige.
 *
 * Lo urgente lleva icono además de color —regla 2 del sistema—: el ámbar del
 * aviso y el naranja de marca son vecinos de tono, y sin el triángulo no se
 * distinguen de un vistazo.
 */
export function TarjetaModulo({ tarjeta }: { tarjeta: TarjetaDePortada }) {
  const { modulo, resumen, enlace } = tarjeta;
  const pendientes = resumen?.pendientes ?? [];
  const total = pendientes.length + (resumen?.restantes ?? 0);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2.5 px-4 pb-1 pt-4 md:px-5">
        <modulo.Icono
          className="size-[18px] flex-none text-muted-foreground"
          strokeWidth={1.8}
          aria-hidden
        />
        {/* Sin `truncate`: «Seguimiento de personas» con su insignia al lado
            se quedaba en «Seguimiento de perso…» a 375 px. */}
        <h2 className="t-subtitulo min-w-0 flex-1">{modulo.nombre}</h2>
        {total > 0 && (
          <Insignia tono="aviso">
            {total === 1 ? '1 pendiente' : `${total} pendientes`}
          </Insignia>
        )}
      </header>

      {tarjeta.sinAdaptador ? (
        <p className="px-4 pb-3 pt-1 text-pretty text-label text-muted-foreground md:px-5">
          Esta herramienta todavía se lleva desde el panel.
        </p>
      ) : !resumen ? (
        <p className="flex items-start gap-2 px-4 pb-3 pt-1 text-label text-danger md:px-5">
          <TriangleAlert className="mt-px size-4 flex-none" strokeWidth={1.8} aria-hidden />
          No se ha podido cargar ahora. Vuelve a intentarlo en un momento.
        </p>
      ) : (
        <ul className="flex flex-col pb-1">
          {/* Cifras para mirar, sin color: un saldo no pide nada, se lee. */}
          {resumen.cifras && resumen.cifras.length > 0 && (
            <li className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 pb-2 pt-1.5 md:px-5">
              {resumen.cifras.map((c, i) => (
                <span
                  key={c.rotulo}
                  // La primera, a lo ancho: es la que se viene a ver.
                  className={'flex min-w-0 flex-col gap-0.5 ' + (i === 0 ? 'col-span-2' : '')}
                >
                  <span className="t-micro truncate">{c.rotulo}</span>
                  <span className="t-subtitulo truncate tabular-nums">{c.valor}</span>
                </span>
              ))}
            </li>
          )}
          {pendientes.map((p, i) => (
            <li key={i}>
              <FilaPendiente pendiente={p} />
            </li>
          ))}
          {resumen.proximo && (
            <li>
              <Link
                href={resumen.proximo.href}
                className="flex items-start gap-3 px-4 py-2.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
              >
                <CalendarDays
                  className="mt-0.5 size-4 flex-none text-muted-foreground"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body font-semibold">
                    {resumen.proximo.texto}
                  </span>
                  {resumen.proximo.detalle && (
                    <span className="text-label text-muted-foreground">
                      {resumen.proximo.detalle}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )}
          {pendientes.length === 0 &&
            !resumen.proximo &&
            !resumen.cifras?.length &&
            resumen.vacio && (
            <li className="px-4 pb-2 pt-1 text-pretty text-label text-muted-foreground md:px-5">
              {resumen.vacio}
            </li>
          )}
        </ul>
      )}

      {enlace && (
        <Link
          href={enlace.href}
          className="flex items-center gap-1.5 border-t border-border px-4 py-3 text-body font-semibold text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
        >
          <span className="flex-1">
            {enlace.texto}
            {(resumen?.restantes ?? 0) > 0 && (
              <span className="font-normal text-muted-foreground">
                {' '}
                · y {resumen!.restantes} más
              </span>
            )}
          </span>
          <ChevronRight
            className="size-4 flex-none text-disabled-text"
            strokeWidth={1.8}
            aria-hidden
          />
        </Link>
      )}
    </section>
  );
}

function FilaPendiente({ pendiente: p }: { pendiente: Pendiente }) {
  const Icono = p.urgente ? TriangleAlert : CircleDashed;

  return (
    <Link
      href={p.href}
      className="flex items-start gap-3 px-4 py-2.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
    >
      <Icono
        className={
          'mt-0.5 size-4 flex-none ' +
          (p.urgente ? 'text-warning' : 'text-muted-foreground')
        }
        strokeWidth={1.8}
        aria-label={p.urgente ? 'Urgente' : undefined}
        aria-hidden={p.urgente ? undefined : true}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold">{p.texto}</span>
        {p.detalle && (
          <span className="text-pretty text-label text-muted-foreground">
            {p.detalle}
          </span>
        )}
      </span>
    </Link>
  );
}
