import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Phone, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import {
  acompanaDe,
  contactosDe,
  personasPorFaltas,
} from '@/lib/seguimiento/consultas';
import {
  RESULTADOS,
  RESULTADOS_ELEGIBLES,
  VIAS,
  VIAS_ELEGIBLES,
} from '@/lib/seguimiento/catalogos';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import {
  asignarAcompanante,
  borrarContacto,
  registrarContacto,
} from '../actions';
import { CONFIRMACIONES } from '../constantes';

export const metadata: Metadata = { title: 'Seguimiento de una persona' };

export default async function PersonaEnSeguimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; miembroId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, miembroId } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  // La persona sale de la MISMA consulta que la lista, y no de una nueva contra
  // `miembros`: así el ámbito de quién es visible aquí no puede separarse del de
  // la lista. Dos consultas distintas para la misma pregunta acaban dando
  // respuestas distintas, y aquí la respuesta es a quién se le puede leer el
  // seguimiento.
  const persona = (await personasPorFaltas(ctx, id)).find(
    (p) => p.miembroId === miembroId,
  );
  if (!persona) notFound();

  const [contactos, acompanaId] = await Promise.all([
    contactosDe(ctx, id, miembroId),
    acompanaDe(ctx, id, miembroId),
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const base = `/panel/ministerios/${id}/seguimiento`;

  // Quien acompaña sale del equipo de ESTE ministerio, que es lo que HT118
  // exige en la base. Ofrecer la congregación entera dejaría elegir a alguien
  // que la base va a rechazar.
  const equipo = ministerio.equipo;

  return (
    <>
      <CabeceraPanel
        titulo={persona.nombre}
        volver={{ href: base, texto: ministerio.nombre }}
      >
        {persona.telefono && (
          <Button variant="outline" render={<a href={`tel:${persona.telefono}`} />}>
            <Phone strokeWidth={1.8} />
            {persona.telefono}
          </Button>
        )}
      </CabeceraPanel>

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
          <span
            className={`flex size-12 flex-none items-center justify-center rounded-full text-[14px] font-bold ${ESTADOS[persona.estado].avatar}`}
          >
            {iniciales(persona.nombre)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">
              {persona.ultimaAsistencia
                ? `Vino por última vez el ${formatearFechaLarga(persona.ultimaAsistencia)}`
                : 'Nunca se le ha marcado presente en una reunión'}
            </span>
            <span className="text-[13.5px] text-muted-foreground">
              Se ha perdido {persona.faltasSeguidas}{' '}
              {persona.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} de las que
              se pasó lista.
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Quién le acompaña</h2>
            <p className="t-label text-muted-foreground">
              Del equipo de {ministerio.nombre}. Sin un nombre al lado, una lista
              de ausentes no la llama nadie porque todos suponen que llama otro.
            </p>
          </div>

          {equipo.length === 0 ? (
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Este ministerio todavía no tiene a nadie.{' '}
              <Link href={`/panel/ministerios/${id}`} className="underline">
                Súmale gente
              </Link>{' '}
              y vuelve aquí.
            </p>
          ) : (
            <form
              action={asignarAcompanante.bind(null, id, miembroId)}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="hoy" value={hoy} />
              <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <Label htmlFor="responsable">Le acompaña</Label>
                <select
                  id="responsable"
                  name="responsable"
                  defaultValue={acompanaId ?? ''}
                  className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                >
                  <option value="">Sin asignar</option>
                  {equipo.map((p) => (
                    <option key={p.miembroId} value={p.miembroId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline">
                Guardar
              </Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Apuntar un contacto</h2>
            <p className="t-label text-muted-foreground">
              Lo que se intentó y qué pasó. Queda con tu nombre y con la fecha.
            </p>
          </div>

          <form
            action={registrarContacto.bind(null, id)}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="miembroId" value={miembroId} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha">Cuándo</Label>
                <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="via">Cómo</Label>
                <select
                  id="via"
                  name="via"
                  defaultValue="llamada"
                  className={CLASE_SELECT}
                >
                  {VIAS_ELEGIBLES.map((v) => (
                    <option key={v} value={v}>
                      {VIAS[v]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/*
             * Radios y no un desplegable: son siete opciones que el voluntario
             * tiene que LEER antes de elegir, con su explicación al lado. En un
             * `<select>` la ayuda no cabe, y «no contesta» acabaría marcándose
             * para todo por ser la primera que suena razonable.
             */}
            <fieldset className="flex flex-col gap-2">
              <legend className="t-label mb-2">Qué pasó</legend>
              {RESULTADOS_ELEGIBLES.map((r, i) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3 hover:bg-background has-checked:border-primary has-checked:bg-accent"
                >
                  <input
                    type="radio"
                    name="resultado"
                    value={r}
                    defaultChecked={i === 0}
                    className="mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold">
                      {RESULTADOS[r].etiqueta}
                    </span>
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      {RESULTADOS[r].ayuda}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proximoPaso">
                Qué toca ahora
                <span className="ml-1.5 font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="proximoPaso"
                name="proximoPaso"
                maxLength={200}
                placeholder="Llamarla otra vez el sábado por la mañana"
              />
              {/*
               * El aviso va aquí, en el único campo libre del módulo y en el
               * momento exacto en que alguien está a punto de escribir. Una
               * política que nadie abre no habría evitado nada.
               */}
              <p className="t-label text-muted-foreground">
                Un recordatorio, no un informe. Nada de salud, dinero ni
                situación familiar: Hatril no guarda eso, y aquí tampoco.
              </p>
            </div>

            <div>
              <Button type="submit">Apuntar el contacto</Button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
          <h2 className="t-subtitulo">Lo que se ha hablado</h2>

          {contactos.length === 0 ? (
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Todavía nada. Lo que apuntes aquí es lo que evita que la próxima
              persona que abra esta pantalla vuelva a empezar de cero.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {contactos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${RESULTADOS[c.resultado].badge}`}
                      >
                        {RESULTADOS[c.resultado].etiqueta}
                      </span>
                      <span className="text-[13px] text-muted-foreground first-letter:uppercase">
                        {formatearFechaLarga(c.fecha)} · {VIAS[c.via]}
                      </span>
                    </span>
                    {c.proximoPaso && (
                      <span className="text-pretty text-[14px] leading-snug">
                        {c.proximoPaso}
                      </span>
                    )}
                    <span className="text-[12.5px] text-muted-foreground">
                      Lo apuntó {c.autor}
                    </span>
                  </div>

                  <form action={borrarContacto.bind(null, id, miembroId, c.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      title="Borrar este contacto"
                      aria-label="Borrar este contacto"
                    >
                      <Trash2 strokeWidth={1.8} />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Contenedor>
    </>
  );
}

const CLASE_SELECT =
  'h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';
