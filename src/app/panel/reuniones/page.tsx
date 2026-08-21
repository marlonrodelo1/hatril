import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, ChevronRight, MapPin } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { listarReuniones } from '@/lib/asistencia/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { CONFIRMACIONES } from './constantes';

export const metadata: Metadata = { title: 'Reuniones' };

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const reuniones = await listarReuniones(ctx);

  return (
    <>
      <CabeceraPanel
        titulo="Reuniones"
        subtitulo="Los cultos de la congregación y quién vino a cada uno"
      >
        <Button render={<Link href="/panel/reuniones/nueva" />}>
          <CalendarPlus strokeWidth={1.8} />
          Apuntar reunión
        </Button>
      </CabeceraPanel>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {reuniones.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">Todavía no has apuntado ninguna</h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Apunta el culto del domingo y marca quién vino. Con dos o tres
              semanas apuntadas, el panel puede decirte quién lleva tiempo sin
              aparecer, que es el dato que casi ninguna iglesia tiene.
            </p>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Los horarios que se repiten cada semana no van aquí: eso se pone en
              Ajustes. Aquí va cada domingo concreto, con su fecha.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reuniones.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/panel/reuniones/${r.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-[#D5CCBE] hover:bg-[#FBF9F5] hover:no-underline md:px-5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[16px] font-bold tracking-[-0.015em]">
                      {r.titulo}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="first-letter:uppercase">
                        {/* `capitalize` de Tailwind pone mayúscula en CADA
                            palabra y saldría «Domingo, 24 De Agosto». */}
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

                  <Asistencia presentes={r.presentes} marcados={r.marcados} />

                  <ChevronRight
                    className="size-4 flex-none text-[#A79E93]"
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

/**
 * Cuánta gente vino, o el aviso de que nadie lo apuntó.
 *
 * Los dos estados se distinguen a propósito y no se colapsan en «0»: una reunión
 * sin lista no es una reunión a la que no fue nadie, y enseñar un cero donde
 * falta el dato es la manera más rápida de que el pastor deje de fiarse de la
 * cifra de al lado.
 */
function Asistencia({
  presentes,
  marcados,
}: {
  presentes: number;
  marcados: number;
}) {
  if (marcados === 0) {
    return (
      <span className="flex-none rounded-md border border-dashed border-border px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">
        Sin lista
      </span>
    );
  }

  return (
    <span className="flex flex-none flex-col items-end gap-0.5">
      <span className="text-[20px] font-bold leading-none tracking-[-0.02em]">
        {presentes}
      </span>
      <span className="t-micro">de {marcados}</span>
    </span>
  );
}
