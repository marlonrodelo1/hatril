import 'server-only';

import { and, eq } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { grupos, ministerios } from '@/lib/db/schema';
import { leerCodigo } from './codigo';

/**
 * El grupo de un enlace de invitación, para `/solicitar`.
 *
 * POR `dbAdmin`, COMO TODO `/solicitar`
 * -------------------------------------
 * Quien abre el enlace no pertenece a la iglesia —ni tiene cuenta, a veces—, y
 * la RLS de `grupos` (`0047`) no le enseña nada. Es la misma excepción que el
 * resto de ese formulario (`solicitar/actions.ts`), y por eso esto devuelve lo
 * mínimo: el id, para guardarlo con la solicitud, y el nombre, para que sepa a
 * dónde le invitan. Ni quién la lleva, ni la zona, ni el día: eso lo ve cuando
 * se le apruebe, ya dentro.
 *
 * Solo grupos abiertos de ministerios activos, y de ESTA iglesia: un código de
 * otra congregación en la URL de esta no encuentra nada. HT132 lo repite al
 * guardar la solicitud.
 */
export async function grupoDeLaInvitacion(
  iglesiaId: string,
  codigo: string | null | undefined,
): Promise<{ id: string; nombre: string } | null> {
  const leido = leerCodigo(codigo);
  if (!leido) return null;

  const [fila] = await dbAdmin
    .select({ id: grupos.id, nombre: grupos.nombre })
    .from(grupos)
    .innerJoin(ministerios, eq(ministerios.id, grupos.ministerioId))
    .where(
      and(
        eq(grupos.iglesiaId, iglesiaId),
        eq(grupos.codigo, leido),
        eq(grupos.activo, true),
        eq(ministerios.activo, true),
      ),
    )
    .limit(1);

  return fila ?? null;
}
