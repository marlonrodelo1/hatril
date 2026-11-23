import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import type { EntradaCronograma } from '@/lib/ninos/consultas';
import { Fila, Lista, MarcoEquipo, Seccion, Vacio } from '../../../_components/marco';
import type { cargar } from './datos';

/**
 * El cronograma en la app: para leerlo el domingo. Lo apunta la responsable
 * en el panel; aquí no hay formulario ni ficha de cada clase.
 *
 * Lo próximo arriba, de cerca a lejos. Lo pasado, plegado: con doce semanas
 * apuntadas empujaría lo de este domingo fuera de la pantalla.
 */
export type DatosCronograma = Awaited<ReturnType<typeof cargar>>;

export function VistaCronograma({ id, ctx, ministerio, proximas, pasadas }: DatosCronograma) {
  return (
    <MarcoEquipo ctx={ctx} titulo="Cronograma" subtitulo={ministerio.nombre} volver={rutaApp(id, 'ninos')}>
      <p className="px-1 text-label text-muted-foreground">
        Solo lo ven los maestros y el pastor. Las clases las apunta la responsable desde el panel.
      </p>

      {proximas.length === 0 ? (
        <Vacio titulo="No hay clases apuntadas por delante">
          Cuando la responsable apunte la del próximo domingo, con su tema y sus
          puntos, saldrá aquí.
        </Vacio>
      ) : (
        <Seccion rotulo="Próximas">
          <Clases entradas={proximas} />
        </Seccion>
      )}

      {pasadas.length > 0 && (
        <details className="flex flex-col gap-2">
          <summary className="t-micro cursor-pointer px-1">Anteriores ({pasadas.length})</summary>
          <div className="mt-2.5">
            <Clases entradas={pasadas} />
          </div>
        </details>
      )}
    </MarcoEquipo>
  );
}

function Clases({ entradas }: { entradas: EntradaCronograma[] }) {
  return (
    <Lista>
      {entradas.map((e) => (
        <Fila key={e.id}>
          <div className="flex flex-col gap-1 px-4 py-3 md:px-5">
            <span className="text-label font-semibold text-muted-foreground">
              {formatearFechaLarga(e.fecha)}
              {e.maestro ? ` · ${e.maestro.nombre}` : ''}
            </span>
            <span className="text-body font-semibold">{e.tema}</span>
            {e.puntos && (
              <span className="whitespace-pre-line text-label leading-snug text-muted-foreground">{e.puntos}</span>
            )}
          </div>
        </Fila>
      ))}
    </Lista>
  );
}
