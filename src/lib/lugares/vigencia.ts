import { sql } from 'drizzle-orm';

import { iglesias } from '@/lib/db/schema';

/**
 * Las coordenadas que se pueden enseñar: las del pastor siempre, y las de
 * Google solo sus 30 días (migración `0063`, `./refresco.ts`).
 *
 * El cron ya borra las caducadas. Esto es por si no corre: sin él la iglesia
 * deja de salir en «cerca» y su mapa desaparece de la ficha, en vez de seguir
 * enseñando una ubicación que ya no se puede tener. Se ve, y se arregla
 * programando el cron.
 */
export const coordenadasVigentes = sql`(${iglesias.coordenadasGoogleEn} is null or ${iglesias.coordenadasGoogleEn} > now() - interval '30 days')`;

/** Para un `select`: la latitud, o null si ya no se puede enseñar. */
export const latitudVigente = sql<
  number | null
>`case when ${coordenadasVigentes} then ${iglesias.latitud} end`;

export const longitudVigente = sql<
  number | null
>`case when ${coordenadasVigentes} then ${iglesias.longitud} end`;
