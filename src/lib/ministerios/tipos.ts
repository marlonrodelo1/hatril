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
  /**
   * No es solo una etiqueta. Es el nombre con que nace el ministerio al pulsar
   * «Activar» en `/panel/modulos` —y sale en la web pública de la iglesia—, y
   * es como el catálogo reconoce los que se crearon antes de que hubiera tipos
   * (`repartirPorTipo()`). Cambiarlo cambia las dos cosas: un «Niños» guardado
   * como «Otro» dejaría de contar, y «Activar» crearía otro equipo al lado con
   * el nombre nuevo. Lo que se quiera contar de más, en la descripción.
   */
  nombre: string;
  descripcion: string;
  modulos: readonly ModuloId[];
  /**
   * Los puestos con los que arrancan los turnos de un equipo de este tipo.
   *
   * Van en todos los tipos, también en los que no encienden turnos de salida:
   * el pastor puede encenderlos a mano en cualquier ministerio, y un cuadrante
   * que se abre sin ningún puesto es una pantalla en blanco que no explica qué
   * hacer. Después el responsable los cambia por los suyos.
   */
  puestos: readonly string[];
};

export const TIPOS_MINISTERIO = [
  {
    id: 'alabanza',
    nombre: 'Alabanza',
    descripcion: 'Música y canto en los cultos. Ensayos y equipo de sonido.',
    modulos: ['agenda', 'turnos', 'repertorio'],
    puestos: [
      'Dirección',
      'Voces',
      'Guitarra',
      'Bajo',
      'Batería',
      'Teclado',
      'Sonido',
    ],
  },
  {
    id: 'consolidacion',
    nombre: 'Consolidación',
    descripcion:
      'Acompañar a quien llega nuevo y a quien ha dejado de venir, para que nadie se pierda por el camino.',
    modulos: ['seguimiento', 'agenda'],
    puestos: ['Bienvenida', 'Consolidación'],
  },
  {
    id: 'ninos',
    nombre: 'Niños',
    descripcion: 'Escuela dominical y actividades de los más pequeños.',
    modulos: ['agenda', 'turnos'],
    puestos: ['Maestro o maestra', 'Auxiliar', 'Recepción de niños'],
  },
  {
    id: 'jovenes',
    nombre: 'Jóvenes',
    descripcion: 'Reuniones, campamentos y actividades de la juventud.',
    modulos: ['agenda'],
    puestos: ['Dirección', 'Alabanza', 'Recepción'],
  },
  {
    id: 'intercesion',
    nombre: 'Intercesión',
    descripcion: 'Oración por la iglesia, por sus necesidades y por su gente.',
    modulos: ['agenda', 'turnos'],
    puestos: ['Antes del culto', 'Durante el culto', 'Ministración'],
  },
  {
    id: 'ujieres',
    nombre: 'Ujieres y protocolo',
    descripcion: 'Recibir, acomodar y que el culto transcurra con orden.',
    modulos: ['turnos', 'agenda'],
    puestos: ['Puerta principal', 'Pasillo', 'Ofrenda', 'Parqueadero'],
  },
  {
    id: 'evangelismo',
    nombre: 'Evangelismo',
    descripcion:
      'Salidas, visitas y el contacto con quien todavía no es de la casa.',
    modulos: ['agenda', 'seguimiento'],
    puestos: ['Equipo de calle', 'Visitas'],
  },
  {
    id: 'accion_social',
    nombre: 'Acción social',
    descripcion: 'Reparto de alimentos, ayuda a familias y salidas a la calle.',
    modulos: ['agenda'],
    puestos: ['Reparto', 'Cocina', 'Recogida'],
  },
  {
    id: 'medios',
    nombre: 'Medios y comunicación',
    descripcion: 'Sonido, transmisión y redes sociales.',
    modulos: ['turnos', 'agenda'],
    puestos: [
      'Sonido',
      'Proyección',
      'Cámara',
      'Transmisión',
      'Redes sociales',
    ],
  },
  {
    /*
     * Tipo propio y no dentro de Medios: una radio tiene parrilla, locutores y
     * una señal que escucha la congregación, y el equipo de sonido del culto no
     * necesita nada de eso. Medios puede encender la emisora a mano.
     */
    id: 'radio',
    nombre: 'Radio',
    descripcion:
      'La emisora de la iglesia: la señal en directo, la programación y quién presenta cada programa.',
    modulos: ['emisora', 'turnos', 'agenda'],
    puestos: ['Locución', 'Control técnico', 'Producción', 'Redes'],
  },
  {
    id: 'otro',
    nombre: 'Otro',
    descripcion:
      'Cualquier equipo que no encaje arriba. Enciende tú lo que necesite.',
    modulos: ['agenda'],
    puestos: ['Equipo'],
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

/** Los puestos con los que arrancan sus turnos. */
export function puestosDelTipo(id: string | null | undefined): string[] {
  return [...tipoDeMinisterio(id).puestos];
}
