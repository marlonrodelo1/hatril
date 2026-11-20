import Link from 'next/link';
import { CalendarPlus, CircleDashed } from 'lucide-react';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import type { ReunionResumen } from '@/lib/asistencia/consultas';
import { buttonVariants } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/agenda/constantes';
import { Fila, FilaEnlace, Lista, MarcoEquipo, Seccion, Vacio } from '../../_components/marco';
import { Insignia } from '../../_components/insignia';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosAgendaEquipo = Awaited<ReturnType<typeof cargar>>;

export function VistaAgendaEquipo({ id, error, guardado, ctx, ministerio, hoy, reuniones, base, proximas, anteriores }: DatosAgendaEquipo) {
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
