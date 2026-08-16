import type { Metadata } from 'next';
import { Check, Inbox, Phone } from 'lucide-react';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { listarSolicitudesPendientes } from '@/lib/solicitudes/consultas';
import { iniciales } from '@/lib/format/iniciales';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import { Button } from '@/components/ui/button';
import { aprobarSolicitud, rechazarSolicitud } from './actions';

export const metadata: Metadata = { title: 'Solicitudes' };

export default async function SolicitudesPage() {
  const ctx = await requirePermiso('aprobar_solicitudes');
  const solicitudes = await listarSolicitudesPendientes(ctx);

  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Solicitudes
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {solicitudes.length === 0
            ? 'No hay nadie esperando'
            : `${solicitudes.length} ${solicitudes.length === 1 ? 'persona espera' : 'personas esperan'} tu respuesta`}
        </p>
      </header>

      <div className="flex w-full max-w-[860px] flex-col gap-4 px-5 pb-12 pt-6 md:px-8">
        {solicitudes.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <span className="flex size-13 items-center justify-center rounded-full bg-background text-muted-foreground">
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
                lo que se está decidiendo es lo mismo para todas. */}
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] leading-snug text-muted-foreground">
              Quien apruebes pasará a ver el contenido interno de la iglesia y
              entrará en el fichero de miembros. Si no reconoces a alguien,
              pregunta antes de aprobar.
            </p>

            {solicitudes.map((s) => (
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

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Cada acción en su propio formulario. Con las dos en el
                      mismo, la tecla Enter dentro del campo de motivo dispararía
                      la aprobación, que es justo lo contrario de lo que se está
                      escribiendo. */}
                  <form action={aprobarSolicitud.bind(null, s.id)}>
                    <Button type="submit">
                      <Check strokeWidth={2} />
                      Aprobar
                    </Button>
                  </form>

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
              </article>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });
}
