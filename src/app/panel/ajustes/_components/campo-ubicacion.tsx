'use client';

import { useState } from 'react';
import { LocateFixed } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Dónde está la iglesia, para que salga en «iglesias cerca de mí».
 *
 * Dos maneras, ninguna con un servicio de fuera: pulsar el botón estando en la
 * iglesia, que usa la ubicación del propio móvil, o pegar las coordenadas que da
 * cualquier mapa al mantener pulsado un sitio («28.4853, -16.3201»). No se
 * geocodifica la dirección: mandarla a un tercero para esto es un servicio más
 * con su cuenta y sus condiciones, y el pastor sabe mejor que nadie dónde está
 * su puerta.
 */
export function CampoUbicacion({ inicial }: { inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const [aviso, setAviso] = useState<string | null>(null);

  function usarAqui() {
    if (!('geolocation' in navigator)) {
      setAviso('Este navegador no da la ubicación. Pega las coordenadas a mano.');
      return;
    }
    setAviso('Buscando…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValor(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
        setAviso('Puesta la de este dispositivo. Guarda los datos para que cuente.');
      },
      () => setAviso('No se pudo saber dónde estás. Pega las coordenadas a mano.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="coordenadas" className="text-[14px] font-semibold">
        Ubicación en el mapa{' '}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="coordenadas"
          name="coordenadas"
          inputMode="decimal"
          maxLength={60}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="28.4853, -16.3201"
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={usarAqui}>
          <LocateFixed strokeWidth={1.8} />
          Usar dónde estoy
        </Button>
      </div>
      <p className="text-[13px] leading-snug text-muted-foreground">
        {aviso ??
          'Para que tu iglesia salga a quien busca «cerca de mí» en la app. Pulsa el botón estando en la iglesia, o copia las coordenadas de un mapa.'}
      </p>
    </div>
  );
}
