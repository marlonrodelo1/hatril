import { Film } from 'lucide-react';

import type { ArchivoDelDrive } from '@/lib/ninos/consultas';

/**
 * Un archivo del drive en su cuadro: la foto, o el vídeo con sus controles.
 *
 * El vídeo con `preload="none"`: no se descarga nada hasta que alguien pulsa.
 * Cada megabyte que se baja se paga (`plan-ninos.md` §5), y un drive con veinte
 * vídeos cargaría dos gigas al abrirlo.
 *
 * El texto alternativo no describe la foto, a propósito: describirla sería
 * escribir quién sale en ella.
 */
export function CuadroArchivo({
  archivo,
  urls,
}: {
  /** Solo lo que se pinta: la app lo recibe en JSON, y la ruta en Storage no le hace falta. */
  archivo: Pick<ArchivoDelDrive, 'tipo' | 'duracionS'>;
  urls: { miniatura: string | null; video: string | null };
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt">
      {archivo.tipo === 'video' ? (
        urls.video ? (
          <video
            src={urls.video}
            poster={urls.miniatura ?? undefined}
            controls
            preload="none"
            playsInline
            className="size-full object-cover"
          />
        ) : (
          <SinVista />
        )
      ) : urls.miniatura ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada de diez minutos: no pasa por el optimizador
        <img src={urls.miniatura} alt="Foto de la actividad" className="size-full object-cover" loading="lazy" />
      ) : (
        <SinVista />
      )}
      {archivo.tipo === 'video' && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[11.5px] font-semibold text-white">
          <Film className="size-3" strokeWidth={2} aria-hidden />
          {archivo.duracionS ? `${archivo.duracionS} s` : 'Vídeo'}
        </span>
      )}
    </div>
  );
}

function SinVista() {
  return (
    <span className="flex size-full items-center justify-center px-2 text-center text-[12px] text-muted-foreground">
      No se puede ver ahora
    </span>
  );
}
