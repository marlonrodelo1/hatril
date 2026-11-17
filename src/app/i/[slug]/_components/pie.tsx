import Image from 'next/image';
import Link from 'next/link';

import type { IglesiaPublica } from '@/lib/iglesias/publica';
import type { redesParaPintar } from '@/lib/iglesias/redes';
import { iniciales } from '@/lib/format/iniciales';
import { IconoRed } from './pie-iconos-redes';

type Redes = ReturnType<typeof redesParaPintar>;

/** El pie de la web de la iglesia: su nombre, sus redes y lo legal. */
export function PieIglesia({
  iglesia,
  redes,
}: {
  iglesia: IglesiaPublica;
  redes: Redes;
}) {
  // La dirección con su ciudad, como se escribe en un sobre. Sin dirección
  // queda la ciudad sola, que también sirve para saber dónde está.
  const donde = [iglesia.direccion, iglesia.ciudad].filter(Boolean).join(', ');

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-8 sm:px-5 md:flex-row md:items-center md:gap-8 md:px-10 md:py-9">
        <div className="flex min-w-0 items-center gap-3">
          {/* El logo si lo han subido; si no, las iniciales, como en la
              cabecera. Nunca un hueco: un cuadro vacío parece roto. */}
          {iglesia.logoUrl ? (
            <Image
              src={iglesia.logoUrl}
              // Vacío: el nombre va escrito justo al lado y un lector lo
              // diría dos veces seguidas.
              alt=""
              width={40}
              height={40}
              className="size-10 flex-none rounded-lg border border-border bg-surface object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-10 flex-none items-center justify-center rounded-lg bg-primary text-label font-bold text-primary-foreground"
            >
              {iniciales(iglesia.nombre)}
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-body font-bold tracking-[-0.015em]">
              {iglesia.nombre}
            </span>
            {donde && (
              <span className="text-label text-muted-foreground">{donde}</span>
            )}
          </div>
        </div>

        {/* Las redes van AQUÍ y no en la cabecera, aunque parezca el sitio
            obvio: la píldora de arriba ya va justa a 1024px —por eso «Mi
            cuenta» es solo icono y solo cabe un botón de acción— y cinco
            enlaces más la rompen. Además no son una sección de la página, así
            que no entran en el menú de anclas.

            En iconos redondos, con los glifos de Simple Icons: lucide 1.x
            retiró `Instagram`, `Facebook` y `Youtube`, y el porqué de traerlos
            de fuera está en `pie-iconos-redes.tsx`. El nombre de la red, que
            antes se leía en la pastilla, va ahora en el `aria-label`. */}
        {redes.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2">
            {redes.map(({ red, titulo, url }) => (
              <li key={red}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${iglesia.nombre} en ${titulo}`}
                  // `text-foreground` explícito: `globals.css` pinta de naranja
                  // todo `<a>`, y el icono lo heredaría por `currentColor`.
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-surface-alt text-foreground no-underline transition duration-150 ease-hatril hover:-translate-y-px hover:bg-surface-active hover:text-foreground hover:no-underline motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <IconoRed red={red} className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* `hidden` en móvil: en columna este separador no empuja nada, pero
            sigue contando como hijo del flex y duplica el hueco entre las
            redes y los enlaces legales. */}
        <span className="hidden flex-1 md:block" />

        {/* En el móvil, Privacidad a un lado y la firma al otro, en la misma
            línea; en escritorio, juntos al final de la fila. */}
        <div className="flex items-center justify-between gap-5">
          <Link
            href="/privacidad"
            className="text-label text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Privacidad
          </Link>
          <span className="text-label text-muted-foreground">
            Hecho con{' '}
            <Link
              href="/"
              className="font-bold text-accent-foreground no-underline hover:text-accent-foreground hover:underline"
            >
              Hatril
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
