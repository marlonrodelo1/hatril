import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { puedeVerFondoDe } from '@/lib/auth/permisos';
import { cuentasDelFondo } from '@/lib/finanzas/del-ministerio';
import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { mesPedido } from '@/lib/fecha/mes';
import type { Moneda } from '@/lib/db/schema';
import { CuentasDelFondoVista } from '@/app/panel/ministerios/[id]/fondo/_components/cuentas';
import { MarcoEquipo } from '../../_components/marco';

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
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id);
  if (!puedeVerFondoDe(ctx, id) || !ministerio.conFondo) notFound();

  const { mes: mesUrl } = await searchParams;
  const mes = mesPedido(ctx.iglesia.timezone, mesUrl);
  const cuentas = await cuentasDelFondo(ctx, id, mes.desde, mes.hasta);
  if (!cuentas) notFound();

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={`Fondo · ${ministerio.nombre}`}
      subtitulo="De solo lectura"
      volver={rutaApp(id)}
    >
      <CuentasDelFondoVista
        cuentas={cuentas}
        moneda={ctx.iglesia.moneda as Moneda}
        base={rutaApp(id, 'fondo')}
        mes={mes}
      />
    </MarcoEquipo>
  );
}
