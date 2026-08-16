'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import {
  consentimientos,
  iglesiaUsuarios,
  miembros,
  solicitudesIngreso,
} from '@/lib/db/schema';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { campo } from '@/lib/api/formulario';

/**
 * Aprobar o rechazar quien pide entrar en la iglesia.
 *
 * Es la puerta de la congregación: quien apruebe aquí pasa a ver el contenido
 * interno. Por eso va con el permiso `aprobar_solicitudes`, que el pastor
 * reparte a conciencia, y no con el genérico de pertenecer a la iglesia.
 */

const EsquemaId = z.string().uuid();

export async function aprobarSolicitud(solicitudId: string) {
  const ctx = await requirePermisoAccion(
    'aprobar_solicitudes',
    '/panel/solicitudes',
  );

  if (!EsquemaId.safeParse(solicitudId).success) {
    redirect('/panel/solicitudes');
  }

  await withUser(ctx.user.id, async (tx) => {
    const [solicitud] = await tx
      .select({
        id: solicitudesIngreso.id,
        authUserId: solicitudesIngreso.authUserId,
        nombre: solicitudesIngreso.nombre,
        email: solicitudesIngreso.email,
        telefono: solicitudesIngreso.telefono,
      })
      .from(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.id, solicitudId),
          eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      )
      .limit(1);

    // Ya la resolvió otra persona del equipo entre que se cargó la pantalla y
    // se pulsó el botón. No es un error: simplemente no hay nada que hacer.
    if (!solicitud) return;

    // La ficha se crea al aprobar, no al solicitar. Mientras la solicitud está
    // pendiente, esa persona NO forma parte del fichero de la congregación: si
    // se creara antes, una solicitud rechazada dejaría una ficha huérfana con
    // los datos de alguien que nunca entró.
    const [ficha] = await tx
      .insert(miembros)
      .values({
        iglesiaId: ctx.iglesia.id,
        authUserId: solicitud.authUserId,
        nombre: solicitud.nombre,
        email: solicitud.email,
        telefono: solicitud.telefono,
        estado: 'nuevo',
        fechaIngreso: new Date().toISOString().slice(0, 10),
      })
      .returning({ id: miembros.id });

    // El consentimiento del art. 9 lo dio la persona al enviar la solicitud.
    // Se registra ahora porque hasta este momento no existía la ficha a la que
    // asociarlo, y la fecha que importa —cuándo consintió— viaja en la
    // solicitud, no en esta aprobación.
    await tx.insert(consentimientos).values({
      iglesiaId: ctx.iglesia.id,
      miembroId: ficha!.id,
      tipo: 'datos_religiosos',
      versionTexto: VERSION_POLITICA_PRIVACIDAD,
    });

    await tx
      .update(iglesiaUsuarios)
      .set({
        estado: 'activo',
        miembroId: ficha!.id,
        aprobadoPor: ctx.user.id,
        aprobadoAt: new Date(),
      })
      .where(
        and(
          eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          eq(iglesiaUsuarios.authUserId, solicitud.authUserId),
        ),
      );

    await tx
      .update(solicitudesIngreso)
      .set({
        estado: 'aprobada',
        revisadoPor: ctx.user.id,
        revisadoAt: new Date(),
      })
      .where(eq(solicitudesIngreso.id, solicitud.id));
  });

  revalidatePath('/panel/solicitudes');
  revalidatePath('/panel/miembros');
  redirect('/panel/solicitudes');
}

const EsquemaRechazo = z.object({
  solicitudId: z.string().uuid(),
  motivo: z.string().trim().max(300).optional().or(z.literal('')),
});

export async function rechazarSolicitud(
  solicitudId: string,
  formData: FormData,
) {
  const ctx = await requirePermisoAccion(
    'aprobar_solicitudes',
    '/panel/solicitudes',
  );

  const parsed = EsquemaRechazo.safeParse({
    solicitudId,
    motivo: campo(formData, 'motivo'),
  });

  if (!parsed.success) redirect('/panel/solicitudes');

  await withUser(ctx.user.id, async (tx) => {
    const [solicitud] = await tx
      .select({ authUserId: solicitudesIngreso.authUserId })
      .from(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.id, solicitudId),
          eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      )
      .limit(1);

    if (!solicitud) return;

    await tx
      .update(solicitudesIngreso)
      .set({
        estado: 'rechazada',
        motivoRechazo: parsed.data.motivo || null,
        revisadoPor: ctx.user.id,
        revisadoAt: new Date(),
      })
      .where(eq(solicitudesIngreso.id, solicitudId));

    /*
     * La membresía se BORRA, no se marca como rechazada.
     *
     * El enum tiene un valor 'rechazado' y aun así se borra la fila, porque el
     * unique `(iglesia_id, auth_user_id)` impediría volver a solicitar para
     * siempre. Y eso no vale: un rechazo suele ser «no te conocemos todavía» o
     * un malentendido, no una expulsión.
     *
     * El rastro no se pierde: la solicitud rechazada se queda con su motivo y
     * su fecha, que es donde un pastor lo va a buscar.
     */
    await tx
      .delete(iglesiaUsuarios)
      .where(
        and(
          eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          eq(iglesiaUsuarios.authUserId, solicitud.authUserId),
          eq(iglesiaUsuarios.estado, 'pendiente'),
        ),
      );
  });

  revalidatePath('/panel/solicitudes');
  redirect('/panel/solicitudes');
}
