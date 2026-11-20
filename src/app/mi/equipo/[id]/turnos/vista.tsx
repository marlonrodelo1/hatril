import Link from 'next/link';
import { CalendarPlus, ChevronRight, CircleCheck, CircleDashed, CircleX, TriangleAlert } from 'lucide-react';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { estadoDeTurno, textoDelEstado, type EstadoDeTurno } from '@/lib/turnos/estado';
import { buttonVariants } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/turnos/constantes';
import { Fila, FilaEnlace, Lista, MarcoEquipo, Seccion, Vacio } from '../../_components/marco';
import { Insignia } from '../../_components/insignia';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosTurnos = Awaited<ReturnType<typeof cargar>>;

export function VistaTurnos({ id, error, guardado, ctx, ministerio, hoy, puestos, base, proximos, anteriores }: DatosTurnos) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Turnos"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <Link href={`${base}/planificar`} className={buttonVariants({ className: 'self-start' })}>
        <CalendarPlus strokeWidth={1.8} />
        Planificar cultos
      </Link>

      <Seccion rotulo="Próximos">
        {proximos.length === 0 ? (
          <Vacio
            titulo="No hay turnos por delante"
            accion={
              <Link
                href={`${base}/planificar`}
                className={buttonVariants({ variant: 'outline' })}
              >
                <CalendarPlus strokeWidth={1.8} />
                Planificar las próximas semanas
              </Link>
            }
          >
            Elige en qué cultos de las próximas semanas sirve el equipo y
            después pon a cada persona en su puesto. A quien tenga la aplicación
            le llega el aviso y confirma desde su agenda.
          </Vacio>
        ) : (
          // Una tarjeta por culto, como en el panel: cada uno trae su estado,
          // y es lo que se viene a mirar.
          <ul className="flex flex-col gap-2.5">
            {proximos.map((t) => (
              <li key={t.id}>
                <TarjetaTurno
                  href={`${base}/${t.id}`}
                  cuando={cuandoCorto(t.fecha, t.hora, hoy)}
                  titulo={t.titulo}
                  estado={estadoDeTurno(t, puestos)}
                />
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {anteriores.length > 0 && (
        <Seccion rotulo="Anteriores">
          <Lista>
            {anteriores.map((t) => {
              const personas = new Set(t.personas.map((p) => p.miembroId)).size;
              return (
                <Fila key={t.id}>
                  <FilaEnlace href={`${base}/${t.id}`}>
                    <span className="text-body font-semibold">
                      {cuandoCorto(t.fecha, t.hora, hoy)}
                    </span>
                    <span className="truncate text-label text-muted-foreground">
                      {t.titulo} · {personas} {personas === 1 ? 'persona' : 'personas'}
                    </span>
                  </FilaEnlace>
                </Fila>
              );
            })}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}
/**
 * Un culto por delante: cuándo, cuál, y en una insignia lo peor que tiene.
 *
 * La insignia elige UN estado —no puede, sin cubrir, sin contestar o
 * confirmado—, en ese orden, porque es el orden en que hay que hacer algo. El
 * detalle va debajo en texto, con los nombres de los puestos.
 */
function TarjetaTurno({
  href,
  cuando,
  titulo,
  estado,
}: {
  href: string;
  cuando: string;
  titulo: string;
  estado: EstadoDeTurno;
}) {
  const detalle = textoDelEstado(estado);
  const insignia =
    estado.noPueden.length > 0
      ? { tono: 'peligro' as const, texto: 'No puede', Icono: CircleX }
      : estado.vacio || estado.huecos.length > 0
        ? { tono: 'aviso' as const, texto: 'Sin cubrir', Icono: TriangleAlert }
        : estado.sinContestar > 0
          ? { tono: 'neutro' as const, texto: 'Sin contestar', Icono: CircleDashed }
          : { tono: 'exito' as const, texto: 'Confirmado', Icono: CircleCheck };

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-support-hover hover:bg-surface-alt hover:no-underline"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-body font-semibold">{cuando}</span>
          <Insignia tono={insignia.tono} Icono={insignia.Icono}>
            {insignia.texto}
          </Insignia>
        </span>
        <span className="truncate text-label text-muted-foreground">{titulo}</span>
        <span className="text-pretty text-label text-muted-foreground">
          {detalle ?? 'Todo cubierto y confirmado'}
        </span>
      </span>
      <ChevronRight
        className="mt-0.5 size-4 flex-none text-disabled-text"
        strokeWidth={1.8}
        aria-hidden
      />
    </Link>
  );
}
