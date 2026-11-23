'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LocateFixed, MapPinOff, Navigation } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { CampoLugar } from '@/components/lugares/campo-lugar';
import { AvisoMapaGoogle, MapaGoogle } from '@/components/lugares/mapa-google';
import { BotonInvitar } from '../../_components/boton-invitar';
import { FilaIglesia, type IglesiaEnLista } from '../../_components/fila-iglesia';

/**
 * «Estoy buscando iglesia»: las que hay cerca, ordenadas por distancia.
 *
 * LA UBICACIÓN NO SALE DEL TELÉFONO
 * ---------------------------------
 * El servidor manda la lista de iglesias con sus coordenadas, que son públicas,
 * y la distancia se calcula aquí. Así lo de «no guardamos tu ubicación» no es
 * una promesa: el servidor nunca la recibe. Y se pide al pulsar el botón,
 * después de explicar para qué, no al abrir la pantalla.
 *
 * O POR UNA DIRECCIÓN (19-nov; con Google desde el 23-nov)
 * --------------------------------------------------------
 * Quien no quiere dar la ubicación, o se la ha negado a la app, escribe una
 * calle, un barrio o una ciudad, elige de las sugerencias de Google y se ordena
 * igual, desde ahí. Antes era OpenStreetMap desde el teléfono, que no
 * encontraba ninguna dirección colombiana con «#». Ahora la dirección pasa por
 * nuestro servidor camino de Google (`lib/lugares/google.ts`) y no se guarda;
 * la ubicación del teléfono sigue sin salir de él.
 *
 * Y EN UN MAPA (23-nov)
 * ---------------------
 * El 30-oct Marlon decidió lista sin mapa; el 23-nov pidió el mapa con pines.
 * La lista sigue siendo lo primero: con pocas iglesias, un mapa sale casi
 * vacío. «Mapa» las pinta junto a quien busca, y no carga nada de Google hasta
 * que se toca (`components/lugares/mapa-google.tsx`). Solo aparece si el
 * servidor tiene la clave del mapa (`mapa` no es null).
 */
type ConUbicacion = IglesiaEnLista & { latitud: number; longitud: number };

const RADIOS = [5, 10, 25, 50] as const;
type Radio = (typeof RADIOS)[number];

type Estado =
  | { paso: 'explicar' }
  | { paso: 'buscando' }
  /** `desde`: la dirección escrita, si no es la ubicación del teléfono. */
  | { paso: 'lista'; lat: number; lng: number; desde?: string }
  | { paso: 'sin-ubicacion' };

/**
 * «Calle, barrio o ciudad», con las sugerencias de Google. Elegir una basta:
 * no hay botón de buscar.
 */
