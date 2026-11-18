import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { clsx } from 'clsx';

import type { FilaIglesiaDetalle } from '@/lib/admin/iglesias-detalle';
import { Insignia } from '@/components/ui/insignia';
import { fecha, plural } from './piezas';
import { InicialIglesia } from './iglesias-inicial';
import type { Direccion, Orden } from './iglesias-orden';

/**
 * El listado de iglesias: una tabla de verdad en escritorio y tarjetas en el
 * móvil. Las dos se pintan en el servidor y el CSS enseña una u otra.
 *
 * LA TABLA
 * --------
 * Se ordena por cualquier columna tocando la cabecera, y cada cabecera es un
 * enlace (`?orden=&dir=`), no un botón: funciona sin JavaScript y la página no
 * deja de ser de servidor. La columna ordenada lleva `aria-sort`, y solo ella:
 * es lo que un lector de pantalla anuncia al entrar en la tabla.
 *
 * La fila entera lleva a la ficha, pero el enlace es el nombre, estirado con un
 * `::after` sobre toda la fila: así hay UN enlace por iglesia y no cinco (uno
 * por celda), y el lector lo lee con su nombre.
 *
 * Desde `xl` y no antes: con el menú lateral de 264 px, a 1024 quedaban 700 px
 * para cinco columnas y el nombre se cortaba en «Iglesia Cri…», que es justo
 * lo que la tabla venía a arreglar. Por debajo, las tarjetas, a dos columnas.
 *
 * LAS TARJETAS
 * ------------
 * Por debajo de `xl`, una tarjeta por iglesia con el nombre ENTERO (en la
 * lista de antes, en el móvil, los nombres largos se cortaban), la insignia y
 * los recuentos.
 */

function lugarDe(i: FilaIglesiaDetalle): string {
  return [i.ciudad, i.pais].filter(Boolean).join(', ');
}

export function TablaIglesias({
  filas,
  orden,
  dir,
  enlaces,
}: {
  filas: FilaIglesiaDetalle[];
  orden: Orden;
  dir: Direccion;
  /** El enlace de cada cabecera: el que ordena por ella o le da la vuelta. */
  enlaces: Record<Orden, string>;
}) {
  const cabecera = (col: Orden, texto: string, numero = false) => (
    <Cabecera
      activa={orden === col}
      dir={dir}
      href={enlaces[col]}
      numero={numero}
    >
      {texto}
    </Cabecera>
  );

  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-surface xl:block">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-alt">
          <tr className="border-b border-border">
            {cabecera('nombre', 'Iglesia')}
            {cabecera('situacion', 'Situación')}
            {cabecera('personas', 'Personas', true)}
            {cabecera('cuentas', 'Cuentas', true)}
            {cabecera('alta', 'Alta')}
          </tr>
        </thead>
        <tbody>
          {filas.map((i) => (
            <tr
              key={i.id}
              className="relative border-b border-border transition-colors duration-150 last:border-b-0 focus-within:bg-surface-alt hover:bg-surface-alt motion-reduce:transition-none"
            >
              {/* `w-full max-w-0`: la columna del nombre se queda con lo que
                  sobra y es la única que encoge. Sin esto la tabla medía lo
                  que el nombre más largo sin cortar, y a 1024 px Cuentas y
                  Alta se salían por la derecha. */}
              <td className="w-full max-w-0 py-3 pr-4 pl-5">
                <span className="flex min-w-0 items-center gap-3">
                  <InicialIglesia nombre={i.nombre} logoUrl={i.logoUrl} />
                  <span className="flex min-w-0 flex-col gap-px">
                    <Link
                      href={`/admin/iglesias/${i.id}`}
                      className="truncate text-body font-semibold text-foreground no-underline outline-none after:absolute after:inset-0 after:content-[''] hover:text-foreground hover:no-underline focus-visible:after:rounded-[inherit] focus-visible:after:ring-3 focus-visible:after:ring-ring/20 focus-visible:after:ring-inset"
                    >
                      {i.nombre}
                    </Link>
                    {lugarDe(i) && (
                      <span className="truncate text-label text-muted-foreground">
                        {lugarDe(i)}
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td className="px-4 py-3">
                <Insignia tono={i.situacion.tono} punto>
                  {i.situacion.etiqueta}
                </Insignia>
              </td>
              <td className="px-4 py-3 text-right text-body tabular-nums">
                {i.personas.toLocaleString('es-CO')}
              </td>
              <td className="px-4 py-3 text-right text-body tabular-nums">
                {i.cuentas.toLocaleString('es-CO')}
              </td>
              <td className="py-3 pr-5 pl-4 text-label whitespace-nowrap text-muted-foreground">
                {/* La fecha de alta es de la plataforma, no de la iglesia: en
                    la hora de `/admin` (`piezas.tsx`, `ZONA_ADMIN`). */}
                {fecha(i.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cabecera({
  activa,
  dir,
  href,
  numero,
  children,
}: {
  activa: boolean;
  dir: Direccion;
  href: string;
  numero: boolean;
  children: ReactNode;
}) {
  const Icono = !activa ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  // Lo que pasará al tocarla, para quien no ve la flecha.
  const siguiente = activa ? 'ordenar al revés' : 'ordenar por esta columna';

  return (
    <th
      scope="col"
      aria-sort={activa ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={clsx(
        'px-4 py-2.5 whitespace-nowrap first:pl-5 last:pr-5',
        numero && 'text-right',
      )}
    >
      <Link
        href={href}
        scroll={false}
        className={clsx(
          // `clsx` y no `cn`: `t-micro` lleva su color, y tailwind-merge confunde
          // los tamaños propios de la escala con colores.
          't-micro inline-flex items-center gap-1 rounded-sm no-underline transition-colors duration-150 outline-none hover:text-foreground hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
          activa && 'text-foreground',
        )}
      >
        {children}
        <Icono
          aria-hidden
          className={clsx('size-3.5', !activa && 'text-disabled-text')}
          strokeWidth={1.8}
        />
        <span className="sr-only">, {siguiente}</span>
      </Link>
    </th>
  );
}

export function TarjetasIglesias({ filas }: { filas: FilaIglesiaDetalle[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2 xl:hidden">
      {filas.map((i) => (
        <li key={i.id}>
          <Link
            href={`/admin/iglesias/${i.id}`}
            className="flex h-full flex-col gap-2.5 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors duration-150 hover:border-support-hover hover:bg-surface-alt hover:text-foreground hover:no-underline motion-reduce:transition-none"
          >
            <span className="flex items-start gap-3">
              <InicialIglesia nombre={i.nombre} logoUrl={i.logoUrl} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-body font-semibold text-pretty break-words">
                  {i.nombre}
                </span>
                {lugarDe(i) && (
                  <span className="text-label text-muted-foreground">{lugarDe(i)}</span>
                )}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <Insignia tono={i.situacion.tono} punto>
                {i.situacion.etiqueta}
              </Insignia>
              <span className="text-label text-muted-foreground">
                {plural(i.personas, 'persona', 'personas')} ·{' '}
                {plural(i.cuentas, 'cuenta', 'cuentas')}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
