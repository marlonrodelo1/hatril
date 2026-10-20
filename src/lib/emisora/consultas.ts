import 'server-only';

import { and, asc, eq, sql } from 'drizzle-orm';

import { dbAdmin, withUser } from '@/lib/db';
import { ministerios } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { emisoraDeConfig, type Programa } from './config';

/**
 * Dónde se lee la radio fuera de su pantalla: el reproductor de `/mi` y el
 * bloque de la web pública.
 *
 * LAS DOS PIDEN SOLO `modulos -> 'emisora'`
 * -----------------------------------------
 * No el jsonb entero, que lleva la configuración interna de cada herramienta
 * —los puestos de los turnos y la que venga detrás—. Con la puerta de la RLS
 * daría igual porque el miembro ya puede leerlo; con `dbAdmin` es la única
 * forma de que lo que sale a internet sea lo que se ha decidido sacar.
 *
 * Y en las dos, el `where` hace el filtro grueso —módulo encendido, con señal—
 * y `emisoraDeConfig()` el fino: vuelve a validar la dirección como https, de
 * modo que lo que llega a un `<audio>` ha pasado dos veces por el mismo
 * esquema.
 *
 * SI HAY DOS RADIOS, LA PRIMERA
 * -----------------------------
 * Por el orden de los ministerios. Una iglesia con dos emisoras es rara y un
 * reproductor con selector sería una pantalla para un caso que no ha pedido
 * nadie.
 */

export type RadioDeLaIglesia = {
  nombre: string;
  streamUrl: string;
  parrilla: Programa[];
};

const EMISORA = sql<unknown>`${ministerios.modulos} -> 'emisora'`;
const ENCENDIDA = sql`(${ministerios.modulos} -> 'emisora' ->> 'activo') = 'true'`;
const CON_SENAL = sql`coalesce(${ministerios.modulos} -> 'emisora' ->> 'stream_url', '') <> ''`;

/** La radio que escucha la congregación en `/mi`. Con su RLS. */
export async function radioDeLaIglesia(
  ctx: UserContext,
): Promise<RadioDeLaIglesia | null> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ nombre: ministerios.nombre, emisora: EMISORA })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
          ENCENDIDA,
          CON_SENAL,
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre)),
  );

  return primeraQueSuena(filas);
}

/**
 * La radio de la web pública, si el pastor ha marcado que salga.
 *
 * Por `dbAdmin` como todo lo de `/i/[slug]` —el porqué, en
 * `lib/iglesias/publica.ts`—, y llamada solo DESPUÉS de que
 * `obtenerIglesiaPublica()` haya comprobado que la web está publicada: el id
 * que recibe es el de una iglesia que ya decidió salir a internet.
 *
 * Lo que devuelve es lo que se pinta: nombre, señal y parrilla. Ni quién
 * presenta —la config no lo guarda— ni nada más del ministerio.
 */
export async function radioPublica(
  iglesiaId: string,
): Promise<RadioDeLaIglesia | null> {
  const filas = await dbAdmin
    .select({ nombre: ministerios.nombre, emisora: EMISORA })
    .from(ministerios)
    .where(
      and(
        eq(ministerios.iglesiaId, iglesiaId),
        eq(ministerios.activo, true),
        ENCENDIDA,
        CON_SENAL,
        sql`(${ministerios.modulos} -> 'emisora' ->> 'en_web') = 'true'`,
      ),
    )
    .orderBy(asc(ministerios.orden), asc(ministerios.nombre));

  return primeraQueSuena(filas, { soloEnWeb: true });
}

function primeraQueSuena(
  filas: { nombre: string; emisora: unknown }[],
  { soloEnWeb = false } = {},
): RadioDeLaIglesia | null {
  for (const fila of filas) {
    const e = emisoraDeConfig(fila.emisora);
    if (!e.streamUrl) continue;
    if (soloEnWeb && !e.enWeb) continue;
    return {
      nombre: e.nombre ?? fila.nombre,
      streamUrl: e.streamUrl,
      parrilla: e.parrilla,
    };
  }
  return null;
}
