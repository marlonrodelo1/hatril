import { z } from 'zod';

/**
 * Las rutas de la zona del líder, en un sitio.
 *
 * LA MISMA FORMA QUE EL PANEL, CON OTRO PREFIJO
 * ---------------------------------------------
 * `/panel/ministerios/[id]/turnos/[turnoId]` vive en la app como
 * `/mi/equipo/[id]/turnos/[turnoId]`. No es estética: es lo que permite
 * reutilizar las server actions del panel sin tocarlas. Cada una termina en un
 * `redirect()` a su pantalla del panel, y `enLaApp()` cambia el prefijo y nada
 * más (`traducirAlApp`). Si la app inventara sus propias rutas, cada action
 * necesitaría un parámetro de destino, y esas actions las están tocando a la vez
 * otras tres ramas.
 *
 * Así que un módulo que quiera pantalla en la app la pone donde la tiene en el
 * panel, con los mismos nombres de carpeta, y no tiene que explicar nada más.
 *
 * SIN `server-only`: lo usan pantallas y actions, y no toca la base.
 */

export const RAIZ_APP = '/mi/equipo';
const RAIZ_PANEL = '/panel/ministerios';

const Uuid = z.string().uuid();

/**
 * La ruta de la app para este ministerio y lo que cuelgue de él.
 *
 * Valida que cada trozo sea un uuid o un nombre de carpeta conocido, porque los
 * ids de una action vienen de un `.bind()` que viaja al navegador y vuelve. Un
 * id con `?`, `#` o `/` dentro cambiaría a dónde lleva el `redirect()`; nunca
 * fuera del sitio —el prefijo es fijo—, pero sí a una pantalla que no tocaba.
 * Ante la duda, a la portada del ministerio, o a la raíz si el propio
 * ministerio no vale.
 */
export function rutaApp(ministerioId: string, ...resto: string[]): string {
  if (!Uuid.safeParse(ministerioId).success) return RAIZ_APP;

  const base = `${RAIZ_APP}/${ministerioId}`;
  if (!resto.every((t) => Uuid.safeParse(t).success || /^[a-z-]+$/.test(t))) {
    return base;
  }
  return [base, ...resto].join('/');
}

/**
 * De un destino del panel a su gemelo de la app.
 *
 * Solo traduce lo que tiene gemelo: `/panel/ministerios…` entero, y
 * `/panel/hoy`, que es a donde manda por defecto `requirePermisoAccion` cuando
 * falta un permiso —a un líder que no lo tiene, la portada de su zona le dice
 * lo mismo sin sacarle de la app—. Lo demás pasa tal cual: `/suscripcion`,
 * `/acceso` o `/mi` ya son destinos que valen desde aquí.
 *
 * Conserva la consulta y el ancla: `?guardado=asignado`, `?error=…`,
 * `#canciones`. Son lo que pinta el aviso y lo que baja a la sección.
 */
export function traducirAlApp(url: string): string {
  if (url === RAIZ_PANEL || /^\/panel\/ministerios[/?#]/.test(url)) {
    return RAIZ_APP + url.slice(RAIZ_PANEL.length);
  }
  if (url === '/panel/hoy' || /^\/panel\/hoy[?#]/.test(url)) {
    return RAIZ_APP + url.slice('/panel/hoy'.length);
  }
  return url;
}
