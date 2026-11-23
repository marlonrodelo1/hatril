import 'server-only';

import { and, eq } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import {
  grupos,
  iglesias,
  ministerios,
  solicitudesIngreso,
  solicitudInvitaciones,
} from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { leerCodigo } from './codigo';

/**
 * El grupo de un enlace de invitación, para `/solicitar`.
 *
 * POR `dbAdmin`, COMO TODO `/solicitar`
 * -------------------------------------
 * Quien abre el enlace no pertenece a la iglesia —ni tiene cuenta, a veces—, y
 * la RLS de `grupos` (`0047`) no le enseña nada. Es la misma excepción que el
 * resto de ese formulario (`solicitar/actions.ts`), y por eso esto devuelve lo
 * mínimo: el id y el código, para guardarlos con la solicitud, y el nombre,
 * para que sepa a dónde le invitan. Ni quién la lleva, ni la zona, ni el día:
 * eso lo ve cuando se le apruebe, ya dentro.
 *
 * Solo grupos abiertos de redes activas con la herramienta encendida, y de ESTA
 * iglesia: un código de otra congregación en la URL de esta no encuentra nada,
 * y con `grupos` apagado la invitación no lleva a ningún sitio. HT132 lo
 * repite al guardar la invitación (`0049`).
 */
export async function grupoDeLaInvitacion(
  iglesiaId: string,
  codigo: string | null | undefined,
): Promise<{ id: string; ministerioId: string; nombre: string; codigo: string } | null> {
  const leido = leerCodigo(codigo);
  if (!leido) return null;

  const [fila] = await dbAdmin
    .select({ id: grupos.id, ministerioId: grupos.ministerioId, nombre: grupos.nombre, modulos: ministerios.modulos })
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

  if (!fila || !tieneModulo(fila.modulos, 'grupos')) return null;
  return { id: fila.id, ministerioId: fila.ministerioId, nombre: fila.nombre, codigo: leido };
}

/**
 * La solicitud pendiente de esta cuenta en esta iglesia, y si ya trae una
 * invitación. Para `/solicitar`, que con ella deja sumar la de un enlace a
 * quien ya había pedido entrar sin él. Por `dbAdmin` por lo mismo de arriba:
 * mientras espera, la cuenta no ve nada de la iglesia.
 */
export async function solicitudPendienteEn(
  authUserId: string,
  iglesiaId: string,
): Promise<{ id: string; conInvitacion: boolean } | null> {
  const [fila] = await dbAdmin
    .select({ id: solicitudesIngreso.id, invitacion: solicitudInvitaciones.solicitudId })
    .from(solicitudesIngreso)
    .leftJoin(
      solicitudInvitaciones,
      eq(solicitudInvitaciones.solicitudId, solicitudesIngreso.id),
    )
    .where(
      and(
        eq(solicitudesIngreso.authUserId, authUserId),
        eq(solicitudesIngreso.iglesiaId, iglesiaId),
        eq(solicitudesIngreso.estado, 'pendiente'),
      ),
    )
    .limit(1);

  return fila ? { id: fila.id, conInvitacion: fila.invitacion !== null } : null;
}

/**
 * Quien ya había pedido entrar sin enlace abre el de una célula: que su
 * solicitud pendiente lleve también esa invitación.
 *
 * Sin esto, el enlace no le hacía nada —`/solicitar` le mandaba a `/mi`— y la
 * célula que le invitó se perdía sin que nadie lo supiera. Solo para una
 * solicitud PENDIENTE de ESTA iglesia y de ESTA cuenta, sin invitación ya, y
 * con un código que valga hoy: lo vuelve a resolver todo aquí, no se fía del
 * formulario. Por `dbAdmin`, como el resto de `/solicitar`: mientras espera,
 * la cuenta no ve nada de la iglesia.
 *
 * `nada` cuando no hay a qué sumarla; quien llama manda a `/mi`, que dice
 * cómo quedó.
 */
export async function sumarInvitacion(
  authUserId: string,
  slug: string,
  codigo: string,
): Promise<'sumada' | 'nada'> {
  const [iglesia] = await dbAdmin
    .select({ id: iglesias.id })
    .from(iglesias)
    .where(and(eq(iglesias.slug, slug), eq(iglesias.activa, true)))
    .limit(1);
  if (!iglesia) return 'nada';

  const [grupo, solicitud] = await Promise.all([
    grupoDeLaInvitacion(iglesia.id, codigo),
    solicitudPendienteEn(authUserId, iglesia.id),
  ]);
  if (!grupo || !solicitud || solicitud.conInvitacion) return 'nada';

  // Dos pestañas a la vez: la segunda choca con la clave primaria y no pasa
  // nada, la invitación ya está.
  try {
    await dbAdmin
      .insert(solicitudInvitaciones)
      .values({
        solicitudId: solicitud.id,
        iglesiaId: iglesia.id,
        grupoId: grupo.id,
        codigo: grupo.codigo,
      })
      .onConflictDoNothing();
  } catch (err) {
    // Se aprobó o se rechazó entre la lectura de arriba y aquí: la base ya no
    // la deja colgar de una solicitud resuelta (HT132, `0050`).
    if (esGuardHatril(err, 'HT132')) return 'nada';
    throw err;
  }
  return 'sumada';
}
