import 'server-only';

import { and, count, eq, gte, isNull } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { miembros, solicitudesIngreso } from '@/lib/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FiltroSituacion } from '@/lib/admin/consultas';
import {
  listarIglesiasDetalle,
  type FilaIglesiaDetalle,
} from '@/lib/admin/iglesias-detalle';

/**
 * Lo que pinta Inicio del super admin, con lo que ha cambiado en 30 días.
 *
 * NADA INVENTADO
 * --------------
 * El diseño aprobado pide, junto a cada cifra, una pastilla con lo que ha
 * cambiado en los últimos 30 días, pero solo donde se pueda CALCULAR. Lo que
 * se cuenta son altas, porque es lo único que deja fecha de verdad:
 *
 *   - Iglesias: `iglesias.created_at`.
 *   - Personas: `miembros.created_at` de las fichas que siguen sin archivar,
 *     las mismas que suma la cifra. No es la variación neta: una ficha
 *     archivada y devuelta no deja rastro de cuándo volvió, y una borrada no
 *     deja ninguno. Por eso la pastilla dice «+N», de las que hay hoy cuántas
 *     son nuevas, y no «sube N».
 *   - Cuentas: `created_at` de `auth.users`. La API de Supabase lo da por
 *     páginas; con una de mil se cuenta entera mientras haya menos de mil. Si
 *     hay más, `null`: sin pastilla antes que una cifra a medias.
 *
 * Las solicitudes no llevan pastilla: lo que cuenta la cifra es cuántas siguen
 * sin contestar, y de eso no hay historia que comparar.
 */
export type ResumenInicio = {
  iglesias: FilaIglesiaDetalle[];
  porGrupo: Record<FiltroSituacion, number>;
  personas: number;
  /** `null` si no se ha podido leer `auth.users`. */
  cuentas: number | null;
  solicitudesPendientes: number;
  altas30: {
    iglesias: number;
    personas: number;
    /** `null` cuando no se han podido leer todas las cuentas. */
    cuentas: number | null;
  };
};

const MS_POR_DIA = 86_400_000;

/** El mismo tope que el listado de Cuentas (`consultas.ts`, `MAX_CUENTAS`). */
const MAX_CUENTAS = 1000;

export async function resumenInicio(
  ahora: Date = new Date(),
): Promise<ResumenInicio> {
  const hace30 = new Date(ahora.getTime() - 30 * MS_POR_DIA);
  const supabase = createAdminClient();

  const [lista, [solicitudes], [fichasNuevas], usuarios] = await Promise.all([
    listarIglesiasDetalle(ahora),
    dbAdmin
      .select({ n: count() })
      .from(solicitudesIngreso)
      .where(eq(solicitudesIngreso.estado, 'pendiente')),
    dbAdmin
      .select({ n: count() })
      .from(miembros)
      .where(and(isNull(miembros.archivadoAt), gte(miembros.createdAt, hace30))),
    supabase.auth.admin.listUsers({ page: 1, perPage: MAX_CUENTAS }),
  ]);

  const porGrupo: Record<FiltroSituacion, number> = {
    prueba: 0,
    pagan: 0,
    vencidas: 0,
    suspendidas: 0,
  };
  for (const i of lista) porGrupo[i.situacion.grupo] += 1;

  // `total` viene en la respuesta aunque el tipo lo marque opcional según la
  // versión del cliente. Si la llamada falla, la cifra sale como «no se ha
  // podido leer», no como un cero que parecería real.
  let cuentas: number | null = null;
  let cuentasNuevas: number | null = null;
  if (!usuarios.error) {
    const datos = usuarios.data;
    const leidas = datos.users.length;
    const total =
      'total' in datos && typeof datos.total === 'number' ? datos.total : leidas;
    cuentas = total;
    if (total <= leidas) {
      cuentasNuevas = datos.users.filter(
        (u) => new Date(u.created_at).getTime() >= hace30.getTime(),
      ).length;
    }
  }

  return {
    iglesias: lista,
    porGrupo,
    personas: lista.reduce((s, i) => s + i.personas, 0),
    cuentas,
    solicitudesPendientes: solicitudes?.n ?? 0,
    altas30: {
      iglesias: lista.filter((i) => i.createdAt.getTime() >= hace30.getTime())
        .length,
      personas: fichasNuevas?.n ?? 0,
      cuentas: cuentasNuevas,
    },
  };
}
