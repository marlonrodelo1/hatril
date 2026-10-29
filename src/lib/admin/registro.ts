import 'server-only';

import { headers } from 'next/headers';
import { desc, eq, inArray } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { iglesias, registroAdmin, type AccionAdmin } from '@/lib/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * El registro de lo que hace el super admin. La tabla, y por qué solo se
 * añade, en `schema/plataforma.ts` y en la `0052`.
 */

/** Lo que acepta `dbAdmin` y una transacción suya, sin escribir el tipo a mano. */
type Escritor = Pick<typeof dbAdmin, 'insert'>;

/**
 * Apunta una acción. Se llama DENTRO de la misma transacción que el cambio:
 * si el apunte falla, el cambio no ocurre, y al revés. Un cambio hecho sin su
 * apunte es justo el hueco que este registro viene a cerrar.
 *
 * La IP sale de las cabeceras del proxy (Traefik, en Dokploy). En desarrollo
 * la pone el propio `next dev` y sale `::1`.
 */
export async function apuntar(
  tx: Escritor,
  datos: {
    actorAuthUserId: string;
    accion: AccionAdmin;
    iglesiaId?: string;
    cuentaAuthUserId?: string;
    detalle?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(registroAdmin).values({
    actorAuthUserId: datos.actorAuthUserId,
    accion: datos.accion,
    iglesiaId: datos.iglesiaId ?? null,
    cuentaAuthUserId: datos.cuentaAuthUserId ?? null,
    detalle: datos.detalle ?? {},
    ip: await ipDeLaPeticion(),
  });
}

async function ipDeLaPeticion(): Promise<string | null> {
  const h = await headers();
  const candidata =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim();
  // Solo si parece una IP: lo que no lo sea haría fallar el `inet`, y con él
  // la transacción entera y el cambio que se quería apuntar.
  return candidata && /^[0-9a-fA-F:.]+$/.test(candidata) ? candidata : null;
}

// ============================================================================
// Leer
// ============================================================================

export type Apunte = {
  id: string;
  accion: AccionAdmin;
  createdAt: Date;
  detalle: Record<string, unknown>;
  ip: string | null;
  actor: string;
  iglesia: { id: string; nombre: string } | null;
  cuenta: { id: string; email: string } | null;
};

/**
 * Los últimos apuntes, de todo o de una iglesia o una cuenta.
 *
 * Los correos se resuelven aquí, al pintar, y no se guardan: ver la cabecera
 * de la tabla. Una llamada a `auth` por persona distinta, no por fila; en una
 * página de doscientos apuntes suelen ser tres o cuatro.
 */
export async function leerRegistro(
  filtro: { iglesiaId?: string; cuentaAuthUserId?: string } = {},
  limite = 200,
): Promise<Apunte[]> {
  const donde = filtro.iglesiaId
    ? eq(registroAdmin.iglesiaId, filtro.iglesiaId)
    : filtro.cuentaAuthUserId
      ? eq(registroAdmin.cuentaAuthUserId, filtro.cuentaAuthUserId)
      : undefined;

  const filas = await dbAdmin
    .select()
    .from(registroAdmin)
    .where(donde)
    .orderBy(desc(registroAdmin.createdAt))
    .limit(limite);

  if (filas.length === 0) return [];

  const idsIglesia = [...new Set(filas.map((f) => f.iglesiaId).filter((x): x is string => !!x))];
  const idsPersona = [
    ...new Set(
      filas.flatMap((f) => [f.actorAuthUserId, f.cuentaAuthUserId]).filter((x): x is string => !!x),
    ),
  ];

  const supabase = createAdminClient();
  const [nombres, correos] = await Promise.all([
    idsIglesia.length
      ? dbAdmin
          .select({ id: iglesias.id, nombre: iglesias.nombre })
          .from(iglesias)
          .where(inArray(iglesias.id, idsIglesia))
      : Promise.resolve([]),
    Promise.all(
      idsPersona.map(async (id) => {
        const { data } = await supabase.auth.admin.getUserById(id);
        return [id, data.user?.email ?? 'una cuenta borrada'] as const;
      }),
    ),
  ]);

  const nombrePor = new Map(nombres.map((n) => [n.id, n.nombre]));
  const correoPor = new Map(correos);

  return filas.map((f) => ({
    id: f.id,
    accion: f.accion,
    createdAt: f.createdAt,
    detalle: f.detalle,
    ip: f.ip,
    actor: correoPor.get(f.actorAuthUserId) ?? 'una cuenta borrada',
    iglesia: f.iglesiaId
      ? { id: f.iglesiaId, nombre: nombrePor.get(f.iglesiaId) ?? 'Una iglesia borrada' }
      : null,
    cuenta: f.cuentaAuthUserId
      ? {
          id: f.cuentaAuthUserId,
          email: correoPor.get(f.cuentaAuthUserId) ?? 'una cuenta borrada',
        }
      : null,
  }));
}
