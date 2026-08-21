import { CalendarClock, HeartHandshake, type LucideIcon } from 'lucide-react';
import { z } from 'zod';

/**
 * Qué se puede HACER dentro de un ministerio.
 *
 * POR QUÉ MÓDULOS Y NO UNA PANTALLA POR TIPO
 * ------------------------------------------
 * Un ministerio de alabanza y uno de consolidación no hacen el mismo trabajo:
 * el primero necesita ensayos y canciones, el segundo necesita saber quién
 * lleva cinco domingos sin venir. Una pantalla única para los dos no sirve.
 *
 * Programar una pantalla a medida por tipo tampoco: la lista no está cerrada.
 * Hay iglesias con ministerio de radio, de reparto de alimentos, de «Ángeles de
 * la Noche». El que no estuviera en la lista se quedaría sin nada hasta que
 * alguien lo programara.
 *
 * Así que se programan piezas, y cada tipo de ministerio enciende las suyas
 * (`tipos.ts`). El pastor puede encender y apagar a mano, de modo que un
 * ministerio que nadie previó funciona sin tocar código.
 *
 * SIN `server-only`, A PROPÓSITO
 * ------------------------------
 * Lo importan pantallas de servidor y componentes de cliente, igual que
 * `panel/secciones.ts`. Por eso no toca base de datos y los iconos se
 * construyen aquí: un componente de React no es serializable y cruzar la
 * frontera servidor→cliente con uno dentro rompe el render.
 *
 * SOLO ESTÁ LO QUE FUNCIONA
 * -------------------------
 * Dos módulos, y son los dos que existen de verdad. Repertorio de canciones,
 * turnos de rotación, inventario de instrumentos, vínculo con las familias y
 * peticiones de oración están decididos y NO se declaran aquí hasta que se
 * puedan pulsar. Un interruptor que enciende una pestaña vacía hace parecer
 * roto un producto que funciona — la misma regla que `panel/secciones.ts`.
 */

type ModuloDeclarado = {
  id: string;
  nombre: string;
  descripcion: string;
  Icono: LucideIcon;
};

export const MODULOS_MINISTERIO = [
  {
    id: 'agenda',
    nombre: 'Agenda del equipo',
    /* En segunda persona porque quien lo lee es el pastor decidiendo. */
    descripcion:
      'Ensayos, reuniones y actividades del ministerio, con quién vino a cada una.',
    Icono: CalendarClock,
  },
  {
    id: 'seguimiento',
    nombre: 'Seguimiento de personas',
    descripcion:
      'Quién lleva tiempo sin venir, quién le acompaña y qué se ha hablado con esa persona.',
    Icono: HeartHandshake,
  },
] as const satisfies readonly ModuloDeclarado[];

export type ModuloMinisterio = (typeof MODULOS_MINISTERIO)[number];
export type ModuloId = ModuloMinisterio['id'];

const POR_ID = new Map<string, ModuloMinisterio>(
  MODULOS_MINISTERIO.map((m) => [m.id, m]),
);

/**
 * Lo que se guarda en `ministerios.modulos`.
 *
 * Un mapa `{ agenda: { activo: true } }` y no un array de identificadores,
 * porque cada módulo va a querer su propia configuración —a los cuántos
 * domingos avisar, qué día es el ensayo— y con un array habría que inventarse
 * una segunda columna el día que llegue la primera.
 *
 * `catchall` deja pasar esa configuración futura sin que este esquema la
 * conozca. Lo único que se exige hoy es `activo`.
 */
const Config = z.object({ activo: z.boolean() }).catchall(z.unknown());

/**
 * Deliberadamente permisivo con las CLAVES: acepta cualquier cadena y el
 * filtrado a módulos conocidos lo hace `modulosActivos()`.
 *
 * Si esto fuera un `z.enum` de los módulos que existen hoy, una fila escrita
 * por una versión posterior del producto —o por una edición a mano en la base—
 * no fallaría la validación de un módulo: la fallaría **entera**, y el
 * ministerio se quedaría sin ninguno. Es el mismo criterio de
 * `colorDeMinisterio()`: un valor desconocido cae al defecto, no revienta la
 * pantalla.
 */
export const EsquemaModulos = z.record(z.string(), Config);

export type ModulosGuardados = z.infer<typeof EsquemaModulos>;

/**
 * Los módulos encendidos de un ministerio, en el orden del catálogo.
 *
 * Acepta `unknown` porque es lo que devuelve Drizzle para una columna jsonb, y
 * porque el contenido real de esa columna no lo garantiza el tipo: lo garantiza
 * esta función. Cualquier cosa que no valide —null, un array, la config de un
 * módulo que ya no existe— sale como lista vacía o se descarta.
 */
export function modulosActivos(valor: unknown): ModuloMinisterio[] {
  const leido = EsquemaModulos.safeParse(valor);
  if (!leido.success) return [];

  return MODULOS_MINISTERIO.filter((m) => leido.data[m.id]?.activo === true);
}

/** ¿Está encendido este módulo? */
export function tieneModulo(valor: unknown, modulo: ModuloId): boolean {
  return modulosActivos(valor).some((m) => m.id === modulo);
}

/**
 * Construye el jsonb a partir de las casillas marcadas.
 *
 * Conserva la configuración que ya hubiera guardada para un módulo, y apagar no
 * la borra: un ministerio que apaga la agenda por un mes y la vuelve a encender
 * no debería perder sus ajustes por el camino. Lo que no está en el catálogo se
 * descarta, para que la columna no acumule basura.
 */
export function componerModulos(
  anterior: unknown,
  encendidos: string[],
): ModulosGuardados {
  const leido = EsquemaModulos.safeParse(anterior);
  const previo: ModulosGuardados = leido.success ? leido.data : {};
  const marcados = new Set(encendidos);

  const salida: ModulosGuardados = {};
  for (const m of MODULOS_MINISTERIO) {
    salida[m.id] = { ...previo[m.id], activo: marcados.has(m.id) };
  }
  return salida;
}

/** El módulo, o `null` si el identificador no está en el catálogo. */
export function moduloPorId(id: string): ModuloMinisterio | null {
  return POR_ID.get(id) ?? null;
}

/**
 * ¿Nadie ha decidido todavía qué herramientas lleva este ministerio?
 *
 * Distinguir «nunca se configuró» de «se apagó todo a propósito» importa: los
 * ministerios que existían antes de esta columna tienen `{}`, y a esos les
 * corresponde la plantilla de su tipo. A quien apagó las dos casillas y guardó
 * hay que respetarle la decisión, y esa fila NO está vacía —`componerModulos()`
 * escribe siempre las dos claves, con `activo: false`—, así que las dos
 * situaciones no se confunden.
 */
export function sinConfigurar(valor: unknown): boolean {
  const leido = EsquemaModulos.safeParse(valor);
  if (!leido.success) return true;
  return MODULOS_MINISTERIO.every((m) => leido.data[m.id] === undefined);
}
