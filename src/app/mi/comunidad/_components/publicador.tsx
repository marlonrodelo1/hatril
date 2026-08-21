'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/format/iniciales';
import { publicar } from '../actions';
import { MAX_IMAGENES } from '@/lib/comunidad/limites';

/**
 * Escribir en el muro.
 *
 * ES UN `<form>` DE VERDAD
 * ------------------------
 * Con `action={publicar}`, una server action. Sin `fetch`, sin estado de envío
 * a mano y sin JavaScript para lo esencial: si el navegador tarda en hidratar
 * —un móvil viejo con mala cobertura, que es la mitad de esta congregación— el
 * formulario ya funciona.
 *
 * El JavaScript de este componente solo sirve para comodidades: enseñar las
 * fotos elegidas antes de enviar, poder quitar alguna, y plegar la fila de
 * acciones mientras nadie escribe. Si no llega a cargar, se publica igual.
 *
 * PLEGADO SIN ROMPER ESA PROMESA
 * ------------------------------
 * La fila de «Fotos» y «Publicar» ocupa sitio en la cabecera del muro para algo
 * que la mayoría de las visitas no va a usar. Se pliega hasta que alguien toca
 * el campo de texto — pero con dos cuidados que no son evidentes:
 *
 *   1. **Nace ABIERTA.** `abierto` empieza en `true`, así que el HTML que manda
 *      el servidor ya trae el botón de publicar. Si el JavaScript no llega, el
 *      formulario entero sigue ahí y funciona. Plegarla de salida habría dejado
 *      a ese navegador con un campo de texto y ningún botón para enviarlo.
 *   2. **Se pliega ANTES de pintar**, con un layout effect y no con `useEffect`.
 *      Con el segundo, el navegador alcanza a dibujar la fila y la quita en el
 *      fotograma siguiente: un parpadeo en cada carga del muro. `useLayoutEffect`
 *      no existe en el servidor —React avisa por consola—, de ahí el alias de
 *      abajo, que es el idioma estándar para esto.
 *
 * Y el caso que rompe todas las implementaciones ingenuas: **el diálogo de
 * ficheros del sistema**. Al abrirlo, el foco se va de la página y el `blur`
 * llega con `relatedTarget` a null, indistinguible de «me he ido a otra cosa».
 * Cerrar ahí quitaría la fila justo bajo el dedo, mientras la persona elige la
 * foto. Lo cubre `eligiendo`, más abajo.
 *
 * QUIÉN VE ESTE FORMULARIO
 * ------------------------
 * Lo decide la página, no este componente: si la comunidad está apagada o el
 * rol de quien mira no entra en `comunidad_quien_publica`, no se pinta nada de
 * esto. Aquí solo llega `admiteFotos`, que es la única parte del formulario que
 * se enciende y se apaga por separado.
 */
/**
 * `useLayoutEffect` en cliente, `useEffect` en servidor.
 *
 * React avisa por consola si se usa `useLayoutEffect` durante el render del
 * servidor, donde no puede ejecutarse. Aquí hace falta el de layout —para
 * plegar antes de que el navegador pinte— y el aviso se evita eligiendo el uno
 * o el otro según dónde estemos. Es el idioma habitual para este caso.
 */
