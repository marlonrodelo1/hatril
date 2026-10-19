import type { Metadata } from 'next';
import { Check, Inbox, Phone } from 'lucide-react';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import {
  listarSolicitudesPendientes,
  sugerirFichas,
  type FichaSugerida,
} from '@/lib/solicitudes/consultas';
import { iniciales } from '@/lib/format/iniciales';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { EleccionDeFicha } from './_components/eleccion-ficha';
import { aprobarSolicitud, rechazarSolicitud } from './actions';

export const metadata: Metadata = { title: 'Solicitudes' };

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requirePermiso('aprobar_solicitudes');
  const { error } = await searchParams;
  const solicitudes = await listarSolicitudesPendientes(ctx);

  // Hoy solo el pastor puede resolverlas: la base no deja a nadie más activar
  // ni borrar una membresía (ver la cabecera de `actions.ts`). Quien tiene
  // `aprobar_solicitudes` sin ser pastor sigue viendo la bandeja, pero sin
  // botones que acabarían en un error después de pulsar.
  const puedeResolver = esPastor(ctx);

  // Vacío para quien no ve la congregación entera: ver `sugerirFichas`. Y sin
  // calcular para quien no puede aprobar: sugerir es enseñar fichas del
  // fichero, y aquí no le servirían para nada.
  const sugerencias = puedeResolver
    ? await sugerirFichas(ctx, solicitudes)
    : new Map<string, FichaSugerida[]>();

  return (
    <>
      <CabeceraPanel
        titulo="Solicitudes"
        subtitulo={
          solicitudes.length === 0
            ? 'No hay nadie esperando'
            : `${solicitudes.length} ${solicitudes.length === 1 ? 'persona espera' : 'personas esperan'} ${puedeResolver ? 'tu respuesta' : 'respuesta'}`
        }
      />

      <Contenedor>
        {/* Hasta ahora esta pantalla no leía `?error`, y la guard de la action
            ya redirigía aquí con uno: el mensaje se perdía. */}
        {error && <Aviso>{error}</Aviso>}

        {solicitudes.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <span className="flex size-13 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="size-6" strokeWidth={1.5} />
            </span>
            <div className="flex max-w-[400px] flex-col gap-1.5">
              <span className="text-[18px] font-bold tracking-[-0.02em]">
                Nadie esperando
              </span>
              <span className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
                Cuando alguien pida unirse a la iglesia desde el directorio,
                aparecerá aquí para que lo aprobéis.
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* El aviso va arriba y una sola vez, no repetido en cada tarjeta:
                lo que se está decidiendo es lo mismo para todas.

                Por lo mismo se queda fuera de la rejilla, a todo el ancho: es
                contexto de la pantalla entera, no de una solicitud. Metido en la
                primera celda parecería referirse solo a esa persona. */}
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] leading-snug text-muted-foreground">
              {puedeResolver ? (
                <>
                  Quien apruebes pasará a ver el contenido interno de la iglesia
                  y entrará en el fichero de miembros. Si no reconoces a
                  alguien, pregunta antes de aprobar.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-foreground">
                    Hoy las aprueba el pastor.
                  </strong>{' '}
                  Aquí puedes ver quién está esperando; si alguien lleva tiempo,
                  avísale.
                </>
              )}
            </p>

            {/* Dos columnas a partir de `lg`. Cada tarjeta es alta —nombre,
                contacto, mensaje y la fila de acciones— y apiladas en una sola
                columna obligan a bajar la página con media pantalla en blanco al
                lado. Por debajo de 1024 px se quedan apiladas: a media anchura de
                tableta, el campo de motivo y sus botones no caben en una línea. */}
            <div className="grid gap-4 lg:grid-cols-2">
              {solicitudes.map((s) => {
                const fichas = sugerencias.get(s.id);

                /*
                 * `secondary` —el carbón de apoyo— y no el naranja de
                 * marca.
                 *
                 * «Aprobar» está dentro del `map` de solicitudes: con seis
                 * personas esperando salían seis botones naranjas
                 * idénticos, y en dos columnas la pantalla entera se
                 * volvía naranja. La regla del sistema es un solo botón
                 * naranja por pantalla, y una acción que se repite por
                 * fila no puede ser esa.
                 *
                 * Fue verde hasta el 15-oct, cuando `support` pasó a ser
                 * el carbón de Claude. Lo que se mantiene es el relleno: un
                 * botón macizo pesa más que el contorno de «Rechazar», y
                 * esa es la jerarquía entre las dos.
                 */
                const botonAprobar = (
                  <Button type="submit" variant="secondary">
                    <Check strokeWidth={2} />
                    Aprobar
                  </Button>
                );

                return (
                  <article
                    key={s.id}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="flex size-11 flex-none items-center justify-center rounded-full bg-accent text-[14px] font-bold text-accent-foreground">
                        {iniciales(s.nombre)}
                      </span>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[17px] font-bold tracking-[-0.018em]">
                          {s.nombre}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13.5px] text-muted-foreground">
                          {s.email && <span>{s.email}</span>}
                          {s.telefono && (
                            <a
                              href={`tel:${s.telefono}`}
                              className="inline-flex items-center gap-1 font-medium"
                            >
                              <Phone className="size-3.5" strokeWidth={1.7} />
                              {formatearTelefono(s.telefono)}
                            </a>
                          )}
                        </div>
                        <span className="text-[12.5px] text-muted-foreground">
                          Pidió unirse el {formatearFecha(s.createdAt)}
                        </span>
                      </div>
                    </div>

                    {s.mensaje && (
                      <p className="text-pretty rounded-lg border border-border bg-surface-alt px-4 py-3 text-[14.5px] leading-relaxed">
                        {s.mensaje}
                      </p>
                    )}

                    {/* Con fichas que coinciden, aprobar deja de ser un botón
                        suelto. La elección tiene que ir en el MISMO `<form>` que
                        «Aprobar» para viajar con él, y no cabe en la fila de los
                        botones: el bloque entero va encima y el rechazo se queda
                        solo en la fila de abajo. */}
                    {puedeResolver && fichas && (
                      <form
                        action={aprobarSolicitud.bind(null, s.id)}
                        className="flex flex-col items-start gap-3"
                      >
                        <EleccionDeFicha
                          nombre={s.nombre}
                          aceptaAsistencia={s.aceptaAsistencia}
                          fichas={fichas}
                        />
                        {botonAprobar}
                      </form>
                    )}

                    {/* `flex-wrap` en la fila y también dentro del formulario de
                        rechazo: a media anchura, «Aprobar» + campo de motivo +
                        «Rechazar» no siempre caben en una línea, y sin envolver el
                        campo se comería a los botones hasta dejarlos ilegibles. */}
                    {puedeResolver && (
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Cada acción en su propio formulario. Con las dos en
                            el mismo, la tecla Enter dentro del campo de motivo
                            dispararía la aprobación, que es justo lo contrario
                            de lo que se está escribiendo. */}
                        {!fichas && (
                          <form action={aprobarSolicitud.bind(null, s.id)}>
                            {botonAprobar}
                          </form>
                        )}

                        <form
                          action={rechazarSolicitud.bind(null, s.id)}
                          className="flex flex-1 flex-wrap items-center gap-2.5"
                        >
                          <input
                            type="text"
                            name="motivo"
                            maxLength={300}
                            placeholder="Motivo, si quieres decírselo (opcional)"
                            aria-label={`Motivo para rechazar a ${s.nombre}`}
                            className="h-10 min-w-[200px] flex-1 rounded-lg border border-border bg-surface-alt px-3 text-[14px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                          />
                          <Button type="submit" variant="outline">
                            Rechazar
                          </Button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Contenedor>
    </>
  );
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });
}
