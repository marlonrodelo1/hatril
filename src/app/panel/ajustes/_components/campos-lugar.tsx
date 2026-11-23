'use client';

import { useState } from 'react';
import { LocateFixed } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CampoLugar, type LugarElegido } from '@/components/lugares/campo-lugar';

/**
 * La dirección de la iglesia y dónde está en el mapa, juntas.
 *
 * Hasta el 23-nov eran dos campos sin relación: la dirección, texto libre, y
 * las coordenadas, que el pastor ponía pulsando «Usar dónde estoy» estando en
 * la iglesia o pegándolas de un mapa. Casi nadie lo hacía, y sin coordenadas
 * la iglesia no sale en «cerca de mí» ni tiene mapa.
 *
 * Ahora la dirección sugiere con Google mientras se escribe, y al elegir una
 * se ponen solas las coordenadas (y la ciudad, si estaba vacía). Las otras dos
 * maneras siguen: son del pastor, no caducan, y hay sitios que Google no
 * conoce bien.
 *
 * `lugar_id` viaja oculto: el sitio de Google del que salieron las
 * coordenadas, que el cron necesita para refrescarlas antes de los 30 días que
 * Google deja guardarlas (migración `0063`). Si el pastor toca las coordenadas
 * a mano o usa su ubicación, se vacía: esas ya no son de Google.
 */
export function CamposLugar({
  direccion,
  coordenadas,
  lugarId,
  conGoogle,
}: {
  direccion: string;
  coordenadas: string;
  lugarId: string;
  /** Sin la clave de Google en el servidor, la dirección es texto libre. */
  conGoogle: boolean;
}) {
  const [valor, setValor] = useState(coordenadas);
  const [lugar, setLugar] = useState(lugarId);
  const [aviso, setAviso] = useState<string | null>(null);

  function elegido(l: LugarElegido) {
    setValor(`${l.latitud.toFixed(6)}, ${l.longitud.toFixed(6)}`);
    setLugar(l.id);
    // «Ciudad» es un campo suelto del formulario, sin estado de React: se
    // rellena a mano y solo si estaba vacío, para no pisar lo que escribió.
    const ciudad = document.getElementById('ciudad');
    if (ciudad instanceof HTMLInputElement && !ciudad.value.trim() && l.ciudad) {
      ciudad.value = l.ciudad;
    }
    setAviso('Ubicación puesta desde la dirección. Guarda los datos para que cuente.');
  }

  function usarAqui() {
    if (!('geolocation' in navigator)) {
      setAviso('Este navegador no da la ubicación. Pega las coordenadas a mano.');
      return;
    }
    setAviso('Buscando…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValor(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
        setLugar('');
        setAviso('Puesta la de este dispositivo. Guarda los datos para que cuente.');
      },
      () => setAviso('No se pudo saber dónde estás. Pega las coordenadas a mano.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="direccion">
          Dirección
          <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
        </Label>
        {conGoogle ? (
          <CampoLugar
            desde="/api/v1/lugares"
            id="direccion"
            name="direccion"
            defaultValue={direccion}
            placeholder="Empieza a escribir la calle"
            describedBy="direccion-ayuda"
            onElegir={elegido}
          />
        ) : (
          <Input id="direccion" name="direccion" maxLength={240} defaultValue={direccion} />
        )}
        {conGoogle && (
          <p id="direccion-ayuda" className="t-label text-muted-foreground">
            Elige la dirección de la lista y la ubicación en el mapa se pone sola.
          </p>
        )}
      </div>

      <input type="hidden" name="lugar_id" value={lugar} />

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
            onChange={(e) => {
              setValor(e.target.value);
              setLugar('');
            }}
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
            'Para que tu iglesia salga a quien busca «cerca de mí» y tenga mapa en su ficha. Se pone sola al elegir la dirección; también puedes pulsar el botón estando en la iglesia, o pegar las coordenadas de un mapa.'}
        </p>
      </div>
    </div>
  );
}
