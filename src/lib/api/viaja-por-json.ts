/**
 * ¿Llega a la app lo mismo que sale del servidor?
 *
 * La API de la app empaquetada (`/api/v1/app/*`) manda JSON, y JSON no sabe
 * llevar todo lo que una pantalla de la web recibe sin problema por props. Lo
 * que no sabe llevar no da error al enviarlo: llega cambiado, y se rompe en el
 * teléfono.
 *
 *   - Un `Set` o un `Map` llegan como `{}`. Así se cayó la pantalla del turno
 *     del equipo en el iPhone el 23-nov: «h.has is not a function».
 *   - Un componente (una función) desaparece. Así se cayó la portada de Equipo
 *     el 22-nov: `TarjetaModulo` pintaba `modulo.Icono`.
 *
 * Las fechas sí valen: la app las revive (`movil/src/lib/api.ts`).
 *
 * Devuelve la ruta de lo primero que no viaja (`respuesta.enLista`), o `null`.
 * Lo usa `endpointApp` fuera de producción, para que una pantalla así dé un
 * 500 en `npm run dev` y en `test:puertas:app` en vez de llegar a un teléfono.
 */
export function loQueNoViaja(valor: unknown, ruta = 'respuesta', vistos = new Set<object>()): string | null {
  if (valor === null || valor === undefined) return null;
  const tipo = typeof valor;
  if (tipo === 'string' || tipo === 'number' || tipo === 'boolean') return null;
  if (tipo !== 'object') return `${ruta} (${tipo})`;

  const objeto = valor as object;
  if (objeto instanceof Date) return null;
  if (vistos.has(objeto)) return null;
  vistos.add(objeto);

  if (Array.isArray(objeto)) {
    for (let i = 0; i < objeto.length; i++) {
      const dentro = loQueNoViaja(objeto[i], `${ruta}[${i}]`, vistos);
      if (dentro) return dentro;
    }
    return null;
  }

  const proto = Object.getPrototypeOf(objeto);
  if (proto !== Object.prototype && proto !== null) {
    return `${ruta} (${objeto.constructor?.name ?? 'objeto de una clase'})`;
  }
  for (const [clave, dentro] of Object.entries(objeto)) {
    const mal = loQueNoViaja(dentro, `${ruta}.${clave}`, vistos);
    if (mal) return mal;
  }
  return null;
}
