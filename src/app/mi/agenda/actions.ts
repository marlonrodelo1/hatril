'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { ministerios, miembros, turnoAsignaciones, turnos } from '@/lib/db/schema';
import { campoObligatorio } from '@/lib/api/formulario';
import { exigirPoderEscribir } from '@/lib/suscripcion/muro';
import { cuandoEs } from '@/lib/turnos/fecha';
import {
  cuentasQueLlevanElMinisterio,
  emitirNotificaciones,
} from '@/lib/notificaciones/emitir';

/**
 * La persona contesta a su turno: «ahí estaré» o «no puedo».
 *
 * SOLO LO SUYO, Y LO DICE EL `where`
 * ----------------------------------
 * La action actualiza las filas de ese turno cuyo `miembro_id` es la ficha de la
 * sesión, y nada más. No hay un id de asignación que viaje en el formulario y
 * que alguien pudiera cambiar por el de otro: lo que se contesta se deduce de
 * quién es, no de lo que manda el navegador.
 *
 * Contesta todos sus puestos de ese turno a la vez. Quien canta y toca la
 * guitarra el domingo no va a poder ir a uno y no al otro.
 *
 * EL «NO PUEDO» AVISA A QUIEN LLEVA EL EQUIPO
 * -------------------------------------------
 * Es la mitad útil de todo el módulo: el responsable se entera el miércoles y no
 * el domingo a las diez. El «confirmo» no avisa a nadie, porque es lo que se
 * espera, y una campana que suena por cada confirmación deja de mirarse.
 */

const EsquemaRespuesta = z.enum(['confirmado', 'no_puede'], {
  error: 'Elige si puedes o no.',
});

/** Solo dos destinos posibles: el formulario no decide a dónde se vuelve. */
function destinoDe(turnoId: string, desde: string): string {
  return desde === 'agenda' ? '/mi/agenda' : `/mi/agenda/turno/${turnoId}`;
}

export async function responderTurno(turnoId: string, formData: FormData) {
  const destino = destinoDe(turnoId, campoObligatorio(formData, 'desde'));

  // El muro, con el destino de aquí: el de por defecto llevaría al panel, y un
  // miembro raso rebotaría de vuelta sin ver el mensaje.
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  exigirPoderEscribir(ctx, destino);

  function volver(mensaje: string): never {
    redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
  }

  const miembroId = ctx.miembroId;
  if (!miembroId) {
    volver('Todavía no tienes ficha en la iglesia, así que no tienes turnos.');
  }

  const leido = EsquemaRespuesta.safeParse(campoObligatorio(formData, 'respuesta'));
  if (!leido.success) volver(leido.error.issues[0]!.message);
  const respuesta = leido.data;

  const resultado = await withUser(ctx.user.id, async (tx) => {
    const [turno] = await tx
      .select({
        fecha: turnos.fecha,
        hora: turnos.hora,
        ministerioId: turnos.ministerioId,
        ministerioNombre: ministerios.nombre,
      })
      .from(turnos)
      .innerJoin(ministerios, eq(ministerios.id, turnos.ministerioId))
      .where(and(eq(turnos.id, turnoId), eq(turnos.iglesiaId, ctx.iglesia.id)))
      .limit(1);

    if (!turno) return null;

    // Lo que tenía antes, para no avisar dos veces de un «no puedo» que ya
    // estaba dicho.
    const antes = await tx
      .select({ respuesta: turnoAsignaciones.respuesta })
      .from(turnoAsignaciones)
      .where(
        and(
          eq(turnoAsignaciones.turnoId, turnoId),
          eq(turnoAsignaciones.miembroId, miembroId),
        ),
      );

    const cambiadas = await tx
      .update(turnoAsignaciones)
      .set({ respuesta, respondidoAt: new Date() })
      .where(
        and(
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(turnoAsignaciones.turnoId, turnoId),
          eq(turnoAsignaciones.miembroId, miembroId),
        ),
      )
      .returning({ id: turnoAsignaciones.id });

    const [yo] = await tx
      .select({ nombre: miembros.nombre, apellidos: miembros.apellidos })
      .from(miembros)
      .where(eq(miembros.id, miembroId))
      .limit(1);

    return {
      turno,
      cambiadas: cambiadas.length,
      yaNoPodia: antes.length > 0 && antes.every((a) => a.respuesta === 'no_puede'),
      nombre: [yo?.nombre, yo?.apellidos].filter(Boolean).join(' ') || 'Alguien',
    };
  });

  // Cero filas: el turno no existe, es de otra iglesia, o ya no le tienen
  // puesto en él. Las tres se cuentan igual, sin confirmar cuál es.
  if (!resultado || resultado.cambiadas === 0) {
    volver('Ese turno ya no es tuyo. Puede que el responsable lo haya cambiado.');
  }
  const r = resultado;

  if (respuesta === 'no_puede' && !r.yaNoPodia) {
    const cuentas = await cuentasQueLlevanElMinisterio(
      ctx.iglesia.id,
      r.turno.ministerioId,
    );

    await emitirNotificaciones(
      cuentas.map((cuenta) => ({
        iglesiaId: ctx.iglesia.id,
        destinatarioAuthUserId: cuenta,
        tipo: 'turno_no_puede' as const,
        datos: {
          quien: r.nombre,
          ministerio: r.turno.ministerioNombre,
          fecha: cuandoEs(r.turno.fecha, r.turno.hora ? r.turno.hora.slice(0, 5) : null),
        },
        enlace: `/panel/ministerios/${r.turno.ministerioId}/turnos/${turnoId}`,
        // Si quien no puede es el propio responsable, no se avisa a sí mismo.
        provocadoPor: ctx.user.id,
      })),
    );
  }

  revalidatePath('/mi/agenda');
  revalidatePath(`/mi/agenda/turno/${turnoId}`);
  redirect(`${destino}?guardado=${respuesta}`);
}
