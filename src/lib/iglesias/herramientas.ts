import { Wallet, type LucideIcon } from 'lucide-react';
import { z } from 'zod';

/**
 * Las herramientas de la IGLESIA ENTERA que el pastor puede apagar.
 *
 * El otro nivel de `lib/ministerios/modulos.ts`. Aquellos son de un equipo y
 * los enciende quien gobierna los ministerios; estas son de la congregación, y
 * solo el pastor decide si las tiene. Viven en `iglesias.modulos`.
 *
 * AL REVÉS QUE LOS DE MINISTERIO: LA CLAVE AUSENTE ES «ENCENDIDA»
 * ---------------------------------------------------------------
 * Un ministerio nace sin nada y se le encienden herramientas. Una iglesia ya
 * tenía su caja antes de que existiera el interruptor, y la columna llegó vacía
 * (`0043`): si «vacío» significara «apagado», todas las iglesias se habrían
 * quedado sin Finanzas el lunes. Así que aquí solo se guarda lo que el pastor
 * apagó: `{ finanzas: { activo: false } }`.
 *
 * APAGAR OCULTA, NO BORRA
 * -----------------------
 * Fuera del menú, fuera de Inicio y sus rutas dan 404, pero los datos siguen
 * ahí y se siguen tratando. Al volver a encender, todo está como estaba. La
 * pantalla lo dice con esas palabras para que nadie apague creyendo que borra.
 *
 * Hoy solo Finanzas. Eventos, Reuniones y Devocionales entrarán aquí cuando se
 * decida qué pasa con lo que ya publican (un evento abierto en la web, un
 * devocional del día): apagar una caja no deja a nadie de fuera a medias, y
 * apagar eso sí.
 *
 * SIN `server-only`: lo leen el menú y las pantallas, y no toca la base.
 */

export const HERRAMIENTAS_IGLESIA = [
  {
    id: 'finanzas',
    nombre: 'Finanzas',
    descripcion:
      'El libro de caja: lo que entra y lo que sale, los fondos, el arqueo del culto y el informe del mes.',
    Icono: Wallet,
  },
] as const satisfies readonly {
  id: string;
  nombre: string;
  descripcion: string;
  Icono: LucideIcon;
}[];

export type HerramientaIglesia = (typeof HERRAMIENTAS_IGLESIA)[number];
export type HerramientaIglesiaId = HerramientaIglesia['id'];

/**
 * Permisivo con las claves y con lo que cuelga de cada una, como
 * `EsquemaModulos`: una fila escrita por una versión posterior no puede hacer
 * que se lea mal la entera.
 */
const Esquema = z.record(
  z.string(),
  z.object({ activo: z.boolean() }).catchall(z.unknown()),
);

/**
 * ¿Está encendida? Todo lo que no sea un `activo: false` explícito cuenta como
 * sí, también una columna que no valida: equivocarse hacia «encendida» enseña
 * una pantalla que el pastor puede apagar; hacia «apagada», le quita la caja a
 * una iglesia sin que nadie lo haya decidido.
 */
export function herramientaEncendida(
  modulos: unknown,
  id: HerramientaIglesiaId,
): boolean {
  const leido = Esquema.safeParse(modulos);
  if (!leido.success) return true;
  return leido.data[id]?.activo !== false;
}

/** El atajo de la única que hay hoy, para no escribir el id en cada guarda. */
export function finanzasEncendida(iglesia: { modulos: unknown }): boolean {
  return herramientaEncendida(iglesia.modulos, 'finanzas');
}

/**
 * El jsonb con una herramienta encendida o apagada y lo demás intacto.
 *
 * Encender quita la clave en vez de escribir `activo: true`: así la columna
 * vuelve a `{}` y sigue diciendo solo lo que el pastor apagó. Lo que cuelgue de
 * otras claves —configuración futura, herramientas de otra versión— se conserva.
 */
export function conHerramienta(
  anterior: unknown,
  id: HerramientaIglesiaId,
  encendida: boolean,
): Record<string, unknown> {
  const leido = Esquema.safeParse(anterior);
  const previo: Record<string, unknown> = leido.success ? { ...leido.data } : {};

  if (encendida) {
    delete previo[id];
  } else {
    previo[id] = { activo: false };
  }
  return previo;
}
