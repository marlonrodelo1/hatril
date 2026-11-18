import type { FilaIglesiaDetalle } from '@/lib/admin/iglesias-detalle';

/**
 * Orden y búsqueda del listado de iglesias, en el servidor.
 *
 * En el servidor y por `?orden=&dir=`, igual que los filtros van por `?ver=`:
 * la página sigue siendo un componente de servidor, la tabla funciona sin
 * JavaScript y un enlace a «las más grandes» se puede guardar y compartir.
 */

export const ORDENES = ['nombre', 'situacion', 'personas', 'cuentas', 'alta'] as const;
export type Orden = (typeof ORDENES)[number];
export type Direccion = 'asc' | 'desc';

/**
 * Hacia dónde ordena una columna la primera vez que se toca. Los nombres y la
 * situación, de la A a la Z y de lo urgente a lo tranquilo; los números y las
 * fechas, de mayor a menor, que es lo que se busca al tocarlas: las más
 * grandes, las más nuevas.
 */
export const DIRECCION_INICIAL: Record<Orden, Direccion> = {
  nombre: 'asc',
  situacion: 'asc',
  personas: 'desc',
  cuentas: 'desc',
  alta: 'desc',
};

/** Sin `?orden=`: las más nuevas arriba, como estaba la lista. */
export const ORDEN_POR_DEFECTO: Orden = 'alta';

/**
 * El rango de la situación, de lo que más urge a lo que menos. No es el orden
 * alfabético de la insignia («Prueba · 12 días» quedaría antes que «Prueba · 3
 * días»): es el que sirve al ordenar por esa columna, lo que hay que mirar
 * arriba. Las suspendidas al final, porque las suspendió alguien de aquí a
 * propósito; las que pagan, justo antes.
 */
function rangoSituacion(i: FilaIglesiaDetalle): [number, number] {
  if (!i.activa) return [5, 0];
  const e = i.estado;
  switch (e.situacion) {
    case 'bloqueada':
      return [0, 0];
    case 'solo_lectura':
      return [1, e.diasDeGracia];
    case 'termina':
      return [2, e.diasRestantes];
    case 'prueba':
      return [3, e.diasRestantes];
    case 'activa':
      return [4, 0];
  }
}

const porNombre = (a: FilaIglesiaDetalle, b: FilaIglesiaDetalle) =>
  a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

export function ordenarIglesias(
  lista: FilaIglesiaDetalle[],
  orden: Orden,
  dir: Direccion,
): FilaIglesiaDetalle[] {
  const signo = dir === 'asc' ? 1 : -1;
  const comparar = (a: FilaIglesiaDetalle, b: FilaIglesiaDetalle): number => {
    switch (orden) {
      case 'nombre':
        return porNombre(a, b);
      case 'situacion': {
        const [ga, da] = rangoSituacion(a);
        const [gb, db] = rangoSituacion(b);
        return ga - gb || da - db;
      }
      case 'personas':
        return a.personas - b.personas;
      case 'cuentas':
        return a.cuentas - b.cuentas;
      case 'alta':
        return a.createdAt.getTime() - b.createdAt.getTime();
    }
  };
  // El empate, siempre por nombre y siempre de la A a la Z: con dos iglesias
  // de 0 personas, darle la vuelta a la columna no debe barajarlas.
  return [...lista].sort((a, b) => signo * comparar(a, b) || porNombre(a, b));
}

/** Sin tildes ni mayúsculas: «sion» encuentra «Sión» y al revés. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function coincide(i: FilaIglesiaDetalle, q: string): boolean {
  const aguja = normalizar(q);
  return [i.nombre, i.slug, i.ciudad, i.direccion].some(
    (campo) => campo != null && normalizar(campo).includes(aguja),
  );
}
