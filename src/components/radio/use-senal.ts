'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lo que tienen en común los tres reproductores de la radio: el de `/mi`, el de
 * la web pública y el «Probar» del panel.
 *
 * EL `<audio>` LO PINTA QUIEN USA ESTO, Y SIEMPRE ASÍ
 * --------------------------------------------------
 * `<audio ref={audio} preload="none" />`, y nada más:
 *
 *   - `preload="none"`: hasta que alguien pulsa ▶ el navegador no habla con el
 *     servidor de la emisora. Ni un byte, ni la IP del oyente. Es el mismo
 *     criterio que el vídeo del devocional.
 *   - **Sin `crossOrigin`**. Un `<audio src>` de otro dominio suena sin CORS;
 *     con el atributo puesto, el navegador exigiría cabeceras que casi ningún
 *     Icecast manda y la radio no sonaría. Solo haría falta para leer el audio
 *     con Web Audio (un visualizador), que aquí no hay.
 *
 * PARAR ES VACIAR, Y REANUDAR ES VOLVER A CARGAR
 * ----------------------------------------------
 * Un `pause()` a secas deja la conexión abierta y el navegador sigue bajando
 * audio un rato: en un prepago de Colombia eso es dinero, a unos 58 MB por hora
 * a 128 kbps. Así que parar quita el `src`, y reanudar lo vuelve a poner y
 * llama a `load()`. Lo segundo además devuelve al directo: sin recargar, el
 * play seguiría desde el trozo que quedó en el búfer, minutos por detrás.
 *
 * NADA DE ESTO SE CUENTA A NADIE
 * ------------------------------
 * Ningún evento de analítica al pulsar ▶, ni con usuario ni sin él. Que una
 * persona concreta escucha la radio de su iglesia es práctica religiosa —art. 9
 * del RGPD—, y la privacidad promete que no se apunta.
 */

export type EstadoSenal = 'parada' | 'conectando' | 'sonando' | 'error';

export type MetadatosSenal = {
  /** El programa que suena, o el nombre de la emisora si no hay parrilla. */
  titulo: string;
  artista: string;
  album?: string;
  caratula?: string | null;
};

/** Lo que tarda una emisora sana en empezar a sonar, con margen. */
const ESPERA_MAXIMA_MS = 20_000;

