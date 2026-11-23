'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireFinanzasAccion } from '@/lib/auth/guard-panel';
import { campoObligatorio } from '@/lib/api/formulario';
import { withUser } from '@/lib/db';
import { fondos } from '@/lib/db/schema';
import {
  abrirAlta,
  DESTINO_EN_LINEA,
  MENSAJE_SOLO_ESPANA,
  paisAdmitido,
} from './_lib/alta';

/**
 * Las dos acciones de Finanzas → Ofrendas en línea.
 *
 * Conectar es gobierno y va solo para el pastor (`soloPastor`): abre una cuenta
 * de Stripe a nombre de la iglesia. Elegir qué fondos salen al dar es llevar la
 * caja, y lo hace quien tenga `gestionar_finanzas`, como cualquier otra cosa
 * de Finanzas. Las dos pasan el muro de suscripción.
 */

function volver(mensaje: string): never {
  redirect(`${DESTINO_EN_LINEA}?error=` + encodeURIComponent(mensaje));
}

/** Al alta de Stripe: crea la cuenta la primera vez, o retoma la que quedó a medias. */
export async function conectarStripe(): Promise<void> {
  const ctx = await requireFinanzasAccion(DESTINO_EN_LINEA, { soloPastor: true });

  if (!paisAdmitido(ctx.iglesia)) volver(MENSAJE_SOLO_ESPANA);

  const alta = await abrirAlta(ctx);
  if ('error' in alta) volver(alta.error);

  // Fuera de cualquier `try`: `redirect()` funciona lanzando (ver `abrirAlta`).
  redirect(alta.url);
}

/**
 * `enDonativos` viaja como el valor AL QUE se cambia, no como «cambia lo que
 * haya»: dos pestañas abiertas, o un doble toque, darían la vuelta dos veces y
 * dejarían el fondo como estaba sin que nadie lo hubiera pedido.
 */
const EsquemaFondo = z.object({
  fondoId: z.uuid({ error: 'Ese fondo no existe.' }),
  enDonativos: z.enum(['si', 'no'], { error: 'No se ha podido guardar el cambio.' }),
});

export async function cambiarFondoEnDonativos(formData: FormData): Promise<void> {
  const ctx = await requireFinanzasAccion(DESTINO_EN_LINEA);

  const datos = EsquemaFondo.safeParse({
    fondoId: campoObligatorio(formData, 'fondoId'),
    enDonativos: campoObligatorio(formData, 'enDonativos'),
  });
  if (!datos.success) {
    volver(datos.error.issues[0]?.message ?? 'No se ha podido guardar el cambio.');
  }

  const encender = datos.data.enDonativos === 'si';

  // La iglesia del contexto además de la RLS, que ya la impone: un id de otra
  // congregación no toca nada en vez de depender solo de la policy. Y nunca el
  // general: es «Donde más falte» y sale siempre, marcado o no. Archivado
  // tampoco, que no se ofrece en ninguna parte.
  const cambiados = await withUser(ctx.user.id, (tx) =>
    tx
      .update(fondos)
      .set({ enDonativos: encender })
      .where(
        and(
          eq(fondos.id, datos.data.fondoId),
          eq(fondos.iglesiaId, ctx.iglesia.id),
          eq(fondos.esGeneral, false),
          eq(fondos.activo, true),
        ),
      )
      .returning({ id: fondos.id }),
  );

  if (cambiados.length === 0) {
    volver('Ese fondo no se puede cambiar aquí: o es el general, o está archivado.');
  }

  revalidatePath(DESTINO_EN_LINEA);
  redirect(`${DESTINO_EN_LINEA}?ok=${encender ? 'fondo-dentro' : 'fondo-fuera'}`);
}
