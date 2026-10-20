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
import { buttonVariants } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/agenda/constantes';
import {
  Fila,
  FilaEnlace,
  Lista,
  MarcoEquipo,
  Seccion,
  Vacio,
} from '../../_components/marco';
import { Insignia } from '../../_components/insignia';

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

  // Hoy va con lo próximo: es el ensayo de esta noche, el que se abre para
  // pasar lista, y tiene que estar arriba.
  const proximas = reuniones
    .filter((r) => r.fecha >= hoy)
    .sort((a, b) =>
      a.fecha === b.fecha
        ? (a.hora ?? '').localeCompare(b.hora ?? '')
        : a.fecha.localeCompare(b.fecha),
    );
  const anteriores = reuniones.filter((r) => r.fecha < hoy);

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Agenda"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <Link href={`${base}/nueva`} className={buttonVariants({ className: 'self-start' })}>
        <CalendarPlus strokeWidth={1.8} />
        Apuntar en la agenda
      </Link>

      {reuniones.length === 0 && (
        <Vacio
          titulo="La agenda del equipo está vacía"
          accion={
            <Link href={`${base}/nueva`} className={buttonVariants({ variant: 'outline' })}>
              <CalendarPlus strokeWidth={1.8} />
              Apuntar el próximo ensayo
            </Link>
          }
        >
          Apunta el próximo ensayo o reunión y el equipo lo verá en su propia
          agenda. Después, el mismo día, pasas lista desde aquí.
        </Vacio>
      )}

      {proximas.length > 0 && (
        <Seccion rotulo="Próximos">
          <Lista>
            {proximas.map((r) => (
              <FilaReunion key={r.id} reunion={r} href={`${base}/${r.id}`} hoy={hoy} />
            ))}
          </Lista>
        </Seccion>
      )}

      {anteriores.length > 0 && (
        <Seccion rotulo="Anteriores">
          <Lista>
            {anteriores.map((r) => (
              <FilaReunion key={r.id} reunion={r} href={`${base}/${r.id}`} hoy={hoy} />
            ))}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}

function FilaReunion({
  reunion: r,
  href,
  hoy,
}: {
  reunion: ReunionResumen;
  href: string;
  hoy: string;
}) {
  // Solo lo que ya ha llegado tiene lista que pasar.
  const llego = r.fecha <= hoy;

  return (
    <Fila>
      <FilaEnlace
        href={href}
        derecha={
          !llego ? undefined : r.marcados === 0 ? (
            <Insignia tono="neutro" Icono={CircleDashed}>
              Sin lista
            </Insignia>
          ) : (
            <span className="flex-none text-label font-semibold tabular-nums text-muted-foreground">
              {r.presentes} de {r.marcados}
            </span>
          )
        }
      >
        <span className="text-body font-semibold">
          {cuandoCorto(r.fecha, r.hora, hoy)}
        </span>
        <span className="truncate text-label text-muted-foreground">
          {r.titulo}
          {r.lugar && ` · ${r.lugar}`}
        </span>
      </FilaEnlace>
    </Fila>
  );
}
