'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AvatarPersona } from '@/components/avatar-persona';
import { publicar } from '../actions';
import { MAX_IMAGENES } from '@/lib/comunidad/limites';
import { Hoja } from './hoja';

/**
 * Escribir en el muro.
 *
 * SE ABRE EN UNA HOJA, COMO EN CUALQUIER MURO QUE LA GENTE YA USA
 * ---------------------------------------------------------------
 * Antes el formulario vivía siempre desplegado en la cabecera del muro y se
 * plegaba a sí mismo cuando nadie lo tocaba. Funcionaba, pero ocupaba la primera
 * pantalla con algo que la mayoría de las visitas no va a usar, y escribir tres
 * párrafos en una caja de una línea es incómodo.
 *
 * Ahora hay un disparador —avatar, «¿Qué quieres compartir?» y el icono de la
 * foto— y el formulario de verdad vive en una hoja que sube desde abajo.
 *
 * LA FOTO ABRE LA GALERÍA DIRECTAMENTE, SIN PASAR POR LA HOJA
 * -----------------------------------------------------------
 * Es el flujo de Instagram: se toca la foto y sale el carrete, no una pantalla
 * intermedia donde hay que volver a decir «fotos». Y eso obliga a una cosa que
 * no es evidente: **el `<input type="file">` no puede vivir dentro de la hoja**.
 *
 * El navegador solo abre el diálogo de ficheros dentro del gesto que lo pide, y
 * en ese instante la hoja todavía no está montada — así que un input de dentro
 * no existe para el dedo que acaba de tocar. Por eso el input vive aquí fuera,
 * al lado del disparador, y se asocia al formulario con el atributo `form`:
 * HTML permite que un control esté fuera de su formulario si lleva el id de
 * este. Con eso, el fichero elegido viaja en el `FormData` igual que si
 * estuviera dentro, también sin JavaScript.
 *
 * SIN JAVASCRIPT SIGUE PUBLICÁNDOSE, Y ESA PROMESA NO SE ROMPE
 * ------------------------------------------------------------
 * El HTML que manda el servidor trae el formulario ENTERO y desplegado. Solo
 * después de hidratar se cambia por el disparador. Así, un móvil viejo con mala
 * cobertura —que es media congregación— sigue viendo un formulario que funciona,
 * y no un botón que no hace nada porque su JavaScript no llegó nunca.
 *
 * El cambio se hace con un layout effect y no con `useEffect`: con el segundo,
 * el navegador alcanza a dibujar el formulario largo y lo sustituye en el
 * fotograma siguiente. Un parpadeo en cada carga del muro.
 *
 * TAMBIÉN SE ABRE DESDE FUERA
 * ---------------------------
 * Con `?publicar=1` en la URL, que es lo que usa cualquier enlace que quiera
 * traer a alguien a escribir, y con el evento `hatril:publicar` para quien ya
 * está en esta pantalla y no provocaría ninguna navegación.
 *
 * QUIÉN VE ESTE FORMULARIO
 * ------------------------
 * Lo decide la página, no este componente: si la comunidad está apagada o el rol
 * de quien mira no entra en `comunidad_quien_publica`, no se pinta nada de esto.
 * Aquí solo llega `admiteFotos`, que es la única parte que se enciende y se
 * apaga por separado.
 */

/**
 * Los dos ids que atan el input de ficheros con el formulario de la hoja.
 *
 * Constantes y no generados con `useId()` a propósito: el formulario se
 * renderiza dentro de un portal y el input fuera, así que los dos tienen que
 * coincidir en un valor que no dependa del árbol. Solo hay un publicador por
 * pantalla.
 */
const ID_FORM = 'form-publicar';
const ID_FOTOS = 'fotos-publicacion';

/**
 * `useLayoutEffect` en cliente, `useEffect` en servidor.
 *
 * React avisa por consola si se usa `useLayoutEffect` durante el render del
 * servidor, donde no puede ejecutarse. Aquí hace falta el de layout —para
 * cambiar el formulario por el disparador antes de que el navegador pinte— y el
 * aviso se evita eligiendo uno u otro según dónde estemos.
 */
