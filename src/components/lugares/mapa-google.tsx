'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Map as IconoMapa, MapPinOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/format/iniciales';

/**
 * El mapa de Google, en el iframe de `/mapa` (por qué en un iframe, en
 * `lib/lugares/mapa.ts`). Lo usan la web y la app con el mismo código; solo
 * cambia `desde`: `/mapa` en la web y `https://hatril.com/mapa` en la app.
 *
 * Los datos van por `postMessage` y no en la dirección del iframe: en «cerca de
 * mí» van dónde está quien busca, y así esa ubicación no llega a nuestro
 * servidor ni a sus registros. Se mandan al cargar el iframe y cada vez que
 * cambian, siempre al origen exacto del mapa.
 */
export type PuntoIglesia = {
  slug: string;
  nombre: string;
  latitud: number;
  longitud: number;
  /** El pin es el logo; sin él, las iniciales (lo pidió Marlon el 23-nov). */
  logoUrl?: string | null;
};

function origenDe(desde: string): string {
  try {
    return new URL(desde, window.location.href).origin;
  } catch {
    return '';
  }
}

export function MapaGoogle({
  desde,
  iglesias,
  yo = null,
  elegida = null,
  onElegir,
  gestos = 'cooperative',
  titulo,
  className,
}: {
  desde: string;
  iglesias: PuntoIglesia[];
  /** Dónde está quien mira, en «cerca». Se pinta, no viaja a ningún servidor. */
  yo?: { lat: number; lng: number } | null;
  elegida?: string | null;
  onElegir?: (slug: string) => void;
  /**
   * `greedy` cuando el mapa es la pantalla (cerca): se mueve con un dedo.
   * `cooperative` cuando va dentro de una página que se desplaza (la ficha):
   * con un dedo se desplaza la página, con dos el mapa.
   */
  gestos?: 'greedy' | 'cooperative';
  /** Lo que lee un lector de pantalla al llegar al iframe. */
  titulo: string;
  className?: string;
}) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [fallo, setFallo] = useState(false);

  const mensaje = useMemo(
    () => ({
      hatrilMapa: 1,
      tipo: 'pintar',
      iglesias: iglesias.map((i) => ({
        slug: i.slug,
        nombre: i.nombre,
        lat: i.latitud,
        lng: i.longitud,
        logo: i.logoUrl ?? null,
        iniciales: iniciales(i.nombre),
      })),
      yo,
      gestos,
      elegida,
    }),
    [iglesias, yo, gestos, elegida],
  );

  const enviar = useCallback(() => {
    const origen = origenDe(desde);
    if (origen) marco.current?.contentWindow?.postMessage(mensaje, origen);
  }, [desde, mensaje]);

  // Cada vez que cambian los datos. Antes de que cargue el iframe el mensaje
  // se pierde, y no pasa nada: `onLoad` lo vuelve a mandar.
  useEffect(() => enviar(), [enviar]);

  useEffect(() => {
    const origen = origenDe(desde);
    function alRecibir(e: MessageEvent) {
      if (e.source !== marco.current?.contentWindow || e.origin !== origen) return;
      const d = e.data as { hatrilMapa?: number; tipo?: string; slug?: unknown };
      if (d?.hatrilMapa !== 1) return;
      if (d.tipo === 'elegida' && typeof d.slug === 'string') onElegir?.(d.slug);
      if (d.tipo === 'error') setFallo(true);
    }
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, [desde, onElegir]);

  return (
    <div className={clsx('relative overflow-hidden rounded-xl border border-border bg-background', className)}>
      <iframe
        ref={marco}
        src={desde}
        title={titulo}
        onLoad={enviar}
        className="absolute inset-0 size-full border-0"
      />
      {fallo && (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 border-t border-border bg-surface px-3 py-2 text-[13px] text-danger"
        >
          <MapPinOff aria-hidden className="size-4 flex-none" strokeWidth={1.8} />
          No se ha podido cargar el mapa.
        </p>
      )}
    </div>
  );
}

/** Lo que se dice al lado de cualquier mapa: es de Google, y qué le llega. */
export function AvisoMapaGoogle({ className }: { className?: string }) {
  return (
    <p className={clsx('text-[12.5px] leading-snug text-muted-foreground', className)}>
      El mapa es de Google: al abrirlo, Google recibe tu conexión.
    </p>
  );
}

/**
 * Un mapa que no se carga hasta que se toca «Ver en el mapa». Para la ficha de
 * una iglesia: un solo pin, y la página se sigue desplazando con un dedo.
 */
export function MapaAlTocar({
  desde,
  iglesia,
  className,
}: {
  desde: string;
  iglesia: PuntoIglesia;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <div className={clsx('flex flex-col gap-1.5', className)}>
        <Button type="button" variant="outline" className="w-full" onClick={() => setAbierto(true)}>
          <IconoMapa strokeWidth={1.8} aria-hidden />
          Ver en el mapa
        </Button>
        <AvisoMapaGoogle />
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <MapaGoogle
        desde={desde}
        iglesias={[iglesia]}
        titulo={`Mapa con la ubicación de ${iglesia.nombre}`}
        className="h-[220px]"
      />
      <AvisoMapaGoogle />
    </div>
  );
}
