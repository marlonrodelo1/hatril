import 'server-only';

import { and, asc, eq } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { ministerios } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { COLORES_MINISTERIO, type ColorMinisterio } from './colores';
import {
  TIPOS_MINISTERIO,
  TIPO_POR_DEFECTO,
  tipoDeMinisterio,
  type TipoMinisterioId,
} from './tipos';

/**
 * El catálogo de `/panel/modulos`: qué tipos de ministerio se activan con un
 * botón y qué hay ya en marcha de cada uno.
 *
 * SIN TABLA PROPIA
 * ----------------
 * Para un ministerio, «activo» es que exista uno activo de ese tipo —o uno sin
 * tipo con su nombre, ver `repartirPorTipo()`—. Una tabla de «módulos
 * activados» sería una segunda verdad que se desincroniza en cuanto alguien
 * archiva un equipo desde su pantalla.
 */

/**
 * Los tipos que se activan desde el catálogo. Todos menos «Otro».
 *
 * «Otro» no tiene nombre por defecto que sirva: activarlo crearía un ministerio
 * llamado «Otro». Ese caso va al formulario completo, donde se le pone nombre.
 */
export const TIPOS_ACTIVABLES = TIPOS_MINISTERIO.filter(
  (t) => t.id !== TIPO_POR_DEFECTO,
);

export type MinisterioDelCatalogo = {
  id: string;
  nombre: string;
  colorHex: string;
};

/** Lo que una iglesia tiene en marcha de un tipo. */
export type TipoEnLaIglesia = {
  /** Los activos guardados con este tipo. */
  delTipo: MinisterioDelCatalogo[];
  /**
   * Los activos SIN tipo que se llaman como él: el «Jóvenes» de antes de la
   * 0028, que nació como «Otro» porque entonces no había nada que elegir.
   */
  porNombre: MinisterioDelCatalogo[];
};

/**
 * El nombre tal como lo compara el catálogo: sin mayúsculas, sin acentos y sin
 * espacios de más. «Ujieres y Protocolo» es «Ujieres y protocolo», y «Jovenes»
 * tecleado sin tilde es «Jóvenes».
 */
function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const TIPO_POR_NOMBRE = new Map<string, TipoMinisterioId>(
  TIPOS_ACTIVABLES.map((t) => [normalizarNombre(t.nombre), t.id]),
);

/**
 * Reparte los ministerios activos entre las tarjetas del catálogo.
 *
 * El tipo se resuelve con `tipoDeMinisterio()`, así que uno guardado con un tipo
 * que el catálogo ya no conoce cae en «Otro» en vez de desaparecer de la lista.
 *
 * POR QUÉ TAMBIÉN POR NOMBRE
 * --------------------------
 * Todo lo creado antes de la 0028 tiene tipo 'otro', que es el defecto de la
 * columna. Mirando solo el tipo, el catálogo da por inexistente el «Jóvenes»
 * que la iglesia lleva años usando, ofrece «Activar», y eso fabrica
 * «Jóvenes 2» al lado.
 *
 * Solo se mira el nombre de los que están en «Otro». Un tipo elegido a mano ya
 * dice lo que es el ministerio, y adivinarle otro por cómo se llama sería
 * enmendarle la plana a quien lo eligió.
 *
 * Pura, y la usan la página y la action: si discreparan, la tarjeta ofrecería
 * «Activar» y el botón haría otra cosa.
 */
export function repartirPorTipo(
  filas: readonly (MinisterioDelCatalogo & { tipo: string })[],
): Map<TipoMinisterioId, TipoEnLaIglesia> {
  const reparto = new Map<TipoMinisterioId, TipoEnLaIglesia>();
  const de = (tipo: TipoMinisterioId) => {
    let entrada = reparto.get(tipo);
    if (!entrada) {
      entrada = { delTipo: [], porNombre: [] };
      reparto.set(tipo, entrada);
    }
    return entrada;
  };

  for (const f of filas) {
    const m = { id: f.id, nombre: f.nombre, colorHex: f.colorHex };
    const tipo = tipoDeMinisterio(f.tipo).id;
    const homonimo =
      tipo === TIPO_POR_DEFECTO
        ? TIPO_POR_NOMBRE.get(normalizarNombre(f.nombre))
        : undefined;

    // Uno u otro, nunca los dos: el «Jóvenes» sin tipo sale en la tarjeta de
    // Jóvenes y no se repite en la de «Algo que no está en la lista».
    if (homonimo) de(homonimo).porNombre.push(m);
    else de(tipo).delTipo.push(m);
  }
  return reparto;
}

/** Los ministerios activos de la iglesia, repartidos por tarjeta. */
export async function ministeriosActivosPorTipo(
  ctx: UserContext,
): Promise<Map<TipoMinisterioId, TipoEnLaIglesia>> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        colorHex: ministerios.colorHex,
        tipo: ministerios.tipo,
      })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre)),
  );

  return repartirPorTipo(filas);
}

/**
 * El nombre del tipo, o «Alabanza 2», «Alabanza 3»… si ya está cogido.
 *
 * `ocupados` tiene que incluir los ministerios ARCHIVADOS:
 * `uq_ministerios_iglesia_nombre` no es parcial, así que un equipo que se cerró
 * hace dos años sigue reteniendo su nombre, y no hay pantalla para renombrar uno
 * archivado. Un error de «ese nombre ya existe» sería un callejón sin salida.
 *
 * Compara en minúsculas porque el índice lo hace con `lower()`. Si JavaScript y
 * Postgres discreparan en algún carácter raro, el índice sigue mandando y la
 * action lo recoge como violación de único.
 */
export function nombreLibre(base: string, ocupados: readonly string[]): string {
  const usados = new Set(ocupados.map((n) => n.toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;

  for (let n = 2; ; n++) {
    const candidato = `${base} ${n}`;
    if (!usados.has(candidato.toLowerCase())) return candidato;
  }
}

/**
 * El color menos repetido entre los ministerios activos; a igualdad, el primero
 * de la paleta.
 *
 * Con menos de cinco equipos sale uno que nadie usa. Con más, se reparten en
 * vez de acabar todos en naranja: el color está para distinguirlos de un
 * vistazo en el listado de miembros.
 */
export function colorLibre(usados: readonly string[]): ColorMinisterio['hex'] {
  const veces = new Map<string, number>(
    COLORES_MINISTERIO.map((c) => [c.hex.toLowerCase(), 0]),
  );
  for (const hex of usados) {
    const clave = hex.toLowerCase();
    const actual = veces.get(clave);
    if (actual !== undefined) veces.set(clave, actual + 1);
  }

  let elegido: ColorMinisterio = COLORES_MINISTERIO[0];
  for (const c of COLORES_MINISTERIO) {
    if (veces.get(c.hex.toLowerCase())! < veces.get(elegido.hex.toLowerCase())!) {
      elegido = c;
    }
  }
  return elegido.hex;
}
