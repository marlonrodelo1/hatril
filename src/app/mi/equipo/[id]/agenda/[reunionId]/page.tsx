import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Pencil, Trash2, UserPlus } from 'lucide-react';

import {
  exigirUuid,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listaDelEquipo, obtenerReunion } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { AvatarPersona } from '@/components/avatar-persona';
import { Button, buttonVariants } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/agenda/constantes';
import {
  Fila,
  Lista,
  MarcoEquipo,
  Vacio,
  ZonaDeBorrar,
} from '../../../_components/marco';
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
 * El naranja es «Guardar la lista». Editar va arriba como enlace y borrar, en
 * su tarjeta roja al final: ninguno de los dos es lo que se viene a hacer.
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
      <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5">
        <h2 className="t-subtitulo">{cuandoCorto(reunion.fecha, reunion.hora, hoy)}</h2>
        {reunion.lugar && (
          <span className="inline-flex items-center gap-1.5 text-label text-muted-foreground">
            <MapPin className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
            {reunion.lugar}
          </span>
        )}
        {reunion.notas && (
          <p className="text-pretty text-body leading-relaxed text-muted-foreground">
            {reunion.notas}
          </p>
        )}
        {/* Una línea y no una cifra grande: es un dato del ensayo, no un
            indicador que vigilar. */}
        <p className="text-label font-semibold text-muted-foreground">
          {primeraVez
            ? 'Todavía sin lista'
            : `Vinieron ${reunion.presentes} de ${reunion.marcados}`}
        </p>
        <Link
          href={`${base}/${reunionId}/editar`}
          className="mt-1 inline-flex items-center gap-1.5 self-start text-label font-semibold text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <Pencil className="size-3.5" strokeWidth={1.8} aria-hidden />
          Cambiar el día, el lugar o las notas
        </Link>
      </section>

      <form
        action={guardarListaDelEquipo.bind(null, id, reunionId)}
        className="flex flex-col gap-4"
      >
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5 px-1">
            <h2 className="t-micro">Quién del equipo vino</h2>
            {/* Lo dice para que nadie crea que está marcando la asistencia de
                esas personas a la iglesia: un ensayo no cuenta para el culto. */}
            <p className="text-label text-muted-foreground">
              Solo el equipo, y no cuenta para la asistencia a los cultos.
            </p>
          </div>

          {equipo.length === 0 ? (
            // Lista vacía no es equipo vacío: también sale así si todos
            // negaron el permiso de asistencia. El texto no dice cuál, igual
            // que la action.
            ministerio.equipo.length === 0 ? (
              <Vacio
                titulo="El equipo está vacío"
                accion={
                  <Link
                    href={`/panel/ministerios/${id}`}
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    <UserPlus strokeWidth={1.8} />
                    Sumar gente en el panel
                  </Link>
                }
              >
                Este ministerio todavía no tiene a nadie. Suma a tu gente desde
                el panel y vuelve aquí para pasar lista.
              </Vacio>
            ) : (
              <Vacio titulo="Nadie a quien pasar lista">
                No hay nadie en este equipo a quien se le pueda pasar lista.
              </Vacio>
            )
          ) : (
            <Lista>
              {equipo.map((p) => (
                <Fila key={p.miembroId}>
                  {/* La fila entera es la casilla: se marca con el pulgar, de
                      pie en la sala y con el móvil en una mano. Sin teñir la
                      fila marcada: en un ensayo viene casi todo el equipo, y
                      la lista entera en salmón borraba los avatares y las
                      líneas. Lo dice la casilla. */}
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-alt md:px-5">
                    <input
                      type="checkbox"
                      name="presentes"
                      value={p.miembroId}
                      defaultChecked={p.presente ?? primeraVez}
                      className="size-5 flex-none accent-primary"
                    />
                    <AvatarPersona nombre={p.nombre} tamano="md" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">
                      {p.nombre}
                    </span>
                  </label>
                </Fila>
              ))}
            </Lista>
          )}
        </section>

        {equipo.length > 0 && (
          <div>
            <Button type="submit">Guardar la lista</Button>
          </div>
        )}
      </form>

      <ZonaDeBorrar
        titulo="Borrar de la agenda"
        boton={
          <form action={borrarReunionDeMinisterio.bind(null, id, reunionId)}>
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.8} />
              Borrar
            </Button>
          </form>
        }
      >
        Se va con su lista. No hay forma de recuperarla.
      </ZonaDeBorrar>
    </MarcoEquipo>
  );
}
