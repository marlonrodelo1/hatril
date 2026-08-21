import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Pencil, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { listaDelEquipo, obtenerReunion } from '@/lib/asistencia/consultas';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { borrarReunionDeMinisterio, guardarListaDelEquipo } from '../actions';
import { CONFIRMACIONES } from '../constantes';

export const metadata: Metadata = { title: 'Reunión del ministerio' };

export default async function ReunionDeMinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reunionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, reunionId } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const [ministerio, reunion] = await Promise.all([
    obtenerMinisterio(ctx, id),
    obtenerReunion(ctx, reunionId),
  ]);

  if (!ministerio || !reunion) notFound();

  // El layout ya comprobó que quien entra manda en ESTE ministerio. Falta la
  // otra mitad: que la reunión de la URL sea de este ministerio y no del de al
  // lado. Sin esto, el responsable de alabanza vería el ensayo de niños —y a su
  // equipo— cambiando un uuid en la barra de direcciones.
  if (reunion.ministerio?.id !== id) notFound();

  const equipo = await listaDelEquipo(ctx, reunionId, id);
  const primeraVez = reunion.marcados === 0;
  const base = `/panel/ministerios/${id}/agenda`;

  return (
    <>
      <CabeceraPanel
        titulo={reunion.titulo}
        volver={{ href: base, texto: ministerio.nombre }}
      >
        <Button
          variant="outline"
          render={<Link href={`${base}/${reunionId}/editar`} />}
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
            {primeraVez ? (
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

        <form
          action={guardarListaDelEquipo.bind(null, id, reunionId)}
          className="flex flex-col gap-4"
        >
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">Quién del equipo vino</h2>
              <p className="t-label text-muted-foreground">
                {/* Se dice explícitamente que esto no cuenta para el culto: si
                    no, el responsable acaba pensando que está marcando la
                    asistencia de esas personas a la iglesia. */}
                Solo el equipo, y no cuenta para la asistencia a los cultos.
              </p>
            </div>

            {equipo.length === 0 ? (
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                Este ministerio todavía no tiene a nadie.{' '}
                <Link href={`/panel/ministerios/${id}`} className="underline">
                  Súmale gente al equipo
                </Link>{' '}
                y vuelve aquí.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {equipo.map((p) => (
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
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {equipo.length > 0 && (
            <div>
              <Button type="submit">Guardar la lista</Button>
            </div>
          )}
        </form>

        <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Borrar de la agenda</h2>
            <p className="max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
              Se va con su lista. No hay forma de recuperarla.
            </p>
          </div>
          <form action={borrarReunionDeMinisterio.bind(null, id, reunionId)}>
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
