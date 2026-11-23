import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { MarcoEquipo } from '../../../_components/marco';
import { FormularioReunion } from '../_components/formulario';
import { crearReunionDeMinisterio } from '../actions';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosReunionNueva = Awaited<ReturnType<typeof cargar>>;

export function VistaReunionNueva({ id, error, ctx, ministerio }: DatosReunionNueva) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Apuntar en la agenda"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id, 'agenda')}
      error={error}
    >
      <FormularioReunion
        accion={crearReunionDeMinisterio.bind(null, id)}
        hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
        texto="Apuntar"
      />
    </MarcoEquipo>
  );
}
