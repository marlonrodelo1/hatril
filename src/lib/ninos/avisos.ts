import 'server-only';

import { sql } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { cuentaDeMiembro, emitirNotificaciones } from '@/lib/notificaciones/emitir';

/**
 * Los avisos del ministerio de Niños, para la responsable y para las familias.
 *
 * Las búsquedas de a quién avisar van por `dbAdmin`, como `cuentaDeMiembro`
 * (`notificaciones/emitir.ts`): quien provoca el aviso —una madre que pide el
 * vínculo— no puede leer quién lleva el ministerio ni las cuentas de las
 * demás familias, y aun así hay que saber a quién mandarlo. Solo se leen ids
 * de cuentas; nada de eso vuelve a quien lo provoca.
 *
 * Los textos, sin el nombre de ningún niño en el título: sale en la pantalla
 * bloqueada del teléfono (`notificaciones/textos.ts`).
 */

type Fila = { auth_user_id: string };
const filas = (res: unknown): Fila[] => ((res as { rows?: Fila[] }).rows ?? (res as Fila[])) as Fila[];

/**
 * A quién se le avisa de lo del ministerio: la responsable con cuenta activa,
 * y si no la hay, los pastores. Alguien tiene que enterarse.
 */
export async function quienLlevaNinos(iglesiaId: string, ministerioId: string): Promise<string[]> {
  const responsables = filas(
    await dbAdmin.execute(sql`
      select iu.auth_user_id::text as auth_user_id
        from ministerio_miembros mm
        join iglesia_usuarios iu on iu.iglesia_id = mm.iglesia_id and iu.miembro_id = mm.miembro_id
       where mm.iglesia_id = ${iglesiaId}::uuid and mm.ministerio_id = ${ministerioId}::uuid
         and mm.activo and mm.rol_equipo = 'responsable' and iu.estado = 'activo'
    `),
  );
  if (responsables.length > 0) return responsables.map((r) => r.auth_user_id);

  return filas(
    await dbAdmin.execute(sql`
      select auth_user_id::text as auth_user_id from iglesia_usuarios
       where iglesia_id = ${iglesiaId}::uuid and rol = 'pastor' and estado = 'activo'
    `),
  ).map((r) => r.auth_user_id);
}

const enlaceFamilias = (ministerioId: string) => `/panel/ministerios/${ministerioId}/ninos/familias`;

/** Una familia pide ver lo de su hijo: a la responsable. */
export async function avisarSolicitud(a: {
  iglesiaId: string;
  ministerioId: string;
  ministerio: string;
  quien: string;
  provocadoPor: string;
}): Promise<void> {
  const destinatarios = await quienLlevaNinos(a.iglesiaId, a.ministerioId);
  await emitirNotificaciones(
    destinatarios.map((d) => ({
      iglesiaId: a.iglesiaId,
      destinatarioAuthUserId: d,
      tipo: 'ninos_solicitud' as const,
      datos: { quien: a.quien, ministerio: a.ministerio },
      enlace: enlaceFamilias(a.ministerioId),
      provocadoPor: a.provocadoPor,
    })),
  );
}

/** Te han aceptado: a la familia. Su ficha puede no tener cuenta: entonces, nada. */
export async function avisarAceptada(a: {
  iglesiaId: string;
  miembroId: string;
  ministerio: string;
  provocadoPor: string;
}): Promise<void> {
  const cuenta = await cuentaDeMiembro(a.iglesiaId, a.miembroId);
  if (!cuenta) return;
  await emitirNotificaciones([
    {
      iglesiaId: a.iglesiaId,
      destinatarioAuthUserId: cuenta,
      tipo: 'ninos_aceptada',
      datos: { ministerio: a.ministerio },
      enlace: '/mi/hijos',
      provocadoPor: a.provocadoPor,
    },
  ]);
}

/**
 * Hay publicación nueva: a las familias que la pueden ver, que son las
 * aceptadas ese día o antes (`familia_desde`, `0060`). Una vez por cuenta,
 * aunque tenga dos hijos en el ministerio.
 */
export async function avisarPublicacion(a: {
  iglesiaId: string;
  ministerioId: string;
  ministerio: string;
  fecha: string;
  provocadoPor: string;
}): Promise<void> {
  const familias = filas(
    await dbAdmin.execute(sql`
      select distinct iu.auth_user_id::text as auth_user_id
        from nino_familias nf
        join iglesia_usuarios iu on iu.iglesia_id = nf.iglesia_id and iu.miembro_id = nf.miembro_id
        join iglesias i on i.id = nf.iglesia_id
       where nf.iglesia_id = ${a.iglesiaId}::uuid and nf.ministerio_id = ${a.ministerioId}::uuid
         and iu.estado = 'activo'
         and (nf.aceptado_at at time zone i.timezone)::date <= ${a.fecha}::date
    `),
  );
  await emitirNotificaciones(
    familias.map((f) => ({
      iglesiaId: a.iglesiaId,
      destinatarioAuthUserId: f.auth_user_id,
      tipo: 'ninos_publicacion' as const,
      datos: { ministerio: a.ministerio, fecha: formatearFechaLarga(a.fecha) },
      enlace: '/mi/hijos/tablon',
      provocadoPor: a.provocadoPor,
    })),
  );
}

/** Una familia retira el permiso de fotos: a la responsable, para que quite las suyas. */
export async function avisarSinFotos(a: {
  iglesiaId: string;
  ministerioId: string;
  nino: string;
  provocadoPor: string;
}): Promise<void> {
  const destinatarios = await quienLlevaNinos(a.iglesiaId, a.ministerioId);
  await emitirNotificaciones(
    destinatarios.map((d) => ({
      iglesiaId: a.iglesiaId,
      destinatarioAuthUserId: d,
      tipo: 'ninos_sin_fotos' as const,
      datos: { nino: a.nino },
      enlace: enlaceFamilias(a.ministerioId),
      provocadoPor: a.provocadoPor,
    })),
  );
}
