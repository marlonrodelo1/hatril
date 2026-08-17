import type { Metadata } from 'next';
import {
  BookOpen,
  CalendarPlus,
  ChevronRight,
  Trash2,
  Upload,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import {
  listarDevocionales,
  type DevocionalFila,
} from '@/lib/devocionales/consultas';
import { listarMiembrosParaAutor } from '@/lib/devocionales/autores';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  crearTurno,
  borrarTurno,
  guardarDevocional,
  guardarImagenDevocional,
} from './actions';

export const metadata: Metadata = { title: 'Devocionales' };

const CONFIRMACIONES: Record<string, string> = {
  turno: 'Turno añadido al calendario.',
  imagen: 'Imagen guardada.',
  escrito: 'Devocional guardado.',
  borrado: 'Turno borrado.',
};

/**
 * El calendario de devocionales.
 *
 * Una sola pantalla para las dos cosas que pasan aquí: el pastor reparte los
 * días, y quien los tiene asignados escribe. Separarlas en dos rutas obligaría a
 * un líder a buscar dónde está lo suyo; así lo ve al abrir, con su día marcado.
 */
export default async function DevocionalesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string; abrir?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, guardado, abrir } = await searchParams;

  const puedeRepartir = esPastor(ctx);
  const puedeEscribir = esPastor(ctx) || puede(ctx, 'escribir_devocionales');

  const [{ proximos, pasados }, autores] = await Promise.all([
    listarDevocionales(ctx),
    puedeRepartir ? listarMiembrosParaAutor(ctx) : [],
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Devocionales
        </h1>
        <p className="text-[13px] text-muted-foreground">
          El versículo del día que sale en la web de la iglesia
        </p>
      </header>

      <div className="flex w-full max-w-[860px] flex-col gap-7 px-5 pb-16 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {puedeRepartir && (
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">Repartir un día</h2>
              <p className="t-label text-muted-foreground">
                Elige la fecha y a quién le toca. Esa persona podrá escribirlo
                desde aquí; publicar lo decides tú.
              </p>
            </div>

            <form
              action={crearTurno}
              className="flex flex-wrap items-end gap-2.5"
            >
              <div className="flex min-w-[160px] flex-col gap-1.5">
                <label htmlFor="fecha" className="t-label">
                  Día
                </label>
                <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
              </div>

              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <label htmlFor="autorMiembroId" className="t-label">
                  Quién lo escribe
                </label>
                <select
                  id="autorMiembroId"
                  name="autorMiembroId"
                  className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                >
                  <option value="">Sin asignar</option>
                  {autores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit">
                <CalendarPlus strokeWidth={1.8} />
                Añadir
              </Button>
            </form>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="t-micro">Lo que viene</h2>

          {proximos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground">
                <BookOpen className="size-5" strokeWidth={1.5} />
              </span>
              <span className="max-w-[380px] text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
                {puedeRepartir
                  ? 'No hay ningún día repartido todavía. Añade el primero arriba.'
                  : 'No tienes ningún devocional asignado por ahora.'}
              </span>
            </div>
          ) : (
            proximos.map((d) => (
              <Tarjeta
                key={d.id}
                devocional={d}
                hoy={hoy}
                abierto={abrir === d.id}
                puedeRepartir={puedeRepartir}
                puedeEscribir={
                  puedeEscribir &&
                  (esPastor(ctx) || d.autorMiembroId === ctx.miembroId)
                }
                esPastorDeLaIglesia={esPastor(ctx)}
              />
            ))
          )}
        </section>

        {pasados.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="t-micro">Ya publicados</h2>
            {pasados.map((d) => (
              <Tarjeta
                key={d.id}
                devocional={d}
                hoy={hoy}
                abierto={abrir === d.id}
                puedeRepartir={puedeRepartir}
                puedeEscribir={esPastor(ctx)}
                esPastorDeLaIglesia={esPastor(ctx)}
              />
            ))}
          </section>
        )}
      </div>
    </>
  );
}

