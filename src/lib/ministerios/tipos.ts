import type { ModuloId } from './modulos';

/**
 * De qué va cada ministerio.
 *
 * El tipo no es decoración: es lo que decide qué herramientas nacen encendidas
 * (`modulos` en `modulos.ts`). Elegir «Consolidación» tiene que dejar el
 * ministerio listo para trabajar, no pedirle al pastor que adivine qué
 * interruptores tocar.
 *
 * TEXTO Y NO ENUM DE POSTGRES
 * ---------------------------
 * El conjunto no está cerrado y no lo va a estar nunca: hay iglesias con
 * ministerio de radio, de reparto de alimentos, de «Ángeles de la Noche». Un
 * enum obligaría a una migración por cada tipo nuevo, y el valor vive en una
 * columna `text` con este catálogo delante.
 *
 * Lo que un valor desconocido NO puede hacer es romper una pantalla, y de eso
 * se encarga `tipoDeMinisterio()`: cae a «Otro», igual que `colorDeMinisterio()`
 * cae al gris.
 *
 * LA PLANTILLA ES UN PUNTO DE PARTIDA, NO UNA JAULA
 * -------------------------------------------------
 * `modulos` solo se aplica al elegir el tipo. Después el pastor enciende y
 * apaga lo que quiera desde la pantalla de edición, y cambiar de tipo no le
 * borra lo que hubiera configurado a mano. Si la plantilla mandara siempre,
 * este catálogo sería exactamente la pantalla a medida por tipo que se decidió
 * no construir.
 */

type TipoDeclarado = {
  id: string;
  nombre: string;
  descripcion: string;
  modulos: readonly ModuloId[];
};

export const TIPOS_MINISTERIO = [
  {
    id: 'alabanza',
    nombre: 'Alabanza',
    descripcion: 'Música y canto en los cultos. Ensayos y equipo de sonido.',
    modulos: ['agenda'],
  },
  {
    id: 'consolidacion',
    nombre: 'Consolidación',
    descripcion:
      'Acompañar a quien llega nuevo y a quien ha dejado de venir, para que nadie se pierda por el camino.',
    modulos: ['seguimiento', 'agenda'],
  },
  {
    id: 'ninos',
    nombre: 'Niños',
    descripcion: 'Escuela dominical y actividades de los más pequeños.',
    modulos: ['agenda'],
  },
  {
    id: 'jovenes',
    nombre: 'Jóvenes',
    descripcion: 'Reuniones, campamentos y actividades de la juventud.',
    modulos: ['agenda'],
  },
  {
    id: 'intercesion',
    nombre: 'Intercesión',
    descripcion: 'Oración por la iglesia, por sus necesidades y por su gente.',
    modulos: ['agenda'],
  },
  {
    id: 'ujieres',
    nombre: 'Ujieres y protocolo',
    descripcion: 'Recibir, acomodar y que el culto transcurra con orden.',
    modulos: ['agenda'],
  },
  {
    id: 'evangelismo',
    nombre: 'Evangelismo',
    descripcion:
      'Salidas, visitas y el contacto con quien todavía no es de la casa.',
    modulos: ['agenda', 'seguimiento'],
  },
  {
    id: 'accion_social',
    nombre: 'Acción social',
    descripcion: 'Reparto de alimentos, ayuda a familias y salidas a la calle.',
    modulos: ['agenda'],
  },
  {
    id: 'medios',
    nombre: 'Medios y comunicación',
    descripcion: 'Sonido, transmisión, redes sociales y radio.',
    modulos: ['agenda'],
  },
  {
    id: 'otro',
    nombre: 'Otro',
    descripcion:
      'Cualquier equipo que no encaje arriba. Enciende tú lo que necesite.',
    modulos: ['agenda'],
  },
] as const satisfies readonly TipoDeclarado[];

export type TipoMinisterio = (typeof TIPOS_MINISTERIO)[number];
export type TipoMinisterioId = TipoMinisterio['id'];

/** El que se guarda si nadie elige, y al que cae cualquier valor desconocido. */
export const TIPO_POR_DEFECTO: TipoMinisterioId = 'otro';

const POR_ID = new Map<string, TipoMinisterio>(
  TIPOS_MINISTERIO.map((t) => [t.id, t]),
);

/**
 * El tipo de un ministerio.
 *
 * Nunca devuelve `null`: un ministerio guardado con un tipo que este catálogo
 * ya no conoce se pinta como «Otro» y sigue funcionando.
 */
export function tipoDeMinisterio(id: string | null | undefined): TipoMinisterio {
  return POR_ID.get(id ?? '') ?? POR_ID.get(TIPO_POR_DEFECTO)!;
}

/** Los módulos que enciende una plantilla. */
export function modulosDelTipo(id: string | null | undefined): ModuloId[] {
  return [...tipoDeMinisterio(id).modulos];
}
