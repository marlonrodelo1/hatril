import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, CircleDashed } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import {
  listarReuniones,
  type ReunionResumen,
} from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Button } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/agenda/constantes';
import {
  FilaEnlace,
  Lista,
  MarcoEquipo,
  Rotulo,
  Vacio,
} from '../../_components/marco';

export const metadata: Metadata = { title: 'Agenda del equipo' };

/**
 * La agenda del equipo en la app: lo que viene y lo que ya pasó, con la lista
 * de cada uno.
 *
 * Lo que ya pasó lleva «Sin lista» cuando nadie la pasó, que no es lo mismo que
 * «no vino nadie» (ver `ReunionResumen.marcados`). Es lo único de esta lista
 * que pide algo, y por eso es lo único con icono.
 */
export default async function AgendaEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const reuniones = await listarReuniones(ctx, { ministerioId: id, limite: 40 });
  const base = rutaApp(id, 'agenda');

  const proximas = reuniones
    .filter((r) => r.fecha > hoy)
    .sort((a, b) =>
      a.fecha === b.fecha
        ? (a.hora ?? '').localeCompare(b.hora ?? '')
        : a.fecha.localeCompare(b.fecha),
    );
  // Las de hoy van con las pasadas: es donde se pasa lista, y el ensayo de esta
  // noche tiene que estar a mano para hacerlo.
  const pasadas = reuniones.filter((r) => r.fecha <= hoy);

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Agenda"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <Button className="self-start" render={<Link href={`${base}/nueva`} />}>
        <CalendarPlus strokeWidth={1.8} />
        Apuntar en la agenda
      </Button>

      {reuniones.length === 0 && (
        <Vacio>
          <p>
            No hay nada en la agenda del equipo. Apunta el próximo ensayo o
            reunión y el equipo lo verá en su propia agenda.
          </p>
        </Vacio>
      )}

      {proximas.length > 0 && (
        <>
          <Rotulo>Lo que viene</Rotulo>
          <Lista>
            {proximas.map((r) => (
              <Fila key={r.id} reunion={r} href={`${base}/${r.id}`} hoy={hoy} />
            ))}
          </Lista>
        </>
      )}

      {pasadas.length > 0 && (
        <>
          <Rotulo>Hoy y antes</Rotulo>
          <Lista>
            {pasadas.map((r) => (
              <Fila key={r.id} reunion={r} href={`${base}/${r.id}`} hoy={hoy} conLista />
            ))}
          </Lista>
        </>
      )}
    </MarcoEquipo>
  );
}

function Fila({
  reunion: r,
  href,
  hoy,
  conLista,
}: {
  reunion: ReunionResumen;
  href: string;
  hoy: string;
  /** Solo lo que ya ha llegado tiene lista que pasar. */
  conLista?: boolean;
}) {
  return (
    <li>
      <FilaEnlace
        href={href}
        derecha={
          conLista ? (
            r.marcados === 0 ? (
              <span className="inline-flex flex-none items-center gap-1 rounded-md bg-badge-neutral-bg px-2 py-0.5 text-[12px] font-semibold text-badge-neutral-fg">
                <CircleDashed className="size-3" strokeWidth={2.2} aria-hidden />
                Sin lista
              </span>
            ) : (
              <span className="flex-none text-[13px] font-semibold tabular-nums text-muted-foreground">
                {r.presentes} de {r.marcados}
              </span>
            )
          ) : undefined
        }
      >
        <span className="text-[15px] font-bold tracking-[-0.012em]">
          {cuandoCorto(r.fecha, r.hora, hoy)}
        </span>
        <span className="truncate text-[13.5px] text-muted-foreground">
          {r.titulo}
          {r.lugar && ` · ${r.lugar}`}
        </span>
      </FilaEnlace>
    </li>
  );
}