function Tarjeta({
  devocional: d,
  hoy,
  abierto,
  puedeRepartir,
  puedeEscribir,
  esPastorDeLaIglesia,
}: {
  devocional: DevocionalFila;
  hoy: string;
  abierto: boolean;
  puedeRepartir: boolean;
  puedeEscribir: boolean;
  esPastorDeLaIglesia: boolean;
}) {
  const esHoy = d.fecha === hoy;

  return (
    <details
      open={abierto || (esHoy && d.pendiente)}
      className="group/dev rounded-xl border border-border bg-surface open:pb-5"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3.5 p-5 marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 flex-none text-muted-foreground transition-transform group-open/dev:rotate-90"
          strokeWidth={2}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15.5px] font-bold tracking-[-0.015em]">
              {formatearFechaLarga(d.fecha)}
            </span>
            {esHoy && (
              <span className="rounded-full bg-accent px-2 py-[3px] text-[11.5px] font-bold text-accent-foreground">
                Hoy
              </span>
            )}
          </div>
          <span className="text-[13.5px] text-muted-foreground">
            {d.titulo ?? (d.pendiente ? 'Sin escribir' : 'Sin título')}
            {d.autorNombre ? ` · ${d.autorNombre}` : ' · Sin asignar'}
          </span>
        </div>

        <span
          className={
            'flex-none rounded-full px-2.5 py-[5px] text-[12px] font-semibold ' +
            (d.publicado
              ? 'bg-[#E4EDE9] text-[#2F5D50]'
              : d.pendiente
                ? 'bg-[#F6EDD9] text-[#7E5F13]'
                : 'bg-background text-muted-foreground')
          }
        >
          {d.publicado ? 'Publicado' : d.pendiente ? 'Pendiente' : 'Borrador'}
        </span>
      </summary>

      <div className="flex flex-col gap-4 px-5">
        {puedeEscribir ? (
          <form
            action={guardarDevocional.bind(null, d.id)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`titulo-${d.id}`} className="t-label">
                Título
              </label>
              <Input
                id={`titulo-${d.id}`}
                name="titulo"
                maxLength={120}
                defaultValue={d.titulo ?? ''}
                placeholder="Confiar cuando no se entiende"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`versiculo-${d.id}`} className="t-label">
                  Versículo
                </label>
                <textarea
                  id={`versiculo-${d.id}`}
                  name="versiculo"
                  rows={2}
                  maxLength={600}
                  defaultValue={d.versiculo ?? ''}
                  placeholder="Fíate de Jehová de todo tu corazón…"
                  className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`referencia-${d.id}`} className="t-label">
                  Referencia
                </label>
                <Input
                  id={`referencia-${d.id}`}
                  name="referencia"
                  maxLength={80}
                  defaultValue={d.referencia ?? ''}
                  placeholder="Proverbios 3:5"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`cuerpo-${d.id}`} className="t-label">
                El devocional
              </label>
              <textarea
                id={`cuerpo-${d.id}`}
                name="cuerpo"
                rows={8}
                maxLength={6000}
                defaultValue={d.cuerpo ?? ''}
                placeholder="Escríbelo como se lo contarías a alguien tomando un café."
                className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`videoUrl-${d.id}`} className="t-label">
                Vídeo (opcional)
              </label>
              <Input
                id={`videoUrl-${d.id}`}
                name="videoUrl"
                type="url"
                inputMode="url"
                maxLength={300}
                defaultValue={d.videoUrl ?? ''}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              <span className="text-[13px] leading-relaxed text-muted-foreground">
                Si lo grabáis en vídeo, pega aquí el enlace de YouTube o Vimeo y
                en la web sale un botón para verlo. Se abre en YouTube, no dentro
                de la página: empotrar el reproductor obligaría a poner un aviso
                de cookies a quien solo viene a leer.
              </span>
            </div>

            {/* Publicar solo el pastor. Quien escribe deja el texto listo. */}
            {esPastorDeLaIglesia && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  name="publicado"
                  defaultChecked={d.publicado}
                  className="mt-0.5 flex-none"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14.5px] font-semibold leading-snug">
                    Publicarlo en la web
                  </span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">
                    Sale el día que le toca, no antes. Si ese día aún no llegó,
                    la web sigue enseñando el último publicado.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="submit" variant="outline">
                Guardar
              </Button>
            </div>
          </form>
        ) : null}

        {/* La imagen, en su propio formulario: subirla tarda y no tiene por qué
            ir atada a guardar el texto. */}
        {puedeEscribir ? (
          <div className="flex flex-col gap-2.5 border-t border-border pt-4">
            <span className="t-label">Imagen de fondo</span>

            {d.imagenUrl && (
              <div className="h-[120px] overflow-hidden rounded-lg border border-border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imagenUrl}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )}

            <form
              action={guardarImagenDevocional.bind(null, d.id)}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="file"
                name="imagen"
                required
                accept="image/jpeg,image/png,image/webp"
                aria-label="Elegir la imagen del devocional"
                className="min-w-0 flex-1 text-[13px] text-muted-foreground file:mr-2.5 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface-alt file:px-2.5 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-background"
              />
              <Button type="submit" variant="outline" size="sm">
                <Upload strokeWidth={1.7} />
                {d.imagenUrl ? 'Cambiar' : 'Subir'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt p-4">
            {d.versiculo && (
              <p className="text-pretty text-[15px] italic leading-relaxed">
                «{d.versiculo}»
                {d.referencia && (
                  <span className="not-italic text-muted-foreground">
                    {' '}
                    — {d.referencia}
                  </span>
                )}
              </p>
            )}
            <p className="whitespace-pre-line text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              {d.cuerpo ?? 'Todavía sin escribir.'}
            </p>
          </div>
        )}

        {puedeRepartir && (
          <form
            action={borrarTurno.bind(null, d.id)}
            className="border-t border-border pt-4"
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Trash2 strokeWidth={1.7} />
              Quitar este día del calendario
            </Button>
          </form>
        )}
      </div>
    </details>
  );
}
