import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Pencil, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { listaParaPasar, obtenerReunion } from '@/lib/asistencia/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import { borrarReunion, guardarLista } from '../actions';
import { CONFIRMACIONES } from '../constantes';

/*
 * Título fijo y no el de la reunión, por lo mismo que en `ministerios/[id]`:
 * `generateMetadata` corre en su propio pase y sacaría el nombre de la base con
 * una segunda consulta por carga. Con la base en Irlanda son ~200 ms por visita
 * para poner en la pestaña algo que ya está en el h1.
 */
export const metadata: Metadata = { title: 'Reunión' };

export default async function ReunionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  const { id } = await params;
  const { error, guardado } = await searchParams;

  const reunion = await obtenerReunion(ctx, id);
  if (!reunion) notFound();

  const congregacion = await listaParaPasar(ctx, id);

  // Nadie repasado todavía: se marca a todo el mundo como presente por defecto.
  // Es lo que ocurre de verdad —a un culto viene la mayoría—, y deja el trabajo
  // en desmarcar a los cuatro que faltaron en vez de marcar a los ciento veinte
  // que vinieron. Cuando ya hay lista, manda lo guardado y no esta suposición.
  const primeraVez = reunion.marcados === 0;

  return (
    <>
      <CabeceraPanel
        titulo={reunion.titulo}
        volver={{ href: '/panel/reuniones', texto: 'Reuniones' }}
      >
        <Button
          variant="outline"
          render={<Link href={`/panel/reuniones/${id}/editar`} />}
        >
          <Pencil strokeWidth={1.8} />
          Editar
        </Button>
      </CabeceraPanel>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:flex-row md:items-center md:gap-6 md:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[17px] font-bold tracking-[-0.018em] first-letter:uppercase">
              {formatearFechaLarga(reunion.fecha)}
              {reunion.hora && ` · ${reunion.hora.slice(0, 5)}`}
            </span>
            {reunion.lugar && (
              <span className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground">
                <MapPin className="size-4" strokeWidth={1.8} />
                {reunion.lugar}
              </span>
            )}
            {reunion.notas && (
              <p className="mt-1 text-pretty text-[14px] leading-relaxed text-muted-foreground">
                {reunion.notas}
              </p>
            )}
          </div>

          <div className="flex flex-none flex-col gap-1.5">
            <span className="t-micro">Vinieron</span>
            {reunion.marcados === 0 ? (
              <span className="text-[14.5px] text-muted-foreground">
                Sin lista todavía
              </span>
            ) : (
              <span className="text-[24px] font-bold leading-none tracking-[-0.025em]">
                {reunion.presentes}
                <span className="ml-1.5 text-[14px] font-medium text-muted-foreground">
                  de {reunion.marcados}
                </span>
              </span>
            )}
          </div>
        </section>

        <form action={guardarLista.bind(null, id)} className="flex flex-col gap-4">
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">Quién vino</h2>
              <p className="t-label text-muted-foreground">
                {primeraVez
                  ? 'Están todos marcados. Desmarca a quien no vino y guarda.'
                  : 'Marca a quien vino. Guardar de nuevo corrige la lista anterior.'}
              </p>
            </div>

            {congregacion.length === 0 ? (
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                No hay nadie en el fichero. Da de alta a la congregación en{' '}
                <Link href="/panel/miembros" className="underline">
                  Miembros
                </Link>{' '}
                y vuelve a esta pantalla.
              </p>
            ) : (
              /* Casillas nativas: viajan en el `FormData` de la server action.
                 Las de Base UI guardan el valor en estado de React y harían
                 falta inputs ocultos detrás de cada una. */
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {congregacion.map((p) => (
                  <li key={p.miembroId}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 hover:bg-background has-checked:border-primary has-checked:bg-accent">
                      <input
                        type="checkbox"
                        name="presentes"
                        value={p.miembroId}
                        defaultChecked={p.presente ?? primeraVez}
                      />
                      <span
                        className={`flex size-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${ESTADOS[p.estado].avatar}`}
                      >
                        {iniciales(p.nombre)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">
                        {p.nombre}
                      </span>
                      {/* Solo el estado que cambia la lectura de la fila. Un
                          badge «Activo» en ciento veinte filas es ruido. */}
                      {(p.estado === 'nuevo' || p.estado === 'inactivo') && (
                        <span
                          className={`flex-none rounded px-1.5 py-0.5 text-[11px] font-semibold ${ESTADOS[p.estado].badge}`}
                        >
                          {ESTADOS[p.estado].etiqueta}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {congregacion.length > 0 && (
            <div>
              <Button type="submit">Guardar la lista</Button>
            </div>
          )}
        </form>

        <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Borrar la reunión</h2>
            <p className="max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
              Se va con su lista entera, y la última asistencia de cada persona
              se recalcula sin ella. No hay forma de recuperarla.
            </p>
          </div>
          <form action={borrarReunion.bind(null, id)}>
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.8} />
              Borrar
            </Button>
          </form>
        </section>
      </Contenedor>
    </>
  );
}
