'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LocateFixed, MapPinOff, Navigation } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
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
 * SIN MAPA, Y ES UNA DECISIÓN
 * ---------------------------
 * Con las iglesias que hay hoy, un mapa sale vacío casi siempre y además pide
 * un proveedor de teselas con cuenta. Una lista ordenada por distancia
 * responde a la misma pregunta. Decidido por Marlon el 30-oct.
 */
type ConUbicacion = IglesiaEnLista & { latitud: number; longitud: number };

const RADIOS = [5, 10, 25, 50] as const;
type Radio = (typeof RADIOS)[number];

type Estado =
  | { paso: 'explicar' }
  | { paso: 'buscando' }
  | { paso: 'lista'; lat: number; lng: number }
  | { paso: 'sin-ubicacion' };

/** Distancia en kilómetros sobre la esfera (haversine). */
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (g: number) => (g * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CercaDeMi({ iglesias }: { iglesias: ConUbicacion[] }) {
  const [estado, setEstado] = useState<Estado>({ paso: 'explicar' });
  const [radio, setRadio] = useState<Radio>(10);

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
          <li>Si prefieres no darla, busca por ciudad: verás lo mismo.</li>
        </ul>
        <span className="flex-1" />
        <div className="flex flex-col gap-2">
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
          <Link
            href="/buscar/ciudad"
            className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' h-[52px] w-full'}
          >
            Buscar por ciudad
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
          Busca por la ciudad o el municipio donde vives. Si un día quieres
          usarla, puedes darle permiso a la app desde los ajustes del teléfono.
        </p>
        <Link
          href="/buscar/ciudad"
          className={buttonVariants({ size: 'lg' }) + ' h-[52px] w-full'}
        >
          Buscar por ciudad
        </Link>
      </div>
    );
  }

  const cerca = iglesias
    .map((i) => ({ ...i, distancia: distanciaKm(estado.lat, estado.lng, i.latitud, i.longitud) }))
    .filter((i) => i.distancia <= radio)
    .sort((a, b) => a.distancia - b.distancia);

  const siguienteRadio = RADIOS.find((r) => r > radio);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
        Iglesias cerca de ti
      </h1>

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
          <p className="text-[14px] text-muted-foreground">Ordenadas por distancia</p>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {cerca.map((i) => (
              <FilaIglesia key={i.slug} iglesia={i} />
            ))}
          </div>
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
