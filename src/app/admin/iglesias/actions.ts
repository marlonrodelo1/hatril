'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { campo, casilla } from '@/lib/api/formulario';
import { apuntar } from '@/lib/admin/registro';
import { dbAdmin } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { fechaLocalATimestamp, timestampAFechaHoraLocal } from '@/lib/fecha/zona';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que el super admin puede tocar de una iglesia. Tres palancas, y ninguna
 * de sus datos: lo que la congregación escribe lo cambia ella desde su panel.
 *
 * `dbAdmin` en las tres. El trigger `guard_facturacion_iglesia` (`0021`) deja
 * pasar `trial_until` porque `dbAdmin` no lleva claims: es exactamente lo que
 * `_escritor_confiable()` reconoce como sistema. Con `withUser` daría HT112.
 *
 * Cada cambio va en una transacción con su apunte en `registro_admin`: o
 * quedan los dos o ninguno.
 */

const Id = z.uuid('Iglesia no válida.');

function volver(id: string, clave: 'error' | 'ok', valor: string): never {
  redirect(
    `/admin/iglesias/${id}?${clave}=${encodeURIComponent(valor)}`,
  );
}

/** Lo que devuelve el id validado, o manda al listado si no lo es. */
function idDe(formData: FormData): string {
  const r = Id.safeParse(campo(formData, 'id'));
  if (!r.success) {
    redirect('/admin/iglesias?error=' + encodeURIComponent('Iglesia no válida.'));
  }
  return r.data;
}

async function leer(id: string) {
  const [fila] = await dbAdmin
    .select({
      plan: iglesias.plan,
      timezone: iglesias.timezone,
      activa: iglesias.activa,
      trialUntil: iglesias.trialUntil,
      visibleEnDirectorio: iglesias.visibleEnDirectorio,
    })
    .from(iglesias)
    .where(eq(iglesias.id, id))
    .limit(1);
  if (!fila) {
    redirect('/admin/iglesias?error=' + encodeURIComponent('Esa iglesia no existe.'));
  }
  return fila;
}

// ============================================================================
// Ampliar la prueba
// ============================================================================

const EsquemaAmpliar = z.object({
  hasta: z
    .string({ error: 'Elige hasta qué día.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida.'),
});

/**
 * Pone la fecha de fin de la prueba. Es lo que hace la alta asistida a mano
 * (Cuerpo de Cristo, hasta el 31-dic) y lo que pide una iglesia que «necesita
 * dos semanas más para decidir».
 *
 * SOLO EN `trial`, Y ES A PROPÓSITO
 * ---------------------------------
 * Con un plan de pago, el acceso lo lleva Stripe y `trial_until` no se mira
 * (`leerEstadoSuscripcion`). Con `cancelado`, esa columna es el fin del periodo
 * PAGADO, y alargarla le diría a la iglesia «has cancelado, sigue activa hasta
 * el…» con una fecha que nadie pagó. Si hace falta regalar tiempo a quien
 * canceló, se hace en Stripe.
 *
 * El día se cierra a las 23:59 de la zona de LA IGLESIA, no del servidor: el
 * contenedor corre en Europa y media congregación está en Bogotá.
 */
export async function ampliarPrueba(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = idDe(formData);

  const parsed = EsquemaAmpliar.safeParse({ hasta: campo(formData, 'hasta') });
  if (!parsed.success) volver(id, 'error', parsed.error.issues[0]!.message);

  const iglesia = await leer(id);
  if (iglesia.plan !== 'trial') {
    volver(
      id,
      'error',
      'Solo se puede ampliar una prueba. Esta iglesia ya pasó por Stripe y su acceso lo lleva Stripe.',
    );
  }

  const { hasta } = parsed.data;
  const hoy = hoyEnLaIglesia(iglesia.timezone);
  if (hasta < hoy) {
    volver(id, 'error', 'La fecha ya ha pasado. Para cortar el acceso, suspende la iglesia.');
  }

  // Un año como tope: más que eso no es una prueba, es una cuenta gratis, y
  // merece una decisión con nombre (un plan de cortesía), no un campo de fecha.
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() + 1);
  const trialUntil = fechaLocalATimestamp(hasta, '23:59', iglesia.timezone);
  if (trialUntil > limite) {
    volver(id, 'error', 'Como mucho, un año desde hoy.');
  }

  await dbAdmin.transaction(async (tx) => {
    await tx.update(iglesias).set({ trialUntil }).where(eq(iglesias.id, id));
    await apuntar(tx, {
      actorAuthUserId: admin.authUserId,
      accion: 'ampliar_prueba',
      iglesiaId: id,
      // El instante y, además, el DÍA en la zona de la iglesia: las 23:59 de
      // Bogotá son ya el día siguiente en Canarias, y pintado desde el
      // instante el registro diría «hasta el 1 de diciembre» de una prueba
      // ampliada hasta el 30 de noviembre.
      detalle: {
        antes: iglesia.trialUntil?.toISOString() ?? null,
        despues: trialUntil.toISOString(),
        antesDia: iglesia.trialUntil
          ? timestampAFechaHoraLocal(iglesia.trialUntil, iglesia.timezone).fecha
          : null,
        despuesDia: hasta,
      },
    });
  });

  revalidatePath('/admin', 'layout');
  volver(id, 'ok', 'prueba');
}

