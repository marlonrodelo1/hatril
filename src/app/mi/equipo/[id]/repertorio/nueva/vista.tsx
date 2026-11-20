import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { MarcoEquipo } from '../../../_components/marco';
import { FormularioCancion } from '../_components/formulario';
import { crearCancion } from '../actions';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosCancionNueva = Awaited<ReturnType<typeof cargar>>;

export function VistaCancionNueva({ id, error, ctx, ministerio }: DatosCancionNueva) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Apuntar una canción"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id, 'repertorio')}
      error={error}
    >
      <FormularioCancion accion={crearCancion.bind(null, id)} texto="Apuntarla" />
    </MarcoEquipo>
  );
}
