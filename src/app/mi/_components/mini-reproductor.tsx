'use client';

import { useState } from 'react';
import { AlertCircle, ChevronUp, Pause, Play } from 'lucide-react';

import type { Programa } from '@/lib/emisora/config';
import { servidorDe } from '@/lib/emisora/config';
import { Hoja } from '@/components/hoja';
import { ProgramacionSemanal } from '@/components/radio/programacion';
import { useAhora } from '@/components/radio/use-ahora';
import { useSenal } from '@/components/radio/use-senal';
import { Button } from '@/components/ui/button';

/**
 * La radio de la iglesia, en una línea encima de las pestañas.
 *
 * ENCIMA DE LA BARRA Y NO UNA QUINTA PESTAÑA
 * ------------------------------------------
 * La barra se cerró a cuatro a propósito (`barra-inferior.tsx`), y la radio no
 * la tiene cualquier iglesia: una pestaña que existe en unas congregaciones y
 * en otras no mueve de sitio a las demás. Así que solo aparece donde hay
 * emisora, y donde no, no ocupa nada.
 *
 * VIVE EN EL LAYOUT, Y POR ESO SIGUE SONANDO
 * ------------------------------------------
 * `mi/layout.tsx` no se desmonta al pasar de Comunidad a Agenda, así que el
 * `<audio>` de aquí tampoco. Sale de `/mi` y se corta, que es lo que se espera
 * al irse a otra parte.
 *
 * Lo que NO hace en el móvil, todavía: seguir sonando con la pantalla
 * bloqueada en un iPhone. Safari puede cortar el audio de una web en segundo
 * plano; eso llega con la app nativa de la v2.
 */
export function MiniReproductor({
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
  const [verProgramacion, setVerProgramacion] = useState(false);
  // Se avisa a dónde se conecta hasta la primera vez que se pulsa: después ya
  // lo sabe, y la línea sirve para decir qué viene luego.
  const [yaPulso, setYaPulso] = useState(false);
  const { ahora, luego, hoy } = useAhora(parrilla, timezone);

  const { audio, estado, error, alternar } = useSenal(streamUrl, {
    titulo: ahora?.nombre ?? nombre,
    artista: nombre,
    album: iglesiaNombre,
    caratula,
  });

  const servidor = servidorDe(streamUrl);
  const suena = estado === 'sonando' || estado === 'conectando';

  return (
    <>
      <div
        className={
          // Justo encima de la barra: su `bottom` más su alto (65 px en móvil a
          // 375, 52 en escritorio, medidos) más un hueco de 6. Si la barra cambia de alto, esto
          // se queda montado encima: medirlas juntas al tocar una, y con ellas
          // el hueco de abajo de `mi/layout.tsx`, que cuenta con las dos.
          'fixed inset-x-3 z-30 flex items-center gap-2.5 rounded-2xl border border-border py-1.5 pl-1.5 pr-1 ' +
          'bottom-[calc(0.75rem+env(safe-area-inset-bottom)+71px)] ' +
          // El mismo cristal que la barra, con su misma guarda: ver allí por qué
          // es 0.92 y no menos.
          'bg-surface supports-backdrop-filter:bg-surface/92 supports-backdrop-filter:backdrop-blur-2xl supports-backdrop-filter:backdrop-saturate-150 ' +
          'md:inset-x-auto md:bottom-[calc(1.25rem+58px)] md:left-1/2 md:w-[420px] md:-translate-x-1/2'
        }
      >
        {/* Sin `crossOrigin` y con `preload="none"`: ver `use-senal.ts`. */}
        <audio ref={audio} preload="none" />

        {/* El botón carbón del sistema y no uno pintado aquí: el naranja es
            de la acción principal de cada pantalla, y esta línea sale en
            todas. Sin icono girando al conectar: lo dice la segunda línea. */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => {
            setYaPulso(true);
            alternar();
          }}
          aria-label={suena ? `Parar ${nombre}` : `Escuchar ${nombre} en directo`}
          className="flex-none rounded-full"
        >
          {suena ? (
            <Pause className="size-[18px]" strokeWidth={1.8} fill="currentColor" />
          ) : (
            <Play className="ml-0.5 size-[18px]" strokeWidth={1.8} fill="currentColor" />
          )}
        </Button>

        <button
          type="button"
          onClick={() => setVerProgramacion(true)}
          aria-label="Ver la programación de la radio"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13.5px] font-bold leading-tight">
              {ahora ? `${ahora.nombre} · ${nombre}` : `${nombre} · En directo`}
            </span>

            <span className="flex min-w-0 items-center gap-1 text-[12px] leading-tight text-muted-foreground">
              {estado === 'error' && error ? (
                <>
                  <AlertCircle
                    className="size-3.5 flex-none text-danger"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="truncate text-danger">{error}</span>
                </>
              ) : estado === 'conectando' ? (
                <span className="truncate">Conectando con {servidor}…</span>
              ) : !yaPulso ? (
                <span className="truncate">Al escuchar te conectas a {servidor}</span>
              ) : luego ? (
                <span className="truncate">
                  Luego: {luego.programa.nombre}, {luego.cuando}
                </span>
              ) : (
                <span className="truncate">En directo desde {servidor}</span>
              )}
            </span>
          </span>

          <ChevronUp
            className="size-[18px] flex-none text-muted-foreground"
            strokeWidth={1.9}
            aria-hidden
          />
        </button>
      </div>

      <Hoja
        abierta={verProgramacion}
        onCambio={setVerProgramacion}
        titulo={nombre}
        descripcion="La programación de la radio de tu iglesia"
      >
        <div className="flex flex-col gap-4 pb-2">
          {parrilla.length > 0 ? (
            <ProgramacionSemanal parrilla={parrilla} hoy={hoy} ahora={ahora} />
          ) : (
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Tu iglesia todavía no ha publicado la programación. La radio se
              puede escuchar igual.
            </p>
          )}

          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Al darle a escuchar, tu teléfono se conecta directamente a{' '}
            <span className="font-semibold text-foreground">{servidor}</span>, el
            servidor de la emisora que ha elegido tu iglesia, y ese servidor ve tu
            dirección IP como la ve cualquier web que visitas. Hatril no apunta
            quién escucha. Escuchar gasta unos 60 MB por hora; al parar se corta
            la descarga.
          </p>
        </div>
      </Hoja>
    </>
  );
}
