import type { ReactNode } from 'react';
import { Newspaper } from 'lucide-react';

import { formatearFechaLarga } from '@/lib/fecha/hoy';
import type { PublicacionParaFamilia } from '@/lib/ninos/familia';
import { TEXTO_NINOS_PIE_TABLON } from '@/lib/rgpd/consentimiento';

/**
 * El tablón de la familia: lo que se hizo cada día en el ministerio de sus
 * hijos, con sus fotos y vídeos, desde que la aceptaron.
 *
 * Las fotos, a lo ancho y cargando según se llega a ellas (`loading="lazy"`):
 * cada una ronda los 400 KB, y una familia que abre el tablón para ver lo de
 * hoy no tiene por qué bajarse el año entero. Los vídeos, con `preload="none"`
 * y la miniatura de portada: nada baja hasta que se pulsa.
 *
 * Sin botón de descargar. Las capturas no se pueden impedir, y por eso el pie
 * lo pide con palabras (`ninos-textos.md` §2).
 *
 * El texto alternativo no describe la foto, a propósito: describirla sería
 * escribir quién sale en ella.
 */
export function VistaTablonHijos({
  cabecera,
  publicaciones,
}: {
  cabecera: ReactNode;
  publicaciones: PublicacionParaFamilia[];
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {publicaciones.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Newspaper className="size-5" strokeWidth={1.7} aria-hidden />
            </span>
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">Todavía no hay nada</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Cuando los maestros publiquen lo que se hizo en la clase, lo verás aquí y te llegará un aviso.
            </p>
          </div>
        ) : (
          publicaciones.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex flex-col gap-1 px-4 pt-4">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {p.ministerio} · {formatearFechaLarga(p.fecha)}
                </span>
                <p className="whitespace-pre-line text-pretty text-[15px] leading-relaxed">{p.texto}</p>
              </div>
              {p.archivos.length > 0 && (
                <div className="flex flex-col gap-1">
                  {p.archivos.map((a) =>
                    a.tipo === 'video' ? (
                      a.original ? (
                        <video
                          key={a.id}
                          src={a.original}
                          poster={a.miniatura ?? undefined}
                          controls
                          preload="none"
                          playsInline
                          className="w-full bg-surface-alt"
                        />
                      ) : null
                    ) : a.original || a.miniatura ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de diez minutos: no pasa por el optimizador
                      <img
                        key={a.id}
                        src={a.original ?? a.miniatura ?? ''}
                        alt="Foto de la actividad"
                        loading="lazy"
                        className="w-full bg-surface-alt"
                      />
                    ) : null,
                  )}
                </div>
              )}
              {p.archivos.length === 0 && <span className="pb-1" />}
            </article>
          ))
        )}

        {publicaciones.length > 0 && (
          <p className="text-pretty text-[13px] leading-snug text-muted-foreground">{TEXTO_NINOS_PIE_TABLON}</p>
        )}
      </main>
    </div>
  );
}
