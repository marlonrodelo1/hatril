import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { fichaDeIglesia } from '@/lib/iglesias/directorio';
import { mapaWeb } from '@/lib/lugares/mapa';
import { VistaFicha } from './_components/vista-ficha';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const iglesia = await fichaDeIglesia((await params).slug);
  return { title: iglesia?.nombre ?? 'Iglesia' };
}

/**
 * La ficha de una iglesia en la app, antes de pedir entrar.
 *
 * Más corta que su web (`/i/[slug]`): quien llega aquí desde la búsqueda quiere
 * saber si es la suya, dónde está y cuándo se reúne, y pedir entrar. Un solo
 * naranja, «Pedir unirme», y nada que sugiera entrada directa: siempre aprueba
 * el pastor. Se llamaba «Solicitar ser miembro»; ahora dice lo mismo que el
 * directorio, porque la misma acción lleva el mismo botón en todas partes.
 *
 * EL REDISEÑO DEL 17-NOV (zona 3, pieza «Unirse»)
 * -----------------------------------------------
 *   - Arriba, la foto de la iglesia con el logo montado sobre el borde. Antes
 *     no había ninguna aunque la iglesia las tuviera en su web, y es lo que
 *     hace reconocer el sitio a quien ya ha ido alguna vez. `bannerUrl` es la
 *     primera de sus `imagenes`, duplicada a propósito para esto (schema). Sin
 *     foto, el logo encabeza la ficha y no queda ningún hueco gris.
 *   - El botón, fijo abajo, al alcance del pulgar: con cuatro horarios y la
 *     dirección, antes quedaba debajo del pliegue en un móvil pequeño.
 *
 * TRES VARIANTES, Y NINGUNA ES UN ERROR
 * -------------------------------------
 *   - La iglesia no acepta solicitudes por la app: gestiona las altas en
 *     persona, y se dan su teléfono y su correo.
 *   - Quien mira ya es de otra iglesia, o tiene una solicitud pendiente: en
 *     Hatril se es de una sola, así que no hay botón de solicitar. La base lo
 *     admitiría —el unique es por pareja—; la regla la pone la aplicación.
 *   - Quien mira ya es de ESTA: a su muro.
 *
 * Solo lo que es un botón va en el pie fijo. Las variantes que explican algo
 * van al final de la ficha: un párrafo pegado al borde de la pantalla taparía
 * media ficha en el móvil.
 */
export default async function FichaIglesiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const iglesia = await fichaDeIglesia((await params).slug);
  if (!iglesia) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ctx, solicitud] = user
    ? await Promise.all([getCurrentUserContext(), solicitudDeUsuario(user.id)])
    : [null, null];

  const pendiente = solicitud?.estado === 'pendiente' ? solicitud : null;

  return (
    <VistaFicha
      iglesia={iglesia}
      miIglesia={ctx?.iglesia.nombre ?? null}
      esDeEsta={ctx?.iglesia.id === iglesia.id}
      pendiente={pendiente && { nombre: pendiente.iglesiaNombre, slug: pendiente.iglesiaSlug }}
      mapa={mapaWeb()}
    />
  );
}
