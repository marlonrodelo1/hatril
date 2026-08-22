import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ChevronRight, Search, TriangleAlert } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { LIBROS, buscarLibros, libroPorSlug } from '@/lib/biblia/libros';
import { cargarCapitulo } from '@/lib/biblia/texto';
import { CabeceraMiembro } from '../_components/cabecera-miembro';

export const metadata: Metadata = { title: 'Biblia' };

/**
 * La Biblia, dentro de la aplicación.
 *
 * TODO EN UNA RUTA, CON PARÁMETROS
 * --------------------------------
 * `?libro=salmos&cap=46` en vez de `/mi/biblia/salmos/46`. Dos motivos:
 *
 *   - El índice, el buscador y el capítulo son la misma pantalla en tres
 *     estados, no tres pantallas. Con rutas anidadas habría tres archivos
 *     repitiendo la cabecera y el guard.
 *   - **Funciona sin JavaScript.** El buscador es un `<form method="get">` y
 *     cada libro es un enlace: en un móvil viejo con mala cobertura la Biblia
 *     sigue abriéndose, que es exactamente el aparato desde el que se va a leer
 *     un domingo por la mañana.
 *
 * SIN TEXTO TODAVÍA, Y SE DICE
 * ----------------------------
 * `cargarCapitulo` devuelve null mientras no esté el fichero de la Reina-Valera
 * 1909. La pantalla lo cuenta con todas las letras en vez de enseñar un capítulo
 * vacío: un hueco donde debería ir el Salmo 23 parece una aplicación rota, y una
 * Biblia a medias es peor que una Biblia que todavía no está.
 */
export default async function BibliaPage({
  searchParams,
}: {
  searchParams: Promise<{ libro?: string; cap?: string; q?: string }>;
}) {
  const ctx = await requireIglesia();
  const { libro: slug, cap, q } = await searchParams;

  const libro = libroPorSlug(slug);
  const numero = Number(cap);
  const capitulo =
    libro && Number.isInteger(numero)
      ? await cargarCapitulo(libro, numero)
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        logoUrl={ctx.iglesia.logoUrl}
        user={ctx.user}
        titulo={libro ? libro.nombre : 'Biblia'}
        subtitulo={
          libro
            ? cap
              ? `Capítulo ${cap} · Reina-Valera 1909`
              : 'Reina-Valera 1909'
            : ctx.iglesia.nombre
        }
        // Aquí la flecha SÍ tiene sentido, al revés que en el muro: dentro de un
        // libro o de un capítulo hay a dónde volver de verdad.
        volver={libro ? (cap ? `/mi/biblia?libro=${libro.slug}` : '/mi/biblia') : undefined}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {/* --- Un capítulo --- */}
        {libro && cap && (
          <>
            {capitulo ? (
              <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
                {capitulo.versiculos.map((texto, i) => (
                  <p key={i} className="text-pretty text-[16px] leading-relaxed">
                    <span className="mr-1.5 align-baseline text-[12px] font-bold text-accent-brand">
                      {i + 1}
                    </span>
                    {texto}
                  </p>
                ))}
              </article>
            ) : (
              <SinTexto />
            )}
          </>
        )}

        {/* --- Los capítulos de un libro --- */}
        {libro && !cap && (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-muted-foreground">
              {libro.capitulos}{' '}
              {libro.capitulos === 1 ? 'capítulo' : 'capítulos'}
            </p>

            {/* Rejilla de números y no una lista: Salmos tiene 150 y en lista
                serían diez pantallazos de scroll para llegar al 119. */}
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {Array.from({ length: libro.capitulos }, (_, i) => i + 1).map(
                (n) => (
                  <Link
                    key={n}
                    href={`/mi/biblia?libro=${libro.slug}&cap=${n}`}
                    className="flex h-11 items-center justify-center rounded-lg border border-border bg-surface text-[14.5px] font-semibold text-foreground no-underline tabular-nums hover:border-support-hover hover:bg-surface-alt hover:no-underline"
                  >
                    {n}
                  </Link>
                ),
              )}
            </div>
          </div>
        )}

        {/* --- El índice --- */}
        {!libro && (
          <>
            <form method="get" className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-surface-alt px-3.5 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/16">
                <Search
                  className="size-[17px] flex-none text-muted-foreground"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <input
                  name="q"
                  defaultValue={q ?? ''}
                  placeholder="Buscar un libro"
                  aria-label="Buscar un libro"
                  className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
                />
              </div>
            </form>

            <Indice consulta={q} />
          </>
        )}
      </main>
    </div>
  );
}

function Indice({ consulta }: { consulta?: string }) {
  const encontrados = consulta?.trim() ? buscarLibros(consulta) : null;

  if (encontrados) {
    if (encontrados.length === 0) {
      return (
        <p className="rounded-xl border border-border bg-surface p-5 text-[14.5px] text-muted-foreground">
          No hay ningún libro que se llame así. Prueba con «salmos», «1co» o
          «apoc».
        </p>
      );
    }
    return <ListaLibros libros={encontrados} />;
  }

  return (
    <>
      <Testamento titulo="Antiguo Testamento" cual="antiguo" />
      <Testamento titulo="Nuevo Testamento" cual="nuevo" />
    </>
  );
}

function Testamento({
  titulo,
  cual,
}: {
  titulo: string;
  cual: 'antiguo' | 'nuevo';
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {titulo}
      </h2>
      <ListaLibros libros={LIBROS.filter((l) => l.testamento === cual)} />
    </section>
  );
}

function ListaLibros({ libros }: { libros: readonly (typeof LIBROS)[number][] }) {
  return (
    <ul className="overflow-hidden rounded-xl border border-border bg-surface">
      {libros.map((l, i) => (
        <li key={l.slug}>
          <Link
            href={`/mi/biblia?libro=${l.slug}`}
            className={
              'flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline ' +
              (i > 0 ? 'border-t border-border' : '')
            }
          >
            <span className="flex-1 truncate text-[15px] font-semibold">
              {l.nombre}
            </span>
            <span className="flex-none text-[12.5px] tabular-nums text-muted-foreground">
              {l.capitulos}
            </span>
            <ChevronRight
              className="size-4 flex-none text-muted-foreground"
              strokeWidth={2}
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Lo que se ve mientras no esté el texto.
 *
 * Con icono además del color, como manda la regla 2 del sistema de diseño, y
 * diciendo exactamente qué falta. Un «próximamente» no le sirve a nadie.
 */
function SinTexto() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-accent-brand/40 bg-badge-accent-bg p-5">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface text-badge-accent-fg">
        <BookOpen className="size-5" strokeWidth={1.7} />
      </span>

      <h2 className="text-[17px] font-bold tracking-[-0.02em]">
        El texto todavía no está cargado
      </h2>

      <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
        El índice, la búsqueda y la navegación por capítulos ya funcionan. Falta
        traer el texto de la Reina-Valera 1909, que es la versión de dominio
        público — la Reina-Valera 1960 tiene derechos de Sociedades Bíblicas
        Unidas y no puede ir dentro del producto sin licencia.
      </p>

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
        <TriangleAlert
          className="mt-0.5 size-4 flex-none text-accent-brand"
          strokeWidth={1.9}
          aria-hidden
        />
        <span>
          Para quien lo esté montando: hace falta un JSON por libro en
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 text-[12px]">
            public/biblia/rv1909/
          </code>
          con el formato que describe <code>texto.ts</code>.
        </span>
      </p>
    </div>
  );
}