const useEfectoDeLayout =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Previa = { url: string; nombre: string };

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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [hidratado, setHidratado] = useState(false);
  const [previas, setPrevias] = useState<Previa[]>([]);
  const entrada = useRef<HTMLInputElement>(null);

  /*
   * `?publicar=1` abre la hoja. Se lee en el INICIALIZADOR de `useState` y no en
   * un efecto: un `useEffect(() => setAbierta(true))` es lo primero que sale, y
   * el linter de React lo rechaza con razón —provoca un render en cascada para
   * un dato que ya se conoce antes del primer render—.
   */
  const [abierta, setAbierta] = useState(() => params.get('publicar') === '1');

  useEfectoDeLayout(() => {
    setHidratado(true);
  }, []);

  /*
   * Y para quien ya está en esta pantalla no hay navegación que monte nada: el
   * componente no se desmonta y el parámetro no lo leería nadie. Ese caso llega
   * por un evento del navegador.
   *
   * Suscribirse a un evento y llamar a `setState` desde su callback es
   * exactamente el uso para el que existe `useEffect`, al revés que escribir
   * estado en el cuerpo del efecto.
   */
  useEffect(() => {
    function abrir() {
      setAbierta(true);
    }
    window.addEventListener('hatril:publicar', abrir);
    return () => window.removeEventListener('hatril:publicar', abrir);
  }, []);

  /**
   * Cerrar limpia el `?publicar=1` de la barra de direcciones.
   *
   * Con `replace` y no `push`: si se quedara puesto, darle a «atrás» volvería a
   * abrir el compositor, y compartir el enlace del muro se lo abriría a quien lo
   * reciba. `scroll: false` porque el muro no tiene por qué saltar arriba solo
   * porque se ha cerrado una hoja.
   */
  function cambiarHoja(v: boolean) {
    setAbierta(v);
    if (!v && params.get('publicar') === '1') {
      router.replace(pathname, { scroll: false });
    }
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

    // Elegir una foto ES querer publicar: se abre la hoja sola, con la foto ya
    // puesta. Pedir un toque más para escribir el texto sería devolver a la
    // persona al punto de partida.
    if (ficheros.length > 0) setAbierta(true);
  }

  function quitarTodas() {
    for (const p of previas) URL.revokeObjectURL(p.url);
    setPrevias([]);
    if (entrada.current) entrada.current.value = '';
  }

  /*
   * El input vive FUERA de la hoja y del formulario, y se ata a este por el
   * atributo `form`. Ver la cabecera: es lo que permite que la galería se abra
   * en el mismo gesto que la toca.
   */
  const inputFicheros = admiteFotos ? (
    <input
      ref={entrada}
      id={ID_FOTOS}
      form={ID_FORM}
      type="file"
      name="imagenes"
      multiple
      accept="image/jpeg,image/png,image/webp"
      onChange={alElegir}
      className="sr-only"
    />
  ) : null;

  // Antes de hidratar: el formulario entero, como toda la vida. Ver la cabecera.
  if (!hidratado) {
    return (
      <>
        {inputFicheros}
        <Formulario
          nombre={nombre}
          admiteFotos={admiteFotos}
          previas={previas}
          onQuitar={quitarTodas}
        />
      </>
    );
  }

  return (
    <>
      {inputFicheros}

      {/*
       * DOS controles, no uno. El disparador era un `<button>` con el icono de
       * la foto dentro, y un botón dentro de otro botón no es HTML válido: el
       * navegador lo desarma y el de dentro deja de responder.
       */}
      <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface p-2 sm:p-2.5">
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <AvatarPersona nombre={nombre} />

          {/* Parece un campo pero es un botón: un campo de verdad aquí haría
              escribir en el sitio equivocado —y en iOS levantaría el teclado
              sobre una caja de una línea—. */}
          <span className="min-w-0 flex-1 truncate rounded-full bg-surface-alt px-4 py-2.5 text-[15px] text-muted-foreground">
            ¿Qué quieres compartir?
          </span>
        </button>

        {admiteFotos && (
          <label
            htmlFor={ID_FOTOS}
            aria-label="Subir una foto"
            className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-lg text-accent outline-none hover:bg-accent/10 focus-within:ring-3 focus-within:ring-ring/20"
          >
            <ImagePlus className="size-[21px]" strokeWidth={1.8} />
          </label>
        )}
      </div>

      <Hoja
        abierta={abierta}
        onCambio={cambiarHoja}
        titulo="Nueva publicación"
        descripcion="Escribe lo que quieras compartir con tu congregación."
      >
        <Formulario
          nombre={nombre}
          admiteFotos={admiteFotos}
          previas={previas}
          onQuitar={quitarTodas}
          enHoja
          alPublicar={() => setAbierta(false)}
        />
      </Hoja>
    </>
  );
}