const useEfectoDeLayout =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function Publicador({
  nombre,
  admiteFotos,
}: {
  nombre: string;
  /**
   * Fotos apagadas: ni botón ni input. La policy de la `0027` rechaza el INSERT
   * con imágenes, así que ofrecerlo sería un botón que siempre da error. Las que
   * ya estén publicadas se siguen viendo: apagarlas no las borra.
   */
  admiteFotos: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [previas, setPrevias] = useState<{ url: string; nombre: string }[]>([]);

  // Abierto de salida: es lo que se manda desde el servidor, y lo que ve quien
  // no tenga JavaScript. Ver la cabecera.
  const [abierto, setAbierto] = useState(true);
  const [conTexto, setConTexto] = useState(false);

  /**
   * Hay un diálogo de ficheros abierto.
   *
   * `ref` y no estado a propósito: se lee dentro del `onBlur` y no tiene que
   * provocar un render. Si fuera estado, el valor que leería ese manejador sería
   * el del render anterior justo cuando importa.
   */
  const eligiendo = useRef(false);

  useEfectoDeLayout(() => {
    setAbierto(false);
  }, []);

  /**
   * Al volver del diálogo de ficheros se baja la bandera.
   *
   * Va sobre `window` y no sobre el input porque el navegador NO avisa cuando se
   * cancela el diálogo: no hay `change`, no hay `cancel` fiable en todos, y sin
   * esto la bandera se quedaría levantada para siempre y el formulario no se
   * plegaría nunca más. El `focus` de la ventana sí llega en los dos casos, se
   * elija una foto o se cancele.
   */
  useEffect(() => {
    function alVolver() {
      eligiendo.current = false;
    }
    window.addEventListener('focus', alVolver);
    return () => window.removeEventListener('focus', alVolver);
  }, []);

  /**
   * Cerrar solo cuando de verdad se ha ido.
   *
   * Tres guardas, y cada una tapa un caso que se ve enseguida al probarlo:
   *
   *   - Moverse ENTRE controles de dentro —del texto al botón de Fotos— no es
   *     salir. `contains(relatedTarget)` lo distingue; sin esto la fila se cierra
   *     al ir a pulsar el propio botón que se quiere pulsar.
   *   - El diálogo de ficheros manda `relatedTarget` a null, igual que irse a
   *     otra pestaña. `eligiendo` los separa.
   *   - Con algo escrito o con fotos elegidas no se cierra nunca: plegar encima
   *     de un borrador esconde el botón de publicar lo que se acaba de escribir.
   */
  function alSalir(e: React.FocusEvent<HTMLFormElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (eligiendo.current) return;
    if (conTexto || previas.length > 0) return;
    setAbierto(false);
  }

  function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheros = Array.from(e.target.files ?? []);
    // `URL.createObjectURL` y no un `FileReader` con base64: el objeto apunta al
    // fichero que ya está en memoria, así que una foto de 4 MB no se convierte
    // en 5,5 MB de texto dentro del DOM.
    setPrevias(
      ficheros.slice(0, MAX_IMAGENES).map((f) => ({
        url: URL.createObjectURL(f),
        nombre: f.name,
      })),
    );
  }

  function quitarTodas() {
    for (const p of previas) URL.revokeObjectURL(p.url);
    setPrevias([]);
    if (entrada.current) entrada.current.value = '';
  }

  return (
    <form
      ref={formulario}
      action={async (formData) => {
        await publicar(formData);
        formulario.current?.reset();
        quitarTodas();
        setConTexto(false);
        setAbierto(false);
      }}
      onFocusCapture={() => setAbierto(true)}
      onBlur={alSalir}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
          {iniciales(nombre)}
        </span>

        {/*
         * `rows={2}` con `min-h` fijo dejaba una caja de dos líneas ocupando la
         * cabecera del muro aunque nadie fuera a escribir. `field-sizing-content`
         * la deja en una y la hace crecer con el texto.
         *
         * `min-h` se queda como respaldo: `field-sizing` no llega a todos los
         * navegadores todavía, y donde no llegue esto se comporta como antes en
         * vez de quedarse en una caja de una línea con scroll dentro. Y
         * `resize-y` sigue ahí para quien prefiera agrandarla a mano.
         */}
        <textarea
          name="texto"
          rows={1}
          maxLength={3000}
          // `conTexto` y no leer el valor en el `blur`: el borrador tiene que
          // impedir que se pliegue, y saberlo ya en el momento de escribir
          // evita depender del orden en que llegan los eventos.
          onChange={(e) => setConTexto(e.target.value.trim().length > 0)}
          // «con la iglesia» sobra y costaba una línea entera: en un móvil ese
          // texto no cabe de una, y `field-sizing-content` mide el marcador de
          // posición igual que el contenido, así que la caja nacía a dos líneas.
          // Con quién se comparte ya lo dice la cabecera, dos dedos más arriba.
          placeholder="¿Qué quieres compartir?"
          className="min-h-[42px] flex-1 resize-y rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none field-sizing-content focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
      </div>

      {admiteFotos && previas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:pl-12">
          {previas.map((p) => (
            <span
              key={p.url}
              className="relative size-20 overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.nombre}
                className="size-full object-cover"
              />
            </span>
          ))}

          <button
            type="button"
            onClick={quitarTodas}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:bg-background"
          >
            <X className="size-4" strokeWidth={1.8} />
            Quitar
          </button>

          {/*
           * El límite se dice AQUÍ y no en la fila de abajo, y el cambio no es
           * de sitio sino de momento. Antes ponía «hasta 4» de forma fija junto
           * al botón de Fotos: ocupaba sitio siempre, en la fila que menos
           * tiene, para avisar de algo que solo importa cuando ya has elegido.
           *
           * Aquí aparece cuando sirve, y dice cuántas llevas. `alElegir` recorta
           * a `MAX_IMAGENES` en silencio, así que quien seleccione seis ve un
           * «4 de 4» y entiende solo lo que ha pasado — el aviso fijo no se lo
           * explicaba.
           */}
          <span className="text-[12.5px] text-muted-foreground">
            {previas.length} de {MAX_IMAGENES}
          </span>
        </div>
      )}

      {/*
       * `sm:pl-12` y no `pl-12` a secas. Ese sangrado alinea la fila con el
       * textarea, que en una pantalla ancha se lee mejor; en un móvil de 343px
       * son 48 píxeles —el 14% del ancho— regalados a una fila que ya iba justa,
       * y era lo que la dejaba a punto de partirse en dos líneas.
       */}
      <div
        // `hidden` de HTML y no `display:none` por clase: así el botón de
        // publicar sigue siendo parte del formulario para el navegador —se envía
        // igual con Intro— y desaparece de la navegación por tabulador, que es lo
        // correcto para algo que no está a la vista.
        hidden={!abierto}
        className="flex flex-wrap items-center gap-2 sm:pl-12"
      >
        {admiteFotos && (
          <>
            <input
              ref={entrada}
              id="imagenes-publicacion"
              type="file"
              name="imagenes"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={alElegir}
              className="sr-only"
            />

            {/* La etiqueta hace de botón: el input de fichero nativo no se
                puede estilar y su texto lo pone el navegador, en el idioma del
                sistema. */}
            <label
              htmlFor="imagenes-publicacion"
              // Se levanta aquí, en el clic, y NO en el `focus` del input: ese
              // input es `sr-only` y el navegador no siempre lo enfoca al abrir
              // el diálogo desde la etiqueta.
              onPointerDown={() => {
                eligiendo.current = true;
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-alt px-3.5 text-[13.5px] font-semibold text-foreground hover:bg-background"
            >
              <ImagePlus className="size-[17px]" strokeWidth={1.8} />
              Fotos
            </label>
          </>
        )}

        <span className="flex-1" />

        <Button type="submit">Publicar</Button>
      </div>
    </form>
  );
}
