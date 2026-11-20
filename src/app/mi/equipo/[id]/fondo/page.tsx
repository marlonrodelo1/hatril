import type { Metadata } from 'next';

import { VistaFondo } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Fondo' };

/**
 * El fondo del ministerio en la app: la misma vista que la pestaña del panel.
 *
 * Las puertas son las de la pestaña (`panel/ministerios/[id]/fondo/guarda.ts`),
 * puestas aquí a mano porque el fondo no es un módulo y la guarda de la zona
 * solo sabe de módulos: llevar el ministerio (`requireMinisterioEnLaApp`), y
 * además hacerlo desde dentro con Finanzas encendida (`puedeVerFondoDe`) y que
 * tenga un fondo vinculado. Lo que falte da 404, como el resto de la zona.
 */
export default async function FondoEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { id } = await params;
  const { mes: mesUrl } = await searchParams;
  const datos = await cargar({ id, mes: mesUrl });
  return <VistaFondo {...datos} />;
}
