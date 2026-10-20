'use client';

import { Pause, Play } from 'lucide-react';

import { servidorDe, type Programa } from '@/lib/emisora/config';
import { Aviso } from '@/components/aviso';
import { ProgramacionSemanal } from '@/components/radio/programacion';
import { useAhora } from '@/components/radio/use-ahora';
import { useSenal } from '@/components/radio/use-senal';
import { Button } from '@/components/ui/button';

/**
 * «Radio en directo» en la web pública de la iglesia.
 *
 * Solo llega aquí si el pastor la marcó para la web y la web está publicada
 * (`radioPublica()`). Lo que se pinta es el nombre, el botón, qué suena y de
 * qué va, y la parrilla; nada de quién presenta.
 *
 * Una tarjeta blanca con borde, como el resto de la página. La primera versión
 * era un bloque carbón con letra blanca, copiado de «Lo próximo» de los
 * horarios: dos bloques oscuros en la misma página competían entre sí, y el de
 * la radio no tenía más motivo para serlo que parecerse al otro.
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 md:gap-5 md:p-6">
          {/* Sin `crossOrigin` y con `preload="none"`: ver `use-senal.ts`. */}
          <audio ref={audio} preload="none" />

          {/* Carbón y no naranja: el naranja de esta página es «Cómo llegar». */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => alternar()}
            aria-label={activo ? `Parar ${nombre}` : `Escuchar ${nombre} en directo`}
            className="size-14 flex-none rounded-full"
          >
            {activo ? (
              <Pause className="size-6" strokeWidth={1.6} fill="currentColor" />
            ) : (
              <Play className="ml-0.5 size-6" strokeWidth={1.6} fill="currentColor" />
            )}
          </Button>

          <div className="flex min-w-0 flex-col gap-1">
            <span className="t-micro">
              {estado === 'conectando'
                ? 'Conectando…'
                : estado === 'sonando'
                  ? 'Sonando en directo'
                  : 'En directo'}
            </span>
            <span className="text-[20px] font-extrabold leading-tight tracking-[-0.025em] md:text-[24px]">
              {ahora ? ahora.nombre : nombre}
            </span>
            {ahora?.tema && (
              <span className="text-pretty text-[14.5px] leading-snug text-muted-foreground">
                {ahora.tema}
              </span>
            )}
            {luego && (
              <span className="text-[13.5px] text-muted-foreground">
                Luego: {luego.programa.nombre}, {luego.cuando}
              </span>
            )}
          </div>
        </div>

        {estado === 'error' && error ? (
          <Aviso>{error}</Aviso>
        ) : (
          <p className="px-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Al darle a escuchar te conectas a {servidorDe(streamUrl)}, el servidor de la
            emisora. Esta web no apunta quién escucha.
          </p>
        )}
      </div>

      {parrilla.length > 0 && (
        <ProgramacionSemanal parrilla={parrilla} hoy={hoy} ahora={ahora} />
      )}
    </div>
  );
}
