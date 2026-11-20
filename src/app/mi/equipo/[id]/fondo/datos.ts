import 'server-only';

import { notFound } from 'next/navigation';
import { puedeVerFondoDe } from '@/lib/auth/permisos';
import { cuentasDelFondo } from '@/lib/finanzas/del-ministerio';
import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { mesPedido } from '@/lib/fecha/mes';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, mes: mesUrl }: { id: string; mes?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id);
  if (!puedeVerFondoDe(ctx, id) || !ministerio.conFondo) notFound();

  const mes = mesPedido(ctx.iglesia.timezone, mesUrl);
  const cuentas = await cuentasDelFondo(ctx, id, mes.desde, mes.hasta);
  if (!cuentas) notFound();

  return { id, ctx, ministerio, mes, cuentas };
}
