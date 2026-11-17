'use client';

import Image from 'next/image';
import { clsx } from 'clsx';
import { Pause, Play } from 'lucide-react';

import { DIAS_PARRILLA, servidorDe, type Programa } from '@/lib/emisora/config';
import { franjaDe } from '@/lib/emisora/parrilla';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { useAhora } from '@/components/radio/use-ahora';
import { useSenal } from '@/components/radio/use-senal';
import { Button } from '@/components/ui/button';
import { Insignia } from '@/components/ui/insignia';
import { useMinuto } from './horarios-reloj';
import { ProgramacionRadio } from './radio-programacion';

/**
 * «Radio en directo» en la web pública de la iglesia.
 *
 * Solo llega aquí si el pastor la marcó para la web y la web está publicada
 * (`radioPublica()`). Lo que se pinta es el nombre, el botón, qué suena y de
 * qué va, y la parrilla; nada de quién presenta.
 *
 * LO QUE SUENA, PRIMERO (zona 3, 17-nov)
 * --------------------------------------
 * La primera línea hablaba del servidor y no se veía qué sonaba. Ahora va la
 * carátula (el logo de la iglesia), el nombre y un play grande, y debajo
 * «Ahora: …» con su franja y una barra que avanza con la hora. Mientras suena,
 * «En directo» late y las barritas se mueven: el mismo punto que en el
 * reproductor de la app.
 *
 * Una tarjeta blanca con borde, como el resto de la página. La primera versión
 * era un bloque carbón con letra blanca, copiado de «Lo próximo» de los
 * horarios: dos bloques oscuros en la misma página competían entre sí, y el de
 * la radio no tenía más motivo para serlo que parecerse al otro.
 *
 * El aviso del servidor sigue SIEMPRE a la vista, no solo antes del primer
 * play como en `/mi`: quien llega a esta página no ha aceptado nada con nadie,
 * y pulsar ▶ es lo que le conecta a un tercero. Lo que cambia es el sitio: al
 * final y en pequeño, para que lo primero que se lea sea qué suena.
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
  // Empiezan en `null` en el servidor y en el primer fotograma: lo que suena
  // depende de la hora, y con ISR la del servidor puede ser de hace horas.
  const { ahora, luego, hoy } = useAhora(parrilla, timezone);
  const instante = useMinuto(null);
  const { audio, estado, error, alternar } = useSenal(streamUrl, {
    titulo: ahora?.nombre ?? nombre,
    artista: nombre,
    album: iglesiaNombre,
    caratula,
  });
  const activo = estado === 'sonando' || estado === 'conectando';
  const sonando = estado === 'sonando';
  const progreso =
    ahora && instante !== null ? progresoDe(ahora, timezone, instante) : null;

  return (
    // En el móvil, uno debajo de otro: la tarjeta, la programación y el aviso
    // del servidor al final. En escritorio la programación va a la derecha, y
    // el aviso sube debajo de la tarjeta: al final de la columna larga quedaba
    // suelto, lejos del play al que se refiere.
    <div className="grid gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-4">
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-5">
          {/* Sin `crossOrigin` y con `preload="none"`: ver `use-senal.ts`. */}
          <audio ref={audio} preload="none" />

          <div className="flex items-center gap-3 md:gap-4">
            <Caratula url={caratula} nombre={iglesiaNombre} />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-subtitle font-bold tracking-[-0.015em]">
                {nombre}
              </span>
              {/* `aria-live`: quien no ve el botón oye que ha conectado. */}
              <span
                aria-live="polite"
                className="flex h-[22px] items-center text-label text-muted-foreground"
              >
                {sonando ? (
                  // El único punto que late en la página: lo que está en
                  // directo, y solo mientras suena.
                  <Insignia tono="peligro" vivo>
                    En directo
                  </Insignia>
                ) : estado === 'conectando' ? (
                  'Conectando…'
                ) : (
                  'Pulsa para escuchar'
                )}
              </span>
            </div>

            {/* Carbón y no naranja: el naranja de esta página es una acción
                de la cabecera, y tiene que haber uno solo. */}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => alternar()}
              aria-label={activo ? `Parar ${nombre}` : `Escuchar ${nombre} en directo`}
              className="size-13 flex-none rounded-full md:size-14"
            >
              {activo ? (
                <Pause className="size-6" strokeWidth={1.8} fill="currentColor" />
              ) : (
                <Play className="ml-0.5 size-6" strokeWidth={1.8} fill="currentColor" />
              )}
            </Button>
          </div>

          {ahora ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <BarrasDirecto sonando={sonando} />
                <span className="min-w-0 flex-1 truncate text-body font-semibold">
                  Ahora: {ahora.nombre}
                </span>
                <span className="flex-none text-label tabular-nums text-muted-foreground">
                  {franjaDe(ahora)}
                </span>
              </div>
              {/* Lo que lleva el programa, con el reloj de la iglesia. Se
                  calla para el lector: la franja ya lo dice en texto. */}
              <div aria-hidden className="h-1 overflow-hidden rounded-full bg-surface-active">
                <span
                  className="block h-full rounded-full bg-foreground transition-[width] duration-360 ease-hatril motion-reduce:transition-none"
                  style={{ width: `${Math.round((progreso ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          ) : luego ? (
            <p className="text-label text-muted-foreground">
              Ahora no hay programa. Luego: {luego.programa.nombre}, {luego.cuando}.
            </p>
          ) : null}
        </div>

        {estado === 'error' && error && <Aviso>{error}</Aviso>}
      </div>

      {parrilla.length > 0 && hoy && (
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <ProgramacionRadio parrilla={parrilla} hoy={hoy} ahora={ahora} />
        </div>
      )}

      <p className="max-w-[62ch] self-start px-1 text-pretty text-label leading-relaxed text-muted-foreground lg:col-start-1 lg:row-start-2">
        Al darle al play te conectas a {servidorDe(streamUrl)}, el servidor de la
        emisora. Esta web no apunta quién escucha.
      </p>
    </div>
  );
}

/** El logo de la iglesia; si no lo ha subido, sus iniciales. Nunca un hueco. */
function Caratula({ url, nombre }: { url: string | null; nombre: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={56}
        height={56}
        className="size-14 flex-none rounded-lg border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-14 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-subtitle font-bold text-muted-foreground"
    >
      {iniciales(nombre)}
    </span>
  );
}

/**
 * Las tres barritas de «está sonando». Quietas y bajas cuando no suena; con
 * «reducir movimiento», quietas a distintas alturas mientras suena, para que
 * se siga leyendo como un ecualizador.
 *
 * La animación es `portada-ecualizador`, la de las barras de la portada
 * (`globals.css`), y solo dentro de `motion-safe`. La altura de reposo va en
 * `style`: una animación pisa al `transform` en línea mientras dura, y al
 * pararla vuelve a él.
 */
const BARRAS = [
  { quieta: 0.55, retraso: 0 },
  { quieta: 1, retraso: -300 },
  { quieta: 0.75, retraso: -600 },
] as const;

function BarrasDirecto({ sonando }: { sonando: boolean }) {
  return (
    <span aria-hidden className="inline-flex h-3.5 flex-none items-end gap-0.5">
      {BARRAS.map((b, i) => (
        <span
          key={i}
          className={clsx(
            'h-full w-[3px] origin-bottom rounded-full bg-danger',
            sonando && 'motion-safe:animate-[portada-ecualizador_900ms_ease-in-out_infinite]',
          )}
          style={{
            transform: `scaleY(${sonando ? b.quieta : 0.3})`,
            animationDelay: `${b.retraso}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Qué parte del programa ha pasado, de 0 a 1, en la hora de la iglesia.
 *
 * Es la cuenta de `ahoraYLuego()` (`lib/emisora/parrilla.ts`), en minutos
 * desde el lunes a las 00:00 para que un programa que cruza la medianoche del
 * domingo no sea un caso aparte; allí no se exporta. `useAhora` recalcula cada
 * medio minuto y esto cada minuto: en el cambio de programa puede ir unos
 * segundos por delante, y por eso se recorta a 1.
 */
const MINUTOS_SEMANA = 7 * 24 * 60;

function progresoDe(p: Programa, timezone: string, instante: number): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instante));
  const buscar = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '';

  const dia = Math.max(
    0,
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(buscar('weekday')),
  );
  const ahora = dia * 1440 + Number(buscar('hour')) * 60 + Number(buscar('minute'));

  const [h, m] = p.hora.split(':').map(Number);
  const inicio = DIAS_PARRILLA.indexOf(p.dia) * 1440 + (h ?? 0) * 60 + (m ?? 0);
  const lleva = (ahora - inicio + MINUTOS_SEMANA) % MINUTOS_SEMANA;
  // Si este reloj va un instante por detrás del de `useAhora` justo cuando
  // empieza el programa, la resta da la vuelta a la semana: es que no ha
  // empezado todavía, no que haya terminado.
  if (lleva > MINUTOS_SEMANA / 2) return 0;

  return Math.min(1, Math.max(0, lleva / p.duracion_min));
}
