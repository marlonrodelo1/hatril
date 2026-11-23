import type { Metadata } from 'next';
import { Smartphone } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';

export const metadata: Metadata = { title: 'Mis hijos' };

/**
 * «Mis hijos» en la web: solo dice que se ve en la app.
 *
 * Lo de los padres del ministerio de Niños va SOLO en la app empaquetada
 * (`plan-ninos.md` §6: la web `/mi` está congelada mientras dure la obra de la
 * app). Esta página existe para que los avisos de las familias —que enlazan a
 * `/mi/hijos` y `/mi/hijos/tablon`, las rutas de la app— no lleven a un 404
 * cuando se tocan en la campana de la web.
 */
export default async function MisHijosWebPage() {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro user={ctx.user} titulo="Mis hijos" subtitulo={ctx.iglesia.nombre} volver="/mi/cuenta" />
      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Smartphone className="size-5" strokeWidth={1.7} aria-hidden />
          </span>
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">Esto se ve en la app</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Lo de tus hijos en el ministerio de Niños —pedir verlo, el tablón con sus fotos y los permisos— está
            en la app de Hatril para el teléfono. Entra en ella con la misma cuenta.
          </p>
        </div>
      </main>
    </div>
  );
}
