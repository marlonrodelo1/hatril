import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Pencil, Trash2 } from 'lucide-react';

import {
  exigirUuid,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listaDelEquipo, obtenerReunion } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/agenda/constantes';
import { MarcoEquipo, Vacio } from '../../../_components/marco';
import { borrarReunionDeMinisterio, guardarListaDelEquipo } from '../actions';

export const metadata: Metadata = { title: 'Pasar lista' };

/**
 * Pasar lista de un ensayo desde el móvil, en el propio ensayo.
 *
 * LA LISTA ES `listaDelEquipo()`, LA DEL PANEL
 * --------------------------------------------
 * Y no el equipo de `obtenerMinisterio`: aquella cruza la reunión con el
 * ministerio y deja fuera a quien negó el permiso de asistencia. Esta pantalla
 * no puede enseñar a nadie que la action no vaya a aceptar, ni la action
 * escribir a nadie que esta pantalla no enseñe.
 *
 * Una fila por persona con la casilla grande: se marca con el pulgar de pie en
 * la sala, con el móvil en una mano. La primera vez salen todos marcados, como
 * en el panel —lo normal en un ensayo es que venga casi todo el equipo, y es
 * más rápido desmarcar a dos que marcar a doce—.
 *
 * El naranja es «Guardar la lista». Editar va arriba como enlace y borrar,
 * plegado al final: ninguno de los dos es lo que se viene a hacer.
 */
export default async function ReunionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reunionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, reunionId } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');
  exigirUuid(reunionId);

  const reunion = await obtenerReunion(ctx, reunionId);
  // La guarda miró el ministerio de la URL; falta que la reunión sea de él.
  // Sin esto, el responsable de alabanza vería el ensayo de niños —y a su
  // equipo— cambiando un uuid.
  if (!reunion || reunion.ministerio?.id !== id) notFound();

  const equipo = await listaDelEquipo(ctx, reunionId, id);
  const primeraVez = reunion.marcados === 0;
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const base = rutaApp(id, 'agenda');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={reunion.titulo}
      subtitulo={ministerio.nombre}
      volver={base}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[16px] font-bold tracking-[-0.015em]">
            {cuandoCorto(reunion.fecha, reunion.hora, hoy)}
          </span>
          {reunion.lugar && (
            <span className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <MapPin className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
              {reunion.lugar}
            </span>
          )}
          {reunion.notas && (
            <p className="mt-1 text-pretty text-[14px] leading-relaxed text-muted-foreground">
              {reunion.notas}
            </p>
          )}
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span className="t-micro">Vinieron</span>
          {primeraVez ? (
            <span className="text-[13.5px] text-muted-foreground">Sin lista</span>
          ) : (
            <span className="text-[22px] font-bold leading-none tracking-[-0.025em]">
              {reunion.presentes}
              <span className="ml-1 text-[13.5px] font-medium text-muted-foreground">
                de {reunion.marcados}
              </span>
            </span>
          )}
        </div>
      </section>

      <Link
        href={`${base}/${reunionId}/editar`}
        className="inline-flex items-center gap-1.5 self-start px-1 text-[13.5px] font-semibold text-muted-foreground no-underline hover:text-foreground hover:no-underline"
      >
        <Pencil className="size-3.5" strokeWidth={1.9} aria-hidden />
        Cambiar el día, el lugar o las notas
      </Link>

      <form
        action={guardarListaDelEquipo.bind(null, id, reunionId)}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-0.5 px-1">
          <h2 className="t-subtitulo">Quién del equipo vino</h2>
          {/* Lo dice para que nadie crea que está marcando la asistencia de
              esas personas a la iglesia: un ensayo no cuenta para el culto. */}
          <p className="t-label text-muted-foreground">
            Solo el equipo, y no cuenta para la asistencia a los cultos.
          </p>
        </div>

        {equipo.length === 0 ? (
          <Vacio>
            {/* Lista vacía no es equipo vacío: también sale así si todos
                negaron el permiso de asistencia. El texto no dice cuál, igual
                que la action. */}
            <p>
              {ministerio.equipo.length === 0
                ? 'Este ministerio todavía no tiene a nadie. Súmale gente desde el panel y vuelve aquí.'
                : 'No hay nadie en este equipo a quien pasar lista.'}
            </p>
          </Vacio>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {equipo.map((p) => (
                <li key={p.miembroId}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 hover:bg-surface-alt has-checked:border-primary has-checked:bg-accent">
                    <input
                      type="checkbox"
                      name="presentes"
                      value={p.miembroId}
                      defaultChecked={p.presente ?? primeraVez}
                      className="size-5 flex-none accent-primary"
                    />
                    <span
                      className={`flex size-9 flex-none items-center justify-center rounded-full text-[12px] font-bold ${ESTADOS[p.estado].avatar}`}
                    >
                      {iniciales(p.nombre)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {p.nombre}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div>
              <Button type="submit" size="lg">
                Guardar la lista
              </Button>
            </div>
          </>
        )}
      </form>

      <details className="rounded-xl border border-border bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-[15px] font-semibold marker:hidden">
          Borrar de la agenda
        </summary>
        <div className="flex flex-col items-start gap-3 border-t border-border p-4">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Se va con su lista. No hay forma de recuperarla.
          </p>
          <form action={borrarReunionDeMinisterio.bind(null, id, reunionId)}>
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.8} />
              Borrar
            </Button>
          </form>
        </div>
      </details>
    </MarcoEquipo>
  );
}
