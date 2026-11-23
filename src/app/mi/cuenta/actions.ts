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
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { casilla } from '@/lib/api/formulario';
import { quitarMiFoto, subirMiFoto } from '@/lib/miembros/foto';

/**
 * Lo que cada cual cambia de sí mismo en Mi cuenta.
 *
 * Todas con `sinMuro`: es la cuenta propia —la foto, un permiso que se da o se
 * retira—, de lo que la lista corta de `sinMuro` dice que nunca se bloquea por
 * un recibo devuelto de la iglesia.
 */

const DESTINO = '/mi/cuenta';

function volver(params: string): never {
  redirect(`${DESTINO}?${params}`);
}

export async function subirFoto(formData: FormData) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });

  const fichero = formData.get('foto');
  if (!(fichero instanceof File)) volver('error=' + encodeURIComponent('Elige una foto.'));

  const r = await subirMiFoto(ctx, fichero);
  if (!r.ok) volver('error=' + encodeURIComponent(r.error));

  // La cara sale en la cabecera de todas las pantallas y en el muro.
  revalidatePath('/', 'layout');
  volver('guardado=foto');
}

export async function quitarFoto() {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  await quitarMiFoto(ctx);
  revalidatePath('/', 'layout');
  volver('guardado=sin-foto');
}

/**
 * Dar o retirar el permiso de asistencia, cuando se quiera.
 *
 * El texto de la casilla lo promete («puedo retirar este permiso cuando
 * quiera») y hasta hoy no había dónde: `/acepta` solo sale cuando cambia la
 * versión de la política. Hace exactamente lo mismo que esa pantalla con la
 * casilla de asistencia —revocar la fila viva y escribir otra si dice que sí;
 * borrar lo apuntado si dice que no— y por los mismos motivos, que están
 * contados allí (`app/acepta/actions.ts`). Si una cambia, la otra también.
 */
export async function cambiarPermisoAsistencia(formData: FormData) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  if (!ctx.miembroId) {
    volver('error=' + encodeURIComponent('Todavía no tienes ficha en la iglesia.'));
  }
  const miembroId = ctx.miembroId;
  const quiere = casilla(formData, 'asistencia');

  await withUser(ctx.user.id, async (tx) => {
    await tx
      .update(consentimientos)
      .set({ revocadoAt: new Date() })
      .where(
        and(
          eq(consentimientos.iglesiaId, ctx.iglesia.id),
          eq(consentimientos.miembroId, miembroId),
          eq(consentimientos.tipo, 'asistencia_y_seguimiento'),
          isNull(consentimientos.revocadoAt),
        ),
      );

    if (quiere) {
      await tx.insert(consentimientos).values({
        iglesiaId: ctx.iglesia.id,
        miembroId,
        tipo: 'asistencia_y_seguimiento',
        versionTexto: VERSION_POLITICA_PRIVACIDAD,
      });
      return;
    }

    // Retirarlo obliga a dejar de tratar lo apuntado, no solo a no apuntar más
    // (art. 7.3): se borra, como en `/acepta`.
    await tx
      .delete(asistencias)
      .where(and(eq(asistencias.iglesiaId, ctx.iglesia.id), eq(asistencias.miembroId, miembroId)));
    await tx
      .delete(seguimientoContactos)
      .where(
        and(
          eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
          eq(seguimientoContactos.miembroId, miembroId),
        ),
      );
    await tx
      .delete(seguimientoAsignaciones)
      .where(
        and(
          eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(seguimientoAsignaciones.miembroId, miembroId),
        ),
      );
  });

  revalidatePath('/', 'layout');
  volver(quiere ? 'guardado=asistencia-si' : 'guardado=asistencia-no');
}
