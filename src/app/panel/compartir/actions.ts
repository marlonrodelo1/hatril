'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { requirePastorAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { campo } from '@/lib/api/formulario';
import { normalizarRed, REDES, type Red } from '@/lib/iglesias/redes';

/**
 * Las redes sociales de la iglesia.
 *
 * `requirePastorAccion` y no un permiso: esto es identidad publicada de la
 * congregación, de la misma familia que el nombre, el logo y la cuenta de
 * donativos, que ya son del pastor en `ajustes/actions.ts`. La pantalla la ve
 * todo el equipo —copiar un enlace público no es una decisión de gobierno—, pero
 * escribir lo que sale publicado con el nombre de la iglesia, no.
 */

const DESTINO = '/panel/compartir';

function volver(mensaje: string): never {
  redirect(`${DESTINO}?error=` + encodeURIComponent(mensaje));
}

export async function guardarRedes(formData: FormData): Promise<void> {
  const ctx = await requirePastorAccion(DESTINO);

  const redes: Partial<Record<Red, string>> = {};

  for (const red of REDES) {
    // Nunca `formData.get()` directo: devuelve `null` cuando el campo no viaja
    // en el envío, y eso ya tumbó el inicio de sesión entero una vez.
    const resultado = normalizarRed(red, campo(formData, red), ctx.iglesia.pais);

    if (!resultado.ok) volver(resultado.error);

    // Lo que se deja en blanco se quita: el objeto se reconstruye entero en cada
    // guardado en vez de mezclarse con lo que hubiera, así que borrar una red es
    // vaciar su caja, que es lo que cualquiera espera.
    if (resultado.url) redes[red] = resultado.url;
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({ redes, updatedAt: new Date() })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  revalidatePath(DESTINO);
  // La web pública va con ISR de 60 segundos: sin esto el pastor guarda, abre su
  // página y no ve el cambio, así que vuelve y lo guarda otra vez.
  revalidatePath(`/i/${ctx.iglesia.slug}`);

  redirect(`${DESTINO}?guardado=redes`);
}
