/**
 * Las pantallas de `/mi/equipo` que la app pide a `/api/v1/app/mi/equipo/*`.
 *
 * Una sola tabla para los dos lados: la API la usa para saber qué `cargar`
 * ejecutar (cada pantalla tiene el suyo, con su guarda, en su `datos.ts`), y
 * la app para saber qué vista pintar. Una dirección que no esté aquí no
 * existe para ninguno de los dos: 404.
 *
 * `busqueda` son los parámetros de la dirección que la pantalla lee, los
 * mismos que su página de la web.
 */
export const PANTALLAS_EQUIPO = [
  { nombre: 'equipos', patron: [], busqueda: ['error'] },
  { nombre: 'portada', patron: [':id'], busqueda: ['error'] },
  { nombre: 'fondo', patron: [':id', 'fondo'], busqueda: ['mes'] },
  { nombre: 'turnos', patron: [':id', 'turnos'], busqueda: ['error', 'guardado'] },
  { nombre: 'planificar', patron: [':id', 'turnos', 'planificar'], busqueda: ['error'] },
  { nombre: 'turno', patron: [':id', 'turnos', ':turnoId'], busqueda: ['error', 'guardado'] },
  { nombre: 'agenda', patron: [':id', 'agenda'], busqueda: ['error', 'guardado'] },
  { nombre: 'reunionNueva', patron: [':id', 'agenda', 'nueva'], busqueda: ['error'] },
  { nombre: 'reunion', patron: [':id', 'agenda', ':reunionId'], busqueda: ['error', 'guardado'] },
  { nombre: 'reunionEditar', patron: [':id', 'agenda', ':reunionId', 'editar'], busqueda: ['error'] },
  { nombre: 'repertorio', patron: [':id', 'repertorio'], busqueda: ['error', 'guardado', 'q', 'archivadas'] },
  { nombre: 'cancionNueva', patron: [':id', 'repertorio', 'nueva'], busqueda: ['error'] },
  { nombre: 'cancion', patron: [':id', 'repertorio', ':cancionId'], busqueda: ['error', 'guardado'] },
  { nombre: 'seguimiento', patron: [':id', 'seguimiento'], busqueda: ['error', 'guardado'] },
  { nombre: 'persona', patron: [':id', 'seguimiento', ':miembroId'], busqueda: ['error', 'guardado'] },
  // Las células: la red (de quien la lleva), la célula de su líder y sus temas.
  { nombre: 'grupos', patron: [':id', 'grupos'], busqueda: ['error', 'guardado'] },
  { nombre: 'grupo', patron: [':id', 'grupos', ':grupoId'], busqueda: ['error', 'guardado', 'semana', 'cambiar'] },
  { nombre: 'grupoTemas', patron: [':id', 'grupos', ':grupoId', 'temas'], busqueda: ['error'] },
  { nombre: 'ninos', patron: [':id', 'ninos'], busqueda: ['error', 'guardado'] },
  { nombre: 'ninosCronograma', patron: [':id', 'ninos', 'cronograma'], busqueda: [] },
  { nombre: 'ninosFamilias', patron: [':id', 'ninos', 'familias'], busqueda: ['error', 'guardado'] },
  {
    nombre: 'ninosPublicacion',
    patron: [':id', 'ninos', 'publicacion', ':publicacionId'],
    busqueda: ['error', 'guardado'],
  },
] as const;

export type NombrePantallaEquipo = (typeof PANTALLAS_EQUIPO)[number]['nombre'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Qué pantalla es una dirección y con qué parámetros. Los segmentos fijos
 * (`turnos`, `nueva`) ganan a los variables, que tienen que ser uuid: así
 * `agenda/nueva` no se confunde con una reunión llamada «nueva».
 */
export function emparejarPantalla(
  segmentos: readonly string[],
): { nombre: NombrePantallaEquipo; params: Record<string, string>; busqueda: readonly string[] } | null {
  const candidatas = PANTALLAS_EQUIPO.filter((p) => p.patron.length === segmentos.length);
  // Primero las que tienen más segmentos fijos.
  const ordenadas = [...candidatas].sort(
    (a, b) => b.patron.filter((s) => !s.startsWith(':')).length - a.patron.filter((s) => !s.startsWith(':')).length,
  );
  for (const p of ordenadas) {
    const params: Record<string, string> = {};
    const casa = p.patron.every((trozo, i) => {
      const valor = segmentos[i]!;
      if (trozo.startsWith(':')) {
        if (!UUID.test(valor)) return false;
        params[trozo.slice(1)] = valor;
        return true;
      }
      return trozo === valor;
    });
    if (casa) return { nombre: p.nombre, params, busqueda: p.busqueda };
  }
  return null;
}