/**
 * El formulario de verdad.
 *
 * ES UN `<form>` DE VERDAD
 * ------------------------
 * Con `action={publicar}`, una server action. Sin `fetch`, sin estado de envío a
 * mano y sin JavaScript para lo esencial.
 *
 * No lleva el input de ficheros dentro: vive en `Publicador` y se ata por el
 * atributo `form`. El porqué está en la cabecera del fichero.
 */
function Formulario({
  nombre,
  admiteFotos,
  previas,
  onQuitar,
  enHoja = false,
  alPublicar,
}: {
  nombre: string;
  admiteFotos: boolean;
  previas: Previa[];
  onQuitar: () => void;
  /**
   * Dentro de la hoja el marco sobra —ya lo pone ella— y la caja de texto puede
   * ser grande, que es justo para lo que se abre.
   */
  enHoja?: boolean;
  alPublicar?: () => void;
}) {
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <form
      id={ID_FORM}
      ref={formulario}
      action={async (formData) => {
        await publicar(formData);
        formulario.current?.reset();
        onQuitar();
        alPublicar?.();
      }}
      className={
        enHoja
          ? 'flex flex-col gap-3'
          : 'flex flex-col gap-3 rounded-xl border border-border bg-surface p-4'
      }
    >
      <div className="flex gap-3">
        {!enHoja && (
          <AvatarPersona nombre={nombre} />
        )}

        {/*
         * `field-sizing-content` la deja en una línea y la hace crecer con el
         * texto. `min-h` se queda como respaldo: no llega a todos los
         * navegadores todavía, y donde no llegue esto se comporta como antes en
         * vez de quedarse en una caja de una línea con scroll dentro.
         *
         * Dentro de la hoja nace con cuatro líneas de alto: se ha abierto para
         * escribir, y ofrecer un renglón sería pedir que se escriba mirando por
         * una rendija.
         */}
        <textarea
          name="texto"
          rows={enHoja ? 4 : 1}
          maxLength={3000}
          // El foco al abrir la hoja, que es lo que se espera al pulsar «¿Qué
          // quieres compartir?». Fuera de la hoja NO: robaría el foco al cargar
          // el muro y levantaría el teclado en el móvil sin pedirlo.
          autoFocus={enHoja}
          placeholder="¿Qué quieres compartir?"
          className={
            'flex-1 resize-y rounded-lg border border-input bg-surface-alt px-3 py-2.5 leading-relaxed outline-none field-sizing-content focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 ' +
            (enHoja ? 'min-h-[112px]' : 'min-h-[42px]')
          }
        />
      </div>

      {admiteFotos && previas.length > 0 && (
        <div className={'flex flex-wrap items-center gap-2' + (enHoja ? '' : ' sm:pl-12')}>
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
            onClick={onQuitar}
            className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:bg-background"
          >
            <X className="size-4" strokeWidth={1.8} />
            Quitar
          </button>

          {/*
           * El límite se dice AQUÍ y no junto al botón de fotos, y el cambio no
           * es de sitio sino de momento: solo importa cuando ya has elegido.
           * `alElegir` recorta la vista previa a `MAX_IMAGENES`, y si de verdad
           * viajan más, la action lo dice con su propio mensaje.
           */}
          <span className="text-[12.5px] text-muted-foreground">
            {previas.length} de {MAX_IMAGENES}
          </span>
        </div>
      )}

      <div className={'flex flex-wrap items-center gap-2' + (enHoja ? '' : ' sm:pl-12')}>
        {admiteFotos && (
          /* La etiqueta hace de botón: el input de fichero nativo no se puede
             estilar y su texto lo pone el navegador, en el idioma del sistema.
             Apunta al input que vive fuera, en `Publicador`. */
          <label
            htmlFor={ID_FOTOS}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-alt px-3.5 text-[13.5px] font-semibold text-foreground hover:bg-background"
          >
            <ImagePlus className="size-[17px] text-accent" strokeWidth={1.8} />
            Fotos
          </label>
        )}

        <span className="flex-1" />

        <Button type="submit" className={enHoja ? 'h-10 px-5' : undefined}>
          Publicar
        </Button>
      </div>
    </form>
  );
}
