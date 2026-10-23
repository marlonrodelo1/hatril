import 'server-only';

import { notFound } from 'next/navigation';

import { exigirModulo, requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { puedeGestionarDesdeDentro } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import {
  obtenerMinisterio,
  type MinisterioDetalle,
} from '@/lib/ministerios/consultas';
import { exigirUuid, requireAppAbierta } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { exigirPoderEscribir } from '@/lib/suscripcion/muro';
import { llevaElGrupo, obtenerGrupo, type GrupoDetalle } from './consultas';

/**
 * Las puertas de la pantalla de un grupo en la app: la de la célula de su líder.
 *
 * POR QUÉ NO ES `requireMinisterioEnLaApp`
 * ----------------------------------------
 * Aquella es de quien lleva el ministerio ENTERO. El líder de una célula casi
 * nunca lo lleva: es un voluntario del equipo de la red, con rol `miembro`, y
 * lo suyo es su célula y nada más. Así que aquí hay dos formas de entrar:
 *
 *   - `red`: el pastor, o quien lidera la red desde dentro
 *     (`puedeGestionarDesdeDentro`, la misma del panel y del adaptador). Ve
 *     cualquier célula de la red.
 *   - `lider`: lleva ESTA célula —líder o auxiliar— y sigue en el equipo. Es
 *     `llevaElGrupo`, lo mismo que `lleva_grupo()` en la base.
 *
 * El resto, 404: un participante, el líder de la célula de al lado, un id
 * inventado o un grupo cerrado dan lo mismo, por lo que cuenta `guarda.ts` de
 * la zona de equipos.
 *
 * En cada página, no en un layout (CLAUDE.md), y antes de leer nada del grupo.
 */
export type ModoEnElGrupo = 'red' | 'lider';

export async function requireGrupoEnLaApp(
  ministerioId: string,
  grupoId: string,
): Promise<{
  ctx: UserContext;
  ministerio: MinisterioDetalle;
  grupo: GrupoDetalle;
  modo: ModoEnElGrupo;
}> {
  const ctx = await requireAppAbierta();
  exigirUuid(ministerioId, grupoId);

  // Acotado a la iglesia del contexto: el de otra congregación sale null.
  const ministerio = await obtenerMinisterio(ctx, ministerioId);
  if (!ministerio || !tieneModulo(ministerio.modulos, 'grupos')) notFound();

  const red = puedeGestionarDesdeDentro(ctx, ministerioId);
  if (!red && !(await llevaElGrupo(ctx, ministerioId, grupoId))) notFound();

  const grupo = await obtenerGrupo(ctx, ministerioId, grupoId);
  if (!grupo) notFound();

  return { ctx, ministerio, grupo, modo: red ? 'red' : 'lider' };
}

/**
 * La misma puerta para las actions de esa pantalla.
 *
 * El muro de suscripción con el destino de aquí (en `solo_lectura` el aviso
 * sale donde se pulsó), la herramienta encendida, y llevar la célula o la red.
 * La base lo repite por debajo: `grupo_semanas` solo admite escrituras de quien
 * lleva el grupo o la red (`0047`).
 */
export async function requireGrupoAccion(
  ministerioId: string,
  grupoId: string,
  volver: string,
): Promise<UserContext> {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  exigirPoderEscribir(ctx, volver);
  exigirUuid(ministerioId, grupoId);
  await exigirModulo(ctx, ministerioId, 'grupos', rutaApp(ministerioId));

  if (
    !puedeGestionarDesdeDentro(ctx, ministerioId) &&
    !(await llevaElGrupo(ctx, ministerioId, grupoId))
  ) {
    notFound();
  }
  return ctx;
}
