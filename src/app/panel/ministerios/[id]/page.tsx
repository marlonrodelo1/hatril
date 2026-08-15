import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, Plus, UserMinus, UserPlus } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import {
  candidatosParaMinisterio,
  obtenerMinisterio,
} from '@/lib/ministerios/consultas';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import { asignarAlMinisterio, quitarDelMinisterio } from '../actions';
import { DialogoAsignar } from '../_components/dialogo-asignar';

/*
 * Título fijo y no el nombre del ministerio.
 *
 * `generateMetadata` corre en su propio pase, así que sacar el nombre de la
 * base de datos significa ejecutar la consulta DOS veces por carga —una para el
 * título y otra para la página—. React `cache()` no lo deduplica aquí porque la
 * clave sería el objeto `ctx`, que es distinto en cada llamada.
 *
 * Con la base en Irlanda y el público en Colombia, ese viaje extra son ~200 ms
 * por visita. No los vale poner el nombre en la pestaña del navegador, que
 * además está en el h1 nada más entrar.
 */
export const metadata: Metadata = { title: 'Ministerio' };

export default async function MinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asignar?: string }>;
}) {
  const ctx = await requireIglesia();
  const { id } = await params;
  const { asignar } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const puedeGestionar = esPastor(ctx) || puede(ctx, 'gestionar_ministerios');
  const color = colorDeMinisterio(ministerio.colorHex);

  // Las candidatas solo se piden si el diálogo está abierto. Cargarlas siempre
  // sería una consulta de hasta 300 filas en cada visita a la pantalla, para
  // algo que casi nunca se usa.
  const candidatos =
    asignar && puedeGestionar
      ? await candidatosParaMinisterio(ctx, ministerio.id)
      : [];

  const asignarAqui = asignarAlMinisterio.bind(null, ministerio.id);

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-4 md:flex-row md:items-center md:gap-4 md:px-8">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Volver a ministerios"
          className="hidden flex-none md:inline-flex"
          render={<Link href="/panel/ministerios" />}
        >
          <ChevronLeft strokeWidth={1.9} />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href="/panel/ministerios"
            className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline md:hidden"
          >
            <ChevronLeft className="size-4" strokeWidth={1.8} />
            Ministerios
          </Link>
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-[-0.025em]">
            {ministerio.nombre}
          </h1>
        </div>

        {puedeGestionar && (
          <div className="flex flex-none flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link href={`/panel/ministerios/${ministerio.id}/editar`} />}
            >
              Editar equipo
            </Button>
            <Button render={<Link href="?asignar=1" scroll={false} />}>
              <UserPlus strokeWidth={1.8} />
              Asignar miembros
            </Button>
          </div>
        )}
      </header>

      <div className="flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-5 pb-12 pt-6 md:px-8">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:flex-row md:items-center md:gap-6 md:px-6">
          <span
            className="flex size-14 flex-none items-center justify-center rounded-xl"
            style={{ background: color.suave }}
          >
            <span
              className="size-5 rounded-md"
              style={{ background: color.hex }}
            />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[20px] font-bold tracking-[-0.022em]">
              {ministerio.nombre}
            </span>
            <span className="text-pretty text-[14px] leading-snug text-muted-foreground">
              {ministerio.descripcion ?? 'Sin descripción todavía'}
            </span>
          </div>

          <div className="flex items-center gap-6 md:gap-7">
            <div className="flex flex-col gap-1.5">
              <span className="t-micro">Responsable</span>
              {ministerio.lider ? (
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                    {iniciales(ministerio.lider.nombre)}
                  </span>
                  <span className="text-[14.5px] font-semibold">
                    {ministerio.lider.nombre}
                  </span>
                </div>
              ) : (
                <span className="text-[14.5px] text-muted-foreground">
                  Sin asignar
                </span>
              )}
            </div>

            <span className="h-10 w-px bg-border" />

            <div className="flex flex-col gap-1.5">
              <span className="t-micro">Voluntarios</span>
              <span className="text-[24px] font-bold leading-none tracking-[-0.025em]">
                {ministerio.voluntarios}
              </span>
            </div>
          </div>
        </section>

        {/*
         * El diseño pone aquí una segunda columna con «Próximos turnos». Sale
         * del módulo de eventos, que es de la v2. Se deja el ancho completo al
         * equipo en lugar de reservar media pantalla a un hueco.
         */}
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="t-subtitulo">Quién forma el equipo</h2>
            <span className="text-[13px] text-muted-foreground">
              {ministerio.voluntarios}{' '}
              {ministerio.voluntarios === 1 ? 'persona' : 'personas'}
            </span>
          </div>

          {ministerio.equipo.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14.5px] text-muted-foreground">
              Todavía no hay nadie en este equipo.
            </p>
          ) : (
            ministerio.equipo.map((p) => (
              <div
                key={p.vinculoId}
                className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
              >
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12.5px] font-bold text-muted-foreground">
                  {iniciales(p.nombre)}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <Link
                    href={`/panel/miembros?ficha=${p.miembroId}`}
                    className="truncate text-[15px] font-semibold text-foreground no-underline hover:text-primary"
                  >
                    {p.nombre}
                  </Link>
                  {p.desde && (
                    <span className="text-[12.5px] text-muted-foreground">
                      Desde {formatearMesAno(p.desde)}
                    </span>
                  )}
                </div>

                {/* El responsable lleva el color del ministerio; el resto, el
                    gris neutro. Nada de mezclar `className` con un spread
                    condicional que lo pisa: se decide arriba y se aplica una
                    vez. */}
                <span
                  className={
                    'whitespace-nowrap rounded-full px-2.5 py-[5px] text-[12px] font-semibold ' +
                    (p.esLider ? '' : 'bg-background text-muted-foreground')
                  }
                  style={
                    p.esLider
                      ? { background: color.suave, color: color.hex }
                      : undefined
                  }
                >
                  {p.esLider ? 'Responsable' : (p.rolEnMinisterio ?? 'Equipo')}
                </span>

                {puedeGestionar && (
                  <form action={quitarDelMinisterio.bind(null, ministerio.id, p.miembroId)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      title={`Quitar a ${p.nombre} del equipo`}
                      aria-label={`Quitar a ${p.nombre} del equipo`}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <UserMinus strokeWidth={1.7} />
                    </Button>
                  </form>
                )}
              </div>
            ))
          )}

          {puedeGestionar && (
            <div className="p-4">
              <Button
                variant="ghost"
                className="h-[42px] w-full border border-dashed border-[#D5CCBE] text-muted-foreground hover:bg-background hover:text-foreground"
                render={<Link href="?asignar=1" scroll={false} />}
              >
                <Plus strokeWidth={1.8} />
                Sumar a alguien al equipo
              </Button>
            </div>
          )}
        </section>
      </div>

      {asignar && puedeGestionar && (
        <DialogoAsignar
          ministerioNombre={ministerio.nombre}
          candidatos={candidatos}
          accion={asignarAqui}
          cerrar={`/panel/ministerios/${ministerio.id}`}
        />
      )}
    </>
  );
}

function formatearMesAno(fecha: string): string {
  return new Date(`${fecha}T00:00`).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
}
