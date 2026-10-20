import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { cuentasDelFondo } from '@/lib/finanzas/del-ministerio';
import { mesPedido } from '@/lib/fecha/mes';
import type { Moneda } from '@/lib/db/schema';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { CuentasDelFondoVista } from './_components/cuentas';
import { requireFondo } from './guarda';

export const metadata: Metadata = { title: 'Fondo' };

/**
 * El dinero del ministerio, para quien lo lleva: el líder de alimentos ve su
 * fondo. De solo lectura; lo apunta el tesorero desde Finanzas.
 */
export default async function FondoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { id } = await params;
  const { ctx, ministerio } = await requireFondo(id);
  const { mes: mesUrl } = await searchParams;

  const mes = mesPedido(ctx.iglesia.timezone, mesUrl);
  const cuentas = await cuentasDelFondo(ctx, id, mes.desde, mes.hasta);
  // El pastor pudo desvincularlo entre la guarda y esta consulta.
  if (!cuentas) notFound();

  const base = `/panel/ministerios/${id}/fondo`;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo={`Fondo «${cuentas.fondo.nombre}», de solo lectura`}
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="fondo" />

        <CuentasDelFondoVista
          cuentas={cuentas}
          moneda={ctx.iglesia.moneda as Moneda}
          base={base}
          mes={mes}
        />
      </Contenedor>
    </>
  );
}
