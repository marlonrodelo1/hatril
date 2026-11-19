'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { campo } from '@/lib/api/formulario';
import { withUser } from '@/lib/db';
import { donativosMensuales } from '@/lib/db/schema';
import { dejarDonativoMensual } from '@/lib/donativos/cobro';

const DESTINO = '/mi/cuenta/donativos';

function volver(params: string): never {
  redirect(`${DESTINO}?${params}`);
}

const Entrada = z.object({
  id: z.uuid({ error: 'Esa ofrenda mensual no existe.' }),
});

/**
 * «Dejarlo»: dejar lo que alguien da cada mes, desde «Lo que he dado».
 *
 * `sinMuro`: dejar de pagar es de lo que nunca se bloquea. Si la iglesia deja
 * de pagar Hatril, su gente tiene que poder dejar de darle cada mes igual.
 *
 * DE QUIÉN ES LA FILA LO DICE LA BASE, Y ADEMÁS SE PREGUNTA
 * ---------------------------------------------------------
 * `dejarDonativoMensual` va con `dbAdmin` y cancela en Stripe lo que le
 * pasen: no sabe quién llama. Así que antes se lee la fila con `withUser`,
 * donde la RLS de la `0056` solo da las propias... o, al pastor y a
 * tesorería, las de toda su iglesia. Por eso el filtro por
 * `donante_auth_user_id` además: sin él, un pastor podría dejar la ofrenda
 * mensual de cualquiera de su congregación con un id y un POST fabricado.
 * Y por `iglesia_id`, que es la iglesia desde la que mira.
 */
export async function dejarMensual(formData: FormData) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });

  const r = Entrada.safeParse({ id: campo(formData, 'id') });
  if (!r.success) {
    volver('error=' + encodeURIComponent(r.error.issues[0]?.message ?? 'Esa ofrenda mensual no existe.'));
  }
  const { id } = r.data;

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: donativosMensuales.id })
      .from(donativosMensuales)
      .where(
        and(
          eq(donativosMensuales.id, id),
          eq(donativosMensuales.donanteAuthUserId, ctx.user.id),
          eq(donativosMensuales.iglesiaId, ctx.iglesia.id),
          inArray(donativosMensuales.estado, ['activo', 'impagado']),
        ),
      )
      .limit(1),
  );
  // Ni tuya ni de esta iglesia, o ya dejada: lo mismo para quien pregunta.
  if (!fila) {
    volver('error=' + encodeURIComponent('Esa ofrenda mensual no está, o ya la habías dejado.'));
  }

  const hecho = await dejarDonativoMensual(fila.id);
  if (!hecho) {
    volver(
      'error=' +
        encodeURIComponent(
          'No se ha podido dejar ahora mismo. Inténtalo en un rato; si sigue sin ir, díselo a tu iglesia.',
        ),
    );
  }

  revalidatePath(DESTINO);
  revalidatePath('/mi/cuenta');
  volver('dejado=1');
}