function BuscarPorDireccion({
  desde,
  onLugar,
}: {
  desde: string;
  onLugar: (lugar: { lat: number; lng: number; nombre: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="direccion" className="text-[14px] font-semibold text-foreground">
        O escribe una dirección
      </label>
      {/* Arriba de la lista sale lo que la persona eligió («Calle 45
          #12-30»), no la dirección entera de Google, que se reconoce peor. */}
      <CampoLugar
        desde={desde}
        id="direccion"
        grande
        maxLength={160}
        placeholder="Calle, barrio o ciudad"
        describedBy="direccion-ayuda"
        onElegir={(l) => onLugar({ lat: l.latitud, lng: l.longitud, nombre: l.texto })}
      />
      <p id="direccion-ayuda" className="text-[13px] leading-snug text-muted-foreground">
        Elige una de la lista. La dirección se consulta en Google para situarla;
        Hatril no la guarda.
      </p>
    </div>
  );
}

/** Distancia en kilómetros sobre la esfera (haversine). */
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (g: number) => (g * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CercaDeMi({
  iglesias,
  lugaresDesde = '/api/v1/lugares',
  mapa = null,
}: {
  iglesias: ConUbicacion[];
  /** Las sugerencias de direcciones: la web las pide aquí, la app a hatril.com. */
  lugaresDesde?: string;
  /** El mapa de `/mapa`, o null si el servidor no tiene su clave. */
  mapa?: { desde: string } | null;
}) {
  const [estado, setEstado] = useState<Estado>({ paso: 'explicar' });
  const [radio, setRadio] = useState<Radio>(10);
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista');
  const [elegida, setElegida] = useState<string | null>(null);
  const filaElegida = useRef<HTMLDivElement>(null);

  // Al tocar un pin, su fila sale debajo del mapa, que en un teléfono queda al
  // pie de la pantalla o fuera de ella (se vio a 375 × 812): se lleva a la vista.
  useEffect(() => {
    if (!elegida) return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    filaElegida.current?.scrollIntoView({ block: 'nearest', behavior: quieto ? 'auto' : 'smooth' });
  }, [elegida]);

  // Memorizadas: el mapa vuelve a mandar sus datos al iframe cada vez que
  // cambian, y sin esto cambiarían en cada pintado.
  const lat = estado.paso === 'lista' ? estado.lat : null;
  const lng = estado.paso === 'lista' ? estado.lng : null;
  const yo = useMemo(() => (lat !== null && lng !== null ? { lat, lng } : null), [lat, lng]);
  const cerca = useMemo(
    () =>
      yo
        ? iglesias
            .map((i) => ({ ...i, distancia: distanciaKm(yo.lat, yo.lng, i.latitud, i.longitud) }))
            .filter((i) => i.distancia <= radio)
            .sort((a, b) => a.distancia - b.distancia)
        : [],
    [iglesias, yo, radio],
  );

  function desdeDireccion(lugar: { lat: number; lng: number; nombre: string }) {
    setEstado({ paso: 'lista', lat: lugar.lat, lng: lugar.lng, desde: lugar.nombre });
  }

  function usarUbicacion() {
    if (!('geolocation' in navigator)) return setEstado({ paso: 'sin-ubicacion' });
    setEstado({ paso: 'buscando' });
    navigator.geolocation.getCurrentPosition(
      (p) => setEstado({ paso: 'lista', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setEstado({ paso: 'sin-ubicacion' }),
      // Precisión baja a propósito: para ordenar iglesias por kilómetros sobra
      // la de la antena, y el teléfono responde antes y gasta menos.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }

  if (estado.paso === 'explicar' || estado.paso === 'buscando') {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <LocateFixed className="size-7" strokeWidth={1.8} />
        </span>
        <h1 className="text-balance text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
          Te enseñamos las iglesias cerca de ti
        </h1>
        <ul className="flex flex-col gap-2.5 text-[15.5px] leading-relaxed text-muted-foreground">
          <li>Para eso necesitamos saber dónde estás, solo mientras buscas.</li>
          <li>No guardamos tu ubicación ni la compartimos con ninguna iglesia.</li>
          <li>Si prefieres no darla, escribe una dirección: verás lo mismo.</li>
        </ul>
        <span className="flex-1" />
        <div className="flex flex-col gap-6">
          <Button
            type="button"
            size="lg"
            className="h-[52px] w-full text-[16px]"
            onClick={usarUbicacion}
            disabled={estado.paso === 'buscando'}
          >
            <Navigation strokeWidth={1.8} />
            {estado.paso === 'buscando' ? 'Buscando…' : 'Usar mi ubicación'}
          </Button>
          <BuscarPorDireccion desde={lugaresDesde} onLugar={desdeDireccion} />
          <Link
            href="/buscar/ciudad"
            className="self-center text-[14px] font-semibold text-foreground underline underline-offset-2"
          >
            Ver las iglesias de una ciudad
          </Link>
        </div>
      </div>
    );
  }

  if (estado.paso === 'sin-ubicacion') {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <MapPinOff className="size-7" strokeWidth={1.8} />
        </span>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
          Sin ubicación también funciona
        </h1>
        <p className="text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
          Escribe tu calle, tu barrio o tu ciudad y te enseñamos las más
          cercanas. Si un día quieres usar la ubicación, puedes darle permiso a
          la app desde los ajustes del teléfono.
        </p>
        <BuscarPorDireccion desde={lugaresDesde} onLugar={desdeDireccion} />
        <Link
          href="/buscar/ciudad"
          className="self-center text-[14px] font-semibold text-foreground underline underline-offset-2"
        >
          Ver las iglesias de una ciudad
        </Link>
      </div>
    );
  }

  const siguienteRadio = RADIOS.find((r) => r > radio);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
          {estado.desde ? 'Iglesias cerca de' : 'Iglesias cerca de ti'}
        </h1>
        {estado.desde && (
          <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] text-muted-foreground">
            <span className="font-semibold text-foreground">{estado.desde}</span>
            <button
              type="button"
              onClick={() => setEstado({ paso: 'explicar' })}
              className="cursor-pointer rounded-sm text-[14px] font-semibold text-foreground underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
            >
              Cambiar
            </button>
          </p>
        )}
      </div>

      <div role="radiogroup" aria-label="Distancia" className="flex gap-2">
        {RADIOS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={radio === r}
            onClick={() => setRadio(r)}
            className={
              'h-10 flex-1 cursor-pointer rounded-full border text-[14px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/20 ' +
              (radio === r
                ? 'border-support bg-support text-white'
                : 'border-border bg-surface text-foreground hover:bg-surface-active')
            }
          >
            {r} km
          </button>
        ))}
      </div>

      {cerca.length > 0 ? (
        <>
          <div className="flex min-h-9 items-center justify-between gap-3">
            <p className="text-[14px] text-muted-foreground">
              {vista === 'mapa' && mapa ? 'Toca un pin para verla' : 'Ordenadas por distancia'}
            </p>
            {mapa && <SelectorVista vista={vista} onCambiar={setVista} />}
          </div>
          {vista === 'mapa' && mapa ? (
            <>
              <MapaGoogle
                desde={mapa.desde}
                iglesias={cerca}
                yo={yo}
                elegida={elegida}
                onElegir={setElegida}
                gestos="greedy"
                titulo="Mapa con las iglesias cercanas"
                className="h-[min(56dvh,440px)]"
              />
              <AvisoMapaGoogle />
              {cerca
                .filter((i) => i.slug === elegida)
                .map((i) => (
                  <div
                    key={i.slug}
                    ref={filaElegida}
                    className="overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <FilaIglesia iglesia={i} />
                  </div>
                ))}
            </>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {cerca.map((i) => (
                <FilaIglesia key={i.slug} iglesia={i} />
              ))}
            </div>
          )}
          <Link
            href="/buscar/ciudad"
            className="self-center text-[14px] font-semibold text-foreground underline underline-offset-2"
          >
            Buscar por ciudad
          </Link>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">
            Todavía no hay iglesias de Hatril cerca de ti
          </h2>
          <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Hatril está empezando en tu zona. Busca más lejos o invita a tu
            iglesia: cuando se una, aparecerá aquí.
          </p>
          <div className="flex w-full flex-col gap-2 pt-1">
            <BotonInvitar />
            {siguienteRadio && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setRadio(siguienteRadio)}
              >
                Buscar a {siguienteRadio} km
              </Button>
            )}
            <Link
              href="/buscar/ciudad"
              className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' w-full'}
            >
              Buscar por ciudad
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * «Lista» o «Mapa». Con el mismo dibujo que los radios de arriba, más pequeño:
 * es otra forma de ver lo mismo, no otra búsqueda.
 */
function SelectorVista({
  vista,
  onCambiar,
}: {
  vista: 'lista' | 'mapa';
  onCambiar: (v: 'lista' | 'mapa') => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ver como" className="flex flex-none gap-1.5">
      {(['lista', 'mapa'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={vista === v}
          onClick={() => onCambiar(v)}
          className={
            'h-9 cursor-pointer rounded-full border px-4 text-[14px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/20 ' +
            (vista === v
              ? 'border-support bg-support text-white'
              : 'border-border bg-surface text-foreground hover:bg-surface-active')
          }
        >
          {v === 'lista' ? 'Lista' : 'Mapa'}
        </button>
      ))}
    </div>
  );
}
