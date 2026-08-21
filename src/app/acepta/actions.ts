'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import {
  asistencias,
  consentimientos,
  seguimientoAsignaciones,
  seguimientoContactos,
} from '@/lib/db/schema';
import { inicioDe } from '@/lib/auth/permisos';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { casilla } from '@/lib/api/formulario';

/**
 * Volver a aceptar la política cuando ha cambiado de fondo.
 *
 * POR QUÉ ESTO EXISTE Y NO ES UN LUJO
 * -----------------------------------
 * `consentimientos.version_texto` guarda a qué redacción dijo que sí cada
 * persona. Cambiar el texto sin subir la versión hace que esa columna mienta;
 * subir la versión sin una pantalla como esta deja a toda la congregación en
 * estado caducado sin forma de salir. Las dos cosas van juntas o ninguna sirve,
 * y por eso la deuda de `consentimiento.ts` estuvo abierta meses.
 *
 * REVOCAR Y VOLVER A INSERTAR, NO ACTUALIZAR LA FILA
 * ---------------------------------------------------
 * Un `update ... set version_texto` borraría la prueba de que aceptó la versión
 * anterior, que es exactamente lo que el art. 7.1 obliga a poder demostrar. Se
 * marca la vieja como revocada y se escribe una nueva: el histórico queda, y el
 * índice único parcial —un consentimiento vivo por tipo y persona— sigue
 * cumpliéndose.
 */
export async function aceptar(formData: FormData) {
  // SIN MURO, y es lo importante de esta línea: aceptar o rechazar la
  // política es un acto legal, no una función del producto. Bloquearlo por un
  // recibo devuelto dejaría a la persona encerrada en `/acepta`, que es la
  // única pantalla que el corte del consentimiento le deja abierta.
  const ctx = await requireIglesiaAccion({ sinMuro: true });

  // Sin ficha no hay a qué colgar el consentimiento y esta pantalla no debería
  // haberse pintado. Se sale al panel en vez de fallar: no es culpa de nadie.
  if (!ctx.miembroId) redirect('/panel/hoy');

  const quiereAsistencia = casilla(formData, 'asistencia');

  await withUser(ctx.user.id, async (tx) => {
    const ahora = new Date();

    await tx
      .update(consentimientos)
      .set({ revocadoAt: ahora })
      .where(
        and(
          eq(consentimientos.iglesiaId, ctx.iglesia.id),
          eq(consentimientos.miembroId, ctx.miembroId!),
          eq(consentimientos.tipo, 'datos_religiosos'),
          isNull(consentimientos.revocadoAt),
        ),
      );

    await tx.insert(consentimientos).values({
      iglesiaId: ctx.iglesia.id,
      miembroId: ctx.miembroId!,
      tipo: 'datos_religiosos',
      versionTexto: VERSION_POLITICA_PRIVACIDAD,
    });

    // La casilla de asistencia es aparte y opcional, así que aquí se resuelven
    // los dos sentidos: marcarla concede, desmarcarla RETIRA. Sin la segunda
    // mitad, quitar la marca no haría nada y la casilla sería un adorno.
    await tx
      .update(consentimientos)
      .set({ revocadoAt: ahora })
      .where(
        and(
          eq(consentimientos.iglesiaId, ctx.iglesia.id),
          eq(consentimientos.miembroId, ctx.miembroId!),
          eq(consentimientos.tipo, 'asistencia_y_seguimiento'),
          isNull(consentimientos.revocadoAt),
        ),
      );

    if (quiereAsistencia) {
      await tx.insert(consentimientos).values({
        iglesiaId: ctx.iglesia.id,
        miembroId: ctx.miembroId!,
        tipo: 'asistencia_y_seguimiento',
        versionTexto: VERSION_POLITICA_PRIVACIDAD,
      });
      return;
    }

    // NO LO QUIERE: SE BORRA LO QUE YA HUBIERA, NO SOLO SE DEJA DE AÑADIR
    // -------------------------------------------------------------------
    // Filtrar las pantallas y conservar las filas parecía suficiente y no lo
    // es, por dos motivos. El legal: retirar el consentimiento no borra lo que
    // fue lícito ayer (art. 7.3), pero sí obliga a dejar de tratarlo, y seguir
    // enseñándolo en un recuento es tratarlo. El práctico, que es el que se ve:
    // dejaba la pantalla del culto diciendo «7 de 9» con ocho personas en la
    // lista, y un número que no cuadra con lo que hay debajo es un número del
    // que el pastor deja de fiarse.
    //
    // El trigger de `asistencias` recalcula `miembros.ultima_asistencia` al
    // borrar, así que la ficha queda coherente sola.
    await tx
      .delete(asistencias)
      .where(
        and(
          eq(asistencias.iglesiaId, ctx.iglesia.id),
          eq(asistencias.miembroId, ctx.miembroId!),
        ),
      );

    await tx
      .delete(seguimientoContactos)
      .where(
        and(
          eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
          eq(seguimientoContactos.miembroId, ctx.miembroId!),
        ),
      );

    await tx
      .delete(seguimientoAsignaciones)
      .where(
        and(
          eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(seguimientoAsignaciones.miembroId, ctx.miembroId!),
        ),
      );
  });

  // `'/', 'layout'` y no una ruta suelta: sin refrescar el layout, quien acaba
  // de aceptar volvería a caer en esta pantalla —el guard lee este estado en
  // cada carga—, y además esto puede haber borrado filas que salen en Reuniones,
  // en Seguimiento y en la ficha de la persona.
  revalidatePath('/', 'layout');
  redirect(inicioDe(ctx));
}
