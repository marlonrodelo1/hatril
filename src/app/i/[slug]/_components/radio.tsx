'use client';

import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';

import { servidorDe, type Programa } from '@/lib/emisora/config';
import { ProgramacionSemanal } from '@/components/radio/programacion';
import { useAhora } from '@/components/radio/use-ahora';
import { useSenal } from '@/components/radio/use-senal';

/**
 * «Radio en directo» en la web pública de la iglesia.
 *
 * Solo llega aquí si el pastor la marcó para la web y la web está publicada
 * (`radioPublica()`). Lo que se pinta es el nombre, el botón, qué suena y la
 * parrilla; nada de quién presenta.
 *
 * El aviso del servidor va SIEMPRE a la vista, no solo antes del primer play
 * como en `/mi`: quien llega a esta página no ha aceptado nada con nadie, y
 * pulsar ▶ es lo que le conecta a un tercero.
 */
export function RadioIglesia({
  nombre,
  streamUrl,
  parrilla,
  timezone,
  iglesiaNombre,
  caratula,
}: {
  nombre: string;
  streamUrl: string;
  parrilla: Programa[];
  timezone: string;
  iglesiaNombre: string;
  caratula: string | null;
}) {
  const { ahora, luego, hoy } = useAhora(parrilla, timezone);
  const { audio, estado, error, alternar } = useSenal(streamUrl, {
    titulo: ahora?.nombre ?? nombre,
    artista: nombre,
    album: iglesiaNombre,
    caratula,
  });
  const activo = estado === 'sonando' || estado === 'conectando';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-support p-5 text-white sm:flex-row sm:items-center sm:gap-5 md:p-7">
        {/* Sin `crossOrigin` y con `preload="none"`: ver `use-senal.ts`. */}
        <audio ref={audio} preload="none" />

        <button
          type="button"
          onClick={() => alternar()}
          aria-label={activo ? `Parar ${nombre}` : `Escuchar ${nombre} en directo`}
          // Botón claro sobre el bloque oscuro, y no naranja: el naranja de esta
          // página ya es «Cómo llegar».
          className="flex size-16 flex-none cursor-pointer items-center justify-center rounded-full bg-surface text-foreground outline-none transition-colors hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-white/40"
        >
          {estado === 'conectando' ? (
            <Loader2 className="size-7 animate-spin" strokeWidth={2} />
          ) : estado === 'sonando' ? (
            <Pause className="size-7" strokeWidth={1.6} fill="currentColor" />
          ) : (
            <Play className="ml-1 size-7" strokeWidth={1.6} fill="currentColor" />
          )}
        </button>

        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="t-micro text-white/70">
            {estado === 'sonando' ? 'Sonando en directo' : 'En directo'}
          </span>
          <span className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] md:text-[28px]">
            {ahora ? ahora.nombre : nombre}
          </span>
          {luego && (
            <span className="text-[14.5px] text-white/80">
              Luego: {luego.programa.nombre}, {luego.cuando}
            </span>
          )}
          {estado === 'error' && error ? (
            <span role="alert" className="flex items-start gap-1.5 text-[13.5px] text-white">
              <AlertCircle className="mt-px size-4 flex-none" strokeWidth={1.9} />
              {error}
            </span>
          ) : (
            <span className="text-[12.5px] leading-relaxed text-white/70">
              Al pulsar ▶ te conectas a {servidorDe(streamUrl)}, el servidor de la
              emisora. Esta web no apunta quién escucha.
            </span>
          )}
        </div>
      </div>

      {parrilla.length > 0 && (
        <ProgramacionSemanal parrilla={parrilla} hoy={hoy} ahora={ahora} />
      )}
    </div>
  );
}
