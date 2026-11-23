import 'server-only';

import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';

// Un cron: no hay usuario, y recorre las iglesias de todos. Es uno de los
// usos de `dbAdmin` que permite el CLAUDE.md.
import { dbAdmin } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { coordenadasDeLugar, lugaresConfigurados } from './google';

/**
 * Las coordenadas que vinieron de Google, al día con sus condiciones.
 *
 * Google solo deja guardar una latitud y una longitud de Places 30 días
 * seguidos (ver la cabecera de la migración `0063`). Este refresco:
 *
 *   1. Pide de nuevo las de cada iglesia con más de `REFRESCAR_A_LOS_DIAS`,
 *      con su `lugar_google_id`, y las guarda con la fecha de hoy.
 *   2. Borra las que hayan pasado de 30 días sin poder refrescarse: Google no
 *      contesta, el sitio ya no existe, o el cron no corrió. La iglesia deja de
 *      salir en «cerca» hasta que el pastor la vuelva a poner; es lo que pide
 *      la condición, y es mejor que una ubicación vieja sin permiso.
 *
 * Lo llama `POST /api/v1/cron/lugares` una vez al día. Con un margen de cinco
 * días, un par de días sin cron no borra nada.
 */
const REFRESCAR_A_LOS_DIAS = 25;
const CADUCAN_A_LOS_DIAS = 30;

export type ResultadoRefresco = {
  refrescadas: number;
  borradas: number;
  errores: string[];
};

export async function refrescarCoordenadas(): Promise<ResultadoRefresco> {
  const resultado: ResultadoRefresco = { refrescadas: 0, borradas: 0, errores: [] };

  // Sin clave no se puede refrescar nada, pero sí borrar lo caducado: la
  // condición de Google no deja de valer porque falte la clave.
  if (lugaresConfigurados()) {
    const pendientes = await dbAdmin
      .select({ id: iglesias.id, lugar: iglesias.lugarGoogleId })
      .from(iglesias)
      .where(
        and(
          isNotNull(iglesias.lugarGoogleId),
          lt(
            iglesias.coordenadasGoogleEn,
            sql`now() - make_interval(days => ${REFRESCAR_A_LOS_DIAS})`,
          ),
        ),
      );

    // Una a una: son pocas, y así un fallo de Google no se lleva a las demás.
    for (const p of pendientes) {
      try {
        const c = await coordenadasDeLugar(p.lugar!);
        if (!c) continue; // El sitio ya no existe: caducará abajo, a su día.
        await dbAdmin
          .update(iglesias)
          .set({ latitud: c.latitud, longitud: c.longitud, coordenadasGoogleEn: new Date() })
          .where(and(eq(iglesias.id, p.id), eq(iglesias.lugarGoogleId, p.lugar!)));
        resultado.refrescadas++;
      } catch (error) {
        resultado.errores.push(`${p.id}: ${error instanceof Error ? error.message : 'error'}`);
      }
    }
  }

  const borradas = await dbAdmin
    .update(iglesias)
    .set({ latitud: null, longitud: null, lugarGoogleId: null, coordenadasGoogleEn: null })
    .where(
      lt(iglesias.coordenadasGoogleEn, sql`now() - make_interval(days => ${CADUCAN_A_LOS_DIAS})`),
    )
    .returning({ id: iglesias.id });
  resultado.borradas = borradas.length;

  return resultado;
}
