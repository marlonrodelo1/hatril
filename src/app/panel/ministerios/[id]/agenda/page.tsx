import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarPlus, ChevronRight, MapPin } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { listarReuniones } from '@/lib/asistencia/consultas';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import {
  CONFIRMACIONES,
  confirmacionDeSemanas,
  confirmacionYaEstaba,
  SEMANAS_MAXIMAS,
} from './constantes';

export const metadata: Metadata = { title: 'Agenda del ministerio' };

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    guardado?: string;
    creadas?: string;
    saltadas?: string;
    estaban?: string;
    otras?: string;
  }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error, guardado, creadas, saltadas, estaban, otras } = await searchParams;

  // Las cuentas vienen en la URL, así que se leen como lo que son: algo que
  // cualquiera puede escribir. Fuera de rango, no se enseña nada.
  const confirmacion = textoDeConfirmacion(guardado, {
    creadas: cuenta(creadas),
    saltadas: cuenta(saltadas),
    estaban: cuenta(estaban),
    otras: cuenta(otras),
  });

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const reuniones = await listarReuniones(ctx, { ministerioId: id });

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Ensayos, reuniones y actividades del equipo"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      >
        <Button render={<Link href={`/panel/ministerios/${id}/agenda/nueva`} />}>
          <CalendarPlus strokeWidth={1.8} />
          Apuntar
        </Button>
      </CabeceraPanel>

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="agenda" />

        {error && <Aviso>{error}</Aviso>}
        {confirmacion && <Aviso tipo="ok">{confirmacion}</Aviso>}

        {reuniones.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">La agenda está vacía</h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Apunta el próximo ensayo, la clase del domingo o la salida del
              sábado. Después puedes marcar quién del equipo vino.
            </p>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Lo que se apunte aquí es del equipo y no cuenta para la asistencia
              a los cultos: nadie deja de venir a la iglesia por faltar a un
              ensayo.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reuniones.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/panel/ministerios/${id}/agenda/${r.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-foreground/20 hover:bg-surface-alt hover:no-underline md:px-5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[16px] font-bold tracking-[-0.015em]">
                      {r.titulo}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="first-letter:uppercase">
                        {formatearFechaLarga(r.fecha)}
                      </span>
                      {r.hora && <span>· {r.hora.slice(0, 5)}</span>}
                      {r.lugar && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" strokeWidth={1.8} />
                          {r.lugar}
                        </span>
                      )}
                    </span>
                  </div>

                  {r.marcados === 0 ? (
                    <span className="flex-none rounded-md border border-dashed border-border px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">
                      Sin lista
                    </span>
                  ) : (
                    <span className="flex flex-none flex-col items-end gap-0.5">
                      <span className="text-[20px] font-bold leading-none tracking-[-0.02em]">
                        {r.presentes}
                      </span>
                      <span className="t-micro">de {r.marcados}</span>
                    </span>
                  )}

                  <ChevronRight
                    className="size-4 flex-none text-disabled-text"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Contenedor>
    </>
  );
}

function textoDeConfirmacion(
  guardado: string | undefined,
  n: { creadas: number | null; saltadas: number | null; estaban: number | null; otras: number | null },
): string | null {
  if (guardado === 'semanas') {
    return n.creadas && n.saltadas !== null
      ? confirmacionDeSemanas(n.creadas, n.saltadas)
      : null;
  }
  if (guardado === 'ya-estaba' && n.estaban && n.otras !== null) {
    return confirmacionYaEstaba(n.estaban, n.otras);
  }
  return guardado ? (CONFIRMACIONES[guardado] ?? null) : null;
}

/** Un número de semanas de la URL, entre 0 y el tope, o null. */
function cuenta(valor: string | undefined): number | null {
  const n = Number(valor);
  return valor !== undefined && Number.isInteger(n) && n >= 0 && n <= SEMANAS_MAXIMAS
    ? n
    : null;
}
