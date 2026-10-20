'use client';

import { useState } from 'react';
import { Play, Square } from 'lucide-react';

import { problemaDeLaSenal, servidorDe } from '@/lib/emisora/config';
import { normalizarEnlace } from '@/lib/repertorio/enlaces';
import { useSenal } from '@/components/radio/use-senal';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * La dirección de la señal, con un «Probar» que suena aquí mismo.
 *
 * SUENA EN ESTE NAVEGADOR, NO EN EL SERVIDOR
 * ------------------------------------------
 * La pregunta «¿esta dirección funciona?» la contesta el navegador de quien la
 * pega, igual que la contestará el de cada oyente. Que la comprobara el servidor
 * sería pedirle a Hatril que visite una URL escrita por un usuario —la puerta
 * de un SSRF— y además no probaría lo que importa: un servidor de radio que
 * contesta a una máquina en Irlanda puede no sonar en un móvil por https.
 *
 * Antes de conectar, la misma validación que la action: si la dirección es http
 * o una lista .m3u, se dice el porqué sin intentar nada.
 */
export function CampoSenal({ valorInicial }: { valorInicial: string }) {
  const [valor, setValor] = useState(valorInicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [probando, setProbando] = useState<string | null>(null);

  const { audio, estado, error, reproducir, parar } = useSenal(null, {
    titulo: 'Prueba de la señal',
    artista: probando ? servidorDe(probando) : '',
  });
  const activo = estado === 'sonando' || estado === 'conectando';

  const probar = () => {
    if (activo) {
      parar();
      return;
    }
    const url = normalizarEnlace(valor);
    const problema = url
      ? problemaDeLaSenal(url)
      : 'Pega primero la dirección de la señal.';
    if (problema || !url) {
      setAviso(problema);
      return;
    }
    setAviso(null);
    setProbando(url);
    reproducir(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="stream_url"
          name="stream_url"
          // `text` y no `url`: el navegador rechazaría «stream.zeno.fm/abc» sin
          // el https delante con un mensaje suyo, y aquí se le pone solo.
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          maxLength={500}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setAviso(null);
            // Lo que suena ya no es lo que pone el campo.
            if (activo) parar();
          }}
          placeholder="https://stream.zeno.fm/…"
          aria-describedby="ayuda-senal"
        />
        <Button type="button" variant="outline" onClick={probar} className="flex-none">
          {activo ? (
            <Square strokeWidth={1.8} fill="currentColor" className="size-4" />
          ) : (
            <Play strokeWidth={1.8} fill="currentColor" className="size-4" />
          )}
          {estado === 'conectando' ? 'Conectando…' : activo ? 'Parar' : 'Probar'}
        </Button>
        {/* Sin `crossOrigin`: ver `use-senal.ts`. */}
        <audio ref={audio} preload="none" />
      </div>

      <p id="ayuda-senal" className="t-label text-muted-foreground">
        La dirección del audio, no la de la página de la emisora: la que suena si
        la abres en el navegador. Tiene que empezar por https://
      </p>

      {(aviso || (estado === 'error' && error)) && <Aviso>{aviso ?? error}</Aviso>}
      {!aviso && estado === 'sonando' && (
        <Aviso tipo="ok">
          Suena. Es lo que oirá tu congregación al darle a escuchar.
          Acuérdate de guardar.
        </Aviso>
      )}
    </div>
  );
}
