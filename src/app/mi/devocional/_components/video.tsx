'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

import {
  miniaturaDe,
  urlDelReproductor,
  type VideoDevocional,
} from '@/lib/devocionales/video';

/**
 * El vídeo del devocional, viéndose dentro de la aplicación.
 *
 * POR QUÉ NO ES UN `<iframe>` A SECAS, QUE ERA LO FÁCIL
 * -----------------------------------------------------
 * El repo llevaba desde el principio con el enlace que abre YouTube fuera, y el
 * motivo está escrito en el schema: **el reproductor de YouTube escribe en el
 * navegador de quien abre la página antes de que le dé a play**. Empotrarlo sin
 * más convierte cada visita al devocional en una visita rastreada por Google, y
 * obliga a un aviso de cookies en una pantalla donde la gente solo venía a leer.
 * Y son varios cientos de kilobytes de JavaScript de terceros.
 *
 * Ese mismo comentario dejaba escrito el camino: **la miniatura con el botón de
 * play que solo carga el reproductor al pulsarlo**. Es lo que hay aquí, y por eso
 * este componente es de cliente: hace falta recordar si ya se pulsó.
 *
 * Hasta que alguien pulse, esta pantalla no habla con Google.
 *
 * DOS DETALLES QUE SOSTIENEN ESA PROMESA
 * --------------------------------------
 *   1. **La miniatura preferida es la del propio devocional**, la que subió la
 *      iglesia a su bucket. Solo cuando no hay se pide la de YouTube — que
 *      viene de `i.ytimg.com`, un dominio que sirve imágenes y no deja cookies,
 *      pero que sigue siendo una llamada a Google.
 *   2. **El reproductor va en `youtube-nocookie.com`**. No evita que sepan quién
 *      ve qué —la petición lleva la IP igual— pero sí que dejen cookies de
 *      seguimiento. Es la diferencia entre rastrear a quien ve el vídeo y
 *      rastrear a quien abre la pantalla.
 *
 * Y SE AVISA ANTES, NO DESPUÉS
 * ----------------------------
 * Una línea pequeña bajo el botón dice que al reproducir se carga YouTube. No es
 * un banner de cookies: es que pulsar play sea una decisión informada, que es lo
 * que convierte esto en un acto afirmativo de la persona y no en un rastreo por
 * el que nadie preguntó.
 */
export function VideoDelDevocional({
  video,
  portada,
}: {
  video: VideoDevocional;
  /** La imagen del devocional, si la iglesia subió una. */
  portada?: string | null;
}) {
  const [reproduciendo, setReproduciendo] = useState(false);

  if (reproduciendo) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        <iframe
          src={urlDelReproductor(video)}
          title="Vídeo del devocional"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setReproduciendo(true)}
        aria-label="Reproducir el vídeo del devocional"
        className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-surface-alt outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={portada ?? miniaturaDe(video)}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />

        {/* La cortina, para que el botón de play se lea sobre cualquier
            fotograma. Negro puro y no un token: no depende del tema. */}
        <span className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/25" />

        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:scale-105">
            {/* Relleno además del contorno: un triángulo hueco a este tamaño se
                lee como un icono de «siguiente», no como «reproducir». */}
            <Play className="ml-0.5 size-7" strokeWidth={1.6} fill="currentColor" />
          </span>
        </span>
      </button>

      <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
        Al reproducirlo se carga YouTube, que puede registrar la visita. Hasta
        entonces, esta pantalla no habla con ellos.
      </p>
    </div>
  );
}
