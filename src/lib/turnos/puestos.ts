import { z } from 'zod';

import { configDeModulo } from '@/lib/ministerios/modulos';
import { puestosDelTipo } from '@/lib/ministerios/tipos';

/**
 * Los puestos de un equipo: «Guitarra», «Puerta principal», «Proyección».
 *
 * VIVEN EN LA CONFIGURACIÓN DEL MÓDULO, NO EN UNA TABLA
 * -----------------------------------------------------
 * En `ministerios.modulos.turnos.puestos`, que es justo el hueco que el jsonb
 * dejó para esto (ver `Config` en `modulos.ts`). Una tabla costaría cuatro
 * policies, dos triggers y una migración para guardar una lista de nombres que
 * se lee siempre junto a su ministerio.
 *
 * Y las asignaciones no apuntan aquí: copian el texto. Renombrar un puesto no
 * reescribe el pasado (ver `turno_asignaciones.puesto`).
 *
 * SIN `server-only`: lo usan las pantallas y las actions, y no toca la base.
 */

/** Un equipo con más puestos que esto no es un cuadrante, es un fichero. */
export const MAX_PUESTOS = 20;

/** El mismo tope que el CHECK de la `0037`. */
export const MAX_LARGO_PUESTO = 40;

const EsquemaConfigTurnos = z.object({
  puestos: z.array(z.string()).optional(),
});

/**
 * Los puestos de este ministerio, en su orden.
 *
 * Si el responsable no ha escrito los suyos, los de la plantilla de su tipo. Lo
 * que no valide —un array de números, una config de otra versión— cae también a
 * la plantilla: un cuadrante sin filas no le sirve a nadie.
 */
export function puestosDelMinisterio(ministerio: {
  tipo: string;
  modulos: unknown;
}): string[] {
  const leido = EsquemaConfigTurnos.safeParse(
    configDeModulo(ministerio.modulos, 'turnos'),
  );
  const guardados = leido.success ? limpiarPuestos(leido.data.puestos ?? []) : [];

  return guardados.length > 0 ? guardados : puestosDelTipo(ministerio.tipo);
}

/**
 * De lo que escribió el responsable a la lista que se guarda.
 *
 * Recorta, quita vacíos y repetidos —sin distinguir mayúsculas, como el índice
 * `uq_turno_puesto_miembro`— y conserva el primero que aparezca. No lanza: lo
 * que no cabe lo detecta `validarPuestos()`, que da el mensaje.
 */
export function limpiarPuestos(lista: string[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];

  for (const bruto of lista) {
    const puesto = bruto.replace(/\s+/g, ' ').trim();
    if (!puesto) continue;
    const clave = puesto.toLocaleLowerCase('es');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(puesto);
  }

  return salida;
}

/** El mensaje de por qué no se puede guardar esta lista, o `null` si se puede. */
export function validarPuestos(lista: string[]): string | null {
  if (lista.length === 0) return 'Escribe al menos un puesto.';
  if (lista.length > MAX_PUESTOS) {
    return `Como mucho ${MAX_PUESTOS} puestos. Si hacen falta más, quizá son dos equipos.`;
  }
  const largo = lista.find((p) => p.length > MAX_LARGO_PUESTO);
  if (largo) {
    return `«${largo.slice(0, 24)}…» es demasiado largo. Basta con un nombre corto.`;
  }
  return null;
}
