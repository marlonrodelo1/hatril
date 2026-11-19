'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { dejarDonativoMensual } from '@/lib/donativos/cobro';
import { mensualPorToken } from '../../_lib/consultas';

/**
 * «Dejarlo», desde el enlace del recibo y sin cuenta.
 *
 * EL TOKEN SE VUELVE A COMPROBAR AQUÍ
 * -----------------------------------
 * La página ya lo comprobó para pintarse, pero una server action es un
 * endpoint público: se puede llamar sin haber abierto la página nunca, con
 * cualquier slug y cualquier token. Así que se busca otra vez la fila por el
 * hash del token Y por la iglesia del slug, y solo con ella se llama a
 * `dejarDonativoMensual`, que confía en que quien llama ya lo ha mirado.
 *
 * Los errores vuelven por `?error=`, como en el resto del repo: aquí no hay
 * nada escrito que perder.
 */

const Entrada = z.object({
  slug: z.string().min(1).max(100),
  token: z.string().min(1).max(200),
});

const NO_SIRVE = 'Este enlace ya no sirve. Usa el del último recibo que te llegó por correo.';
const NO_SE_PUDO =
  'No se ha podido dejar ahora mismo. Inténtalo de nuevo en un momento; si sigue fallando, escribe a la iglesia.';

export async function dejarMensual(slug: string, token: string): Promise<void> {
  const parsed = Entrada.safeParse({ slug, token });
  if (!parsed.success) redirect('/');

  const destino = `/i/${encodeURIComponent(parsed.data.slug)}/dar/mensual/${encodeURIComponent(parsed.data.token)}`;

  const datos = await mensualPorToken(parsed.data.slug, parsed.data.token);
  if (!datos?.mensual) {
    redirect(`${destino}?error=` + encodeURIComponent(NO_SIRVE));
  }

  // Ya dejado: no se vuelve a llamar a Stripe, y se dice que está hecho.
  if (datos.mensual.estado !== 'cancelado') {
    const ok = await dejarDonativoMensual(datos.mensual.id);
    if (!ok) redirect(`${destino}?error=` + encodeURIComponent(NO_SE_PUDO));
  }

  redirect(`${destino}?hecho=1`);
}
