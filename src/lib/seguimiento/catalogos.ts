import type {
  resultadoContactoEnum,
  viaContactoEnum,
} from '@/lib/db/schema/seguimiento';

/**
 * Cómo se dicen en pantalla la vía y el resultado de un contacto.
 *
 * Sin `server-only`: lo piden pantallas de servidor y el formulario, igual que
 * `miembros/estados.ts`. Y como `Record<X, …>`, para que añadir un valor al enum
 * no compile hasta que alguien escriba cómo se llama en castellano — es la misma
 * red que `ETIQUETAS_PERMISOS`.
 *
 * LAS PALABRAS IMPORTAN MÁS DE LO NORMAL AQUÍ
 * -------------------------------------------
 * Esta lista es lo que un voluntario va a marcar sobre una persona de su
 * congregación, y lo que el pastor va a leer después. «No contesta» describe un
 * hecho; «no quiere saber nada» sería un juicio sobre alguien que a lo mejor
 * tenía el teléfono roto. Se nombran hechos, nunca intenciones.
 */

export type ViaContacto = (typeof viaContactoEnum.enumValues)[number];
export type ResultadoContacto =
  (typeof resultadoContactoEnum.enumValues)[number];

export const VIAS: Record<ViaContacto, string> = {
  llamada: 'Una llamada',
  whatsapp: 'Un mensaje',
  visita: 'Una visita a su casa',
  presencial: 'Hablando en persona',
};

export const VIAS_ELEGIBLES: ViaContacto[] = [
  'llamada',
  'whatsapp',
  'visita',
  'presencial',
];

export const RESULTADOS: Record<
  ResultadoContacto,
  { etiqueta: string; ayuda: string; badge: string }
> = {
  contactado: {
    etiqueta: 'Hablamos',
    ayuda: 'Se habló con la persona y no hay nada más que apuntar.',
    badge: 'bg-[#E4EDE9] text-[#2F5D50]',
  },
  volvera: {
    etiqueta: 'Va a volver',
    ayuda: 'Dijo que cuenta con venir.',
    badge: 'bg-[#E4EDE9] text-[#2F5D50]',
  },
  no_contesta: {
    etiqueta: 'No contestó',
    // Se dice explícitamente que esto no juzga a nadie: es la marca que más se
    // va a usar y la que más fácilmente se lee como «pasa de nosotros».
    ayuda: 'No cogió el teléfono o no abrió. Sin más.',
    badge: 'bg-[#F6EDD9] text-[#7E5F13]',
  },
  se_mudo: {
    etiqueta: 'Se mudó',
    ayuda: 'Ya no vive cerca.',
    badge: 'bg-muted text-muted-foreground',
  },
  molesto_con_la_iglesia: {
    etiqueta: 'Está molesto con la iglesia',
    ayuda: 'Lo que una iglesia necesita saber para poder arreglarlo.',
    badge: 'bg-[#F3E0D6] text-[#9C3A11]',
  },
  sin_contacto: {
    etiqueta: 'No hay forma de localizarle',
    ayuda: 'Teléfono que no existe, dirección vieja.',
    badge: 'bg-muted text-muted-foreground',
  },
  derivado_al_pastor: {
    etiqueta: 'Lo lleva el pastorado',
    ayuda: 'Excede lo que un voluntario debe llevar.',
    badge: 'bg-[#F7E4DA] text-[#BD4715]',
  },
};

/** El orden del desplegable: de lo más frecuente a lo más excepcional. */
export const RESULTADOS_ELEGIBLES: ResultadoContacto[] = [
  'contactado',
  'volvera',
  'no_contesta',
  'se_mudo',
  'molesto_con_la_iglesia',
  'sin_contacto',
  'derivado_al_pastor',
];
