import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { MarcoEquipo } from '../../../../_components/marco';
import { FormularioReunion } from '../../_components/formulario';
import { editarReunionDeMinisterio } from '../../actions';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosReunionEditar = Awaited<ReturnType<typeof cargar>>;

export function VistaReunionEditar({ id, reunionId, error, ctx, ministerio, reunion }: DatosReunionEditar) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Cambiar"
      subtitulo={`${reunion.titulo} · ${ministerio.nombre}`}
      volver={rutaApp(id, 'agenda', reunionId)}
      error={error}
    >
      <FormularioReunion
        accion={editarReunionDeMinisterio.bind(null, id, reunionId)}
        reunion={reunion}
        hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
        texto="Guardar los cambios"
      />
    </MarcoEquipo>
  );
}