export function useSenal(url: string | null, metadatos?: MetadatosSenal) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [estado, setEstado] = useState<EstadoSenal>('parada');
  const [error, setError] = useState<string | null>(null);

  // Lo que se pidió, aparte de lo que el navegador cuenta. Al vaciar el `src`
  // el elemento dispara `pause`, `emptied` y en algunos navegadores `error`, y
  // nada de eso es un fallo: es que alguien pulsó parar.
  const quiereSonar = useRef(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarEspera = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  };

  const vaciar = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    a.pause();
    a.removeAttribute('src');
    a.load();
  }, []);

  const parar = useCallback(() => {
    quiereSonar.current = false;
    limpiarEspera();
    vaciar();
    setEstado('parada');
  }, [vaciar]);

  const fallar = useCallback(
    (mensaje: string) => {
      quiereSonar.current = false;
      limpiarEspera();
      vaciar();
      setError(mensaje);
      setEstado('error');
    },
    [vaciar],
  );

  /**
   * `otra` es para el «Probar» del panel, que no tiene una dirección fija sino
   * la que haya escrita en el campo. Se pasa aquí y no cambiando `url` y
   * esperando a un efecto, porque Safari solo deja sonar si `play()` se llama
   * dentro del mismo clic.
   */
  const reproducir = useCallback((otra?: string) => {
    const a = audio.current;
    const destino = otra ?? url;
    if (!a || !destino) return;

    quiereSonar.current = true;
    setError(null);
    setEstado('conectando');

    a.src = destino;
    a.load();
    a.play().catch((e: unknown) => {
      // `AbortError` es que se pulsó parar antes de que arrancara.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (!quiereSonar.current) return;
      fallar(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'El navegador no ha dejado reproducir. Vuelve a pulsar ▶.'
          : 'No se ha podido conectar con la emisora. Puede que esté fuera del aire, o que la dirección no sea la del audio.',
      );
    });

    // Si a los 20 s no ha llegado `playing` —que es quien quita esta espera—,
    // no va a llegar. Sin mirar `a.paused`: después de `play()` vale `false`
    // aunque no haya sonado nada, y con él esto no saltaba nunca. Hay
    // servidores que contestan a una dirección mala sin cerrar ni dar error, y
    // el botón se quedaba girando para siempre.
    limpiarEspera();
    espera.current = setTimeout(() => {
      if (quiereSonar.current) {
        fallar('La emisora no responde. Puede que esté fuera del aire, o que la dirección no sea la del audio.');
      }
    }, ESPERA_MAXIMA_MS);
  }, [url, fallar]);

  const alternar = useCallback(() => {
    if (quiereSonar.current) parar();
    else reproducir();
  }, [parar, reproducir]);

  // Lo que cuenta el propio `<audio>`.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;

    const alSonar = () => {
      if (!quiereSonar.current) return;
      limpiarEspera();
      setEstado('sonando');
    };
    const alEsperar = () => {
      if (quiereSonar.current) setEstado('conectando');
    };
    const alFallar = () => {
      if (!quiereSonar.current) return;
      fallar(
        'No se ha podido conectar con la emisora. Puede que esté fuera del aire, o que la dirección no sea la del audio.',
      );
    };
    // Pausa que no ha pedido la pantalla: los auriculares que se desconectan,
    // otra app que toma el audio, el botón de la pantalla bloqueada. Se trata
    // como parar, para que la descarga se corte también en ese caso.
    //
    // Salvo que haya terminado. Un directo no termina: si llega al final es que
    // el servidor ha cerrado la conexión, y Chrome lo cuenta con un `pause`
    // antes del `ended`. Tratado como una pausa más, el reproductor volvía a ▶
    // sin decir nada y parecía que se había parado solo.
    const alPausar = () => {
      if (!quiereSonar.current) return;
      if (a.ended) {
        fallar('La emisora ha cortado la señal. Vuelve a pulsar ▶ para reconectar.');
        return;
      }
      parar();
    };

    a.addEventListener('playing', alSonar);
    a.addEventListener('waiting', alEsperar);
    a.addEventListener('error', alFallar);
    a.addEventListener('pause', alPausar);
    return () => {
      a.removeEventListener('playing', alSonar);
      a.removeEventListener('waiting', alEsperar);
      a.removeEventListener('error', alFallar);
      a.removeEventListener('pause', alPausar);
    };
  }, [fallar, parar]);

  // Si cambia la dirección —el panel, al escribir otra— lo que sonaba ya no es
  // lo que hay en pantalla.
  useEffect(() => {
    if (quiereSonar.current) parar();
  }, [url, parar]);

  // Al desmontar, cortar. En `/mi` no pasa al cambiar de pestaña —el layout no
  // se desmonta, y por eso la radio sigue sonando—, sí al salir al panel.
  useEffect(() => {
    const a = audio.current;
    return () => {
      quiereSonar.current = false;
      limpiarEspera();
      if (a) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      }
    };
  }, []);

  // Media Session: el título en la pantalla bloqueada y los botones de los
  // auriculares. Solo mientras suena; parado, se deja limpio para no ocupar los
  // controles del sistema con una radio que no está sonando.
  const { titulo, artista, album, caratula } = metadatos ?? {};
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const sesion = navigator.mediaSession;

    if (estado !== 'sonando' && estado !== 'conectando') {
      sesion.playbackState = 'none';
      return;
    }

    if (titulo && typeof MediaMetadata !== 'undefined') {
      sesion.metadata = new MediaMetadata({
        title: titulo,
        artist: artista ?? '',
        album: album ?? '',
        artwork: caratula ? [{ src: caratula }] : [],
      });
    }
    sesion.playbackState = 'playing';

    const manejadores: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => reproducir()],
      ['pause', () => parar()],
      ['stop', () => parar()],
    ];
    for (const [accion, fn] of manejadores) {
      try {
        sesion.setActionHandler(accion, fn);
      } catch {
        // Un navegador que no conoce `stop` lanza. No es motivo para no sonar.
      }
    }

    return () => {
      for (const [accion] of manejadores) {
        try {
          sesion.setActionHandler(accion, null);
        } catch {
          // Igual que arriba.
        }
      }
    };
  }, [estado, titulo, artista, album, caratula, reproducir, parar]);

  return { audio, estado, error, reproducir, parar, alternar };
}
