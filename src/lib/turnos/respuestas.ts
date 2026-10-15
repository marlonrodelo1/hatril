import { CircleCheck, CircleDashed, CircleX, type LucideIcon } from 'lucide-react';

import type { RespuestaTurno } from '@/lib/db/schema/turnos';

/**
 * Cómo se cuenta cada respuesta, según quién la lea.
 *
 * DOS VOCES PARA EL MISMO DATO
 * ----------------------------
 * El responsable lee «Sin contestar»; la persona, «Sin confirmar». Es la misma
 * fila, y la frase cambia porque la pregunta cambia: al responsable le importa
 * si tiene que llamar a alguien, y a la persona, si tiene algo pendiente.
 *
 * Y siempre con icono: el sistema de diseño pide que un estado no dependa solo
 * del color, y en una pantalla oscura el verde y el ámbar se distinguen peor de
 * lo que parece.
 *
 * Sin `server-only`: lo pintan la agenda (servidor) y la hoja del día (cliente).
 */
export const ETIQUETA_RESPUESTA: Record<
  RespuestaTurno,
  { miembro: string; equipo: string; clase: string; Icono: LucideIcon }
> = {
  pendiente: {
    miembro: 'Sin confirmar',
    equipo: 'Sin contestar',
    clase: 'bg-badge-neutral-bg text-badge-neutral-fg',
    Icono: CircleDashed,
  },
  confirmado: {
    miembro: 'Confirmado',
    equipo: 'Confirmado',
    clase: 'bg-badge-success-bg text-badge-success-fg',
    Icono: CircleCheck,
  },
  no_puede: {
    miembro: 'Has dicho que no puedes',
    equipo: 'No puede',
    clase: 'bg-badge-danger-bg text-badge-danger-fg',
    Icono: CircleX,
  },
};