// ============================================================================
// Suspender y reactivar
// ============================================================================

/**
 * Apaga la iglesia entera: nadie entra a su panel ni a `/mi`
 * (`getCurrentUserContext` filtra por `activa`), y su web pública y su ficha
 * del directorio desaparecen. NO borra nada.
 *
 * Pide la casilla de confirmación porque deja a una congregación entera sin su
 * fichero, y un clic suelto en la ficha equivocada no puede bastar.
 */
export async function suspenderIglesia(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = idDe(formData);

  if (!casilla(formData, 'confirmar')) {
    volver(id, 'error', 'Marca la casilla para confirmar que quieres suspenderla.');
  }

  // Ya suspendida no se apunta otra vez: un doble envío dejaría dos
  // suspensiones seguidas en el registro, y la segunda no cambió nada.
  const iglesia = await leer(id);
  if (iglesia.activa) {
    await dbAdmin.transaction(async (tx) => {
      await tx.update(iglesias).set({ activa: false }).where(eq(iglesias.id, id));
      await apuntar(tx, {
        actorAuthUserId: admin.authUserId,
        accion: 'suspender_iglesia',
        iglesiaId: id,
      });
    });
  }

  revalidatePath('/admin', 'layout');
  volver(id, 'ok', 'suspendida');
}

export async function reactivarIglesia(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = idDe(formData);

  const iglesia = await leer(id);
  if (!iglesia.activa) {
    await dbAdmin.transaction(async (tx) => {
      await tx.update(iglesias).set({ activa: true }).where(eq(iglesias.id, id));
      await apuntar(tx, {
        actorAuthUserId: admin.authUserId,
        accion: 'reactivar_iglesia',
        iglesiaId: id,
      });
    });
  }

  revalidatePath('/admin', 'layout');
  volver(id, 'ok', 'reactivada');
}

// ============================================================================
// Sacar del directorio
// ============================================================================

/**
 * Solo hacia fuera. Salir en el directorio es decisión de la iglesia (por eso
 * el defecto es `false`); lo que sí le toca a la plataforma es retirar una
 * ficha que no debería estar ahí. Volver a publicarla la decide ella desde
 * Ajustes.
 */
export async function sacarDelDirectorio(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = idDe(formData);

  const iglesia = await leer(id);
  if (iglesia.visibleEnDirectorio) {
    await dbAdmin.transaction(async (tx) => {
      await tx
        .update(iglesias)
        .set({ visibleEnDirectorio: false })
        .where(eq(iglesias.id, id));
      await apuntar(tx, {
        actorAuthUserId: admin.authUserId,
        accion: 'sacar_del_directorio',
        iglesiaId: id,
      });
    });
  }

  revalidatePath('/admin', 'layout');
  volver(id, 'ok', 'directorio');
}
