import Image from 'next/image';
import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { devocionalDeHoy } from '@/lib/devocionales/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';

export const metadata: Metadata = { title: 'Devocional' };

export default async function DevocionalPage() {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const d = await devocionalDeHoy(ctx);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Devocional"
        subtitulo={ctx.iglesia.nombre}
        logoUrl={ctx.iglesia.logoUrl}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-5 px-4 py-6 sm:px-5">
        {!d ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            <h1 className="t-subtitulo">Todavía no hay devocional</h1>
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              Cuando alguien de tu iglesia publique el primero, aparecerá aquí
              cada día.
            </p>
          </div>
        ) : (
          <article className="flex flex-col gap-4">
            {d.imagenUrl && (
              <div className="h-[190px] overflow-hidden rounded-xl border border-border bg-surface">
                <Image
                  src={d.imagenUrl}
                  alt=""
                  width={620}
                  height={190}
                  unoptimized
                  className="size-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              {/*
               * Se dice la fecha SIEMPRE, y se avisa cuando no es la de hoy. El
               * público hace lo mismo: enseñar el de ayer sin decirlo hace que
               * alguien se lo lea creyendo que es el de esta mañana.
               */}
              <span className="t-micro first-letter:uppercase">
                {formatearFechaLarga(d.fecha)}
                {!d.esDeHoy && ' · el último publicado'}
              </span>
              {d.titulo && <h1 className="t-titulo">{d.titulo}</h1>}
            </div>

            {d.versiculo && (
              <blockquote className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5">
                <p className="text-pretty text-[16px] leading-relaxed">
                  «{d.versiculo}»
                </p>
                {d.referencia && (
                  <cite className="t-label not-italic text-muted-foreground">
                    {d.referencia}
                  </cite>
                )}
              </blockquote>
            )}

            {/*
             * `whitespace-pre-line`: el cuerpo se escribe en un textarea y sus
             * saltos de línea son del autor. Sin esto, un devocional de cinco
             * párrafos sale como un ladrillo.
             */}
            <p className="whitespace-pre-line text-pretty text-[15.5px] leading-relaxed">
              {d.cuerpo}
            </p>

            {d.videoUrl && (
              <a
                href={d.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] font-semibold no-underline hover:bg-surface-alt hover:no-underline"
              >
                <ExternalLink className="size-4" strokeWidth={1.8} />
                Verlo en vídeo
              </a>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
