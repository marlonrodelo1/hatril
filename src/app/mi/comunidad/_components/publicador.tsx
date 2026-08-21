'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/format/iniciales';
import { publicar } from '../actions';
import { MAX_IMAGENES } from '@/lib/comunidad/limites';
import { Hoja } from './hoja';

/**
 * Escribir en el muro.
 *
 * AHORA SE ABRE EN UNA HOJA, COMO EN CUALQUIER MURO QUE LA GENTE YA USA
 * ---------------------------------------------------------------------
 * Antes el formulario vivía siempre desplegado en la cabecera del muro, y se
 * plegaba a sí mismo cuando nadie lo tocaba. Funcionaba, pero seguía ocupando
 * la primera pantalla con algo que la mayoría de las visitas no va a usar, y
 * escribir tres párrafos en una caja de una línea sobre el muro es incómodo.
 *
 * Ahora hay un disparador —avatar y «¿Qué quieres compartir?»— y el formulario
 * de verdad vive en una hoja que sube desde abajo, con sitio para escribir. Es
 * lo mismo que hacen Instagram y Facebook, y por lo mismo.
 *
 * SIN JAVASCRIPT SIGUE PUBLICÁNDOSE, Y ESA PROMESA NO SE ROMPE
 * ------------------------------------------------------------
 * El HTML que manda el servidor trae el formulario ENTERO y desplegado, igual
 * que antes. Solo después de hidratar se cambia por el disparador. Así, un móvil
 * viejo con mala cobertura —que es media congregación— sigue viendo un
 * formulario que funciona, y no un botón que no hace nada porque su JavaScript
 * no llegó nunca.
 *
 * El cambio se hace con un layout effect y no con `useEffect` por lo mismo que
 * antes se plegaba así: con el segundo, el navegador alcanza a dibujar el
 * formulario largo y lo sustituye en el fotograma siguiente. Un parpadeo en cada
 * carga del muro.
 *
 * EL «+» DE LA BARRA DE ABAJO ABRE ESTA MISMA HOJA, Y POR DOS CAMINOS
 * -------------------------------------------------------------------
 * La barra vive en el layout de `/mi` y este componente en la página, así que no
 * comparten estado: un proveedor de React envolviendo el área del miembro entera
 * para un booleano es demasiada maquinaria. Se resuelve con dos caminos, y hacen
 * falta los dos:
 *
 *   - **Desde otra pestaña** (Agenda, Devocional) el botón es un enlace a
 *     `/mi/comunidad?publicar=1`. Este componente se monta, lee el parámetro y
 *     nace con la hoja abierta.
 *   - **Estando ya en el muro** no hay navegación: el componente no se
 *     desmonta y el parámetro no lo leería nadie. Ahí el botón lanza un evento
 *     del navegador, `hatril:publicar`, y aquí se escucha.
 *
 * Un solo camino no cubre el otro caso, y el segundo se descubre a la primera
 * pulsación estando en el muro: no pasa nada de nada.
 *
 * Y el caso que rompe todas las implementaciones ingenuas: **el diálogo de
 * ficheros del sistema**. Al abrirlo, el foco se va de la página y el `blur`
 * llega con `relatedTarget` a null, indistinguible de «me he ido a otra cosa».
 * Lo cubre `eligiendo`, más abajo.
 *
 * QUIÉN VE ESTE FORMULARIO
 * ------------------------
 * Lo decide la página, no este componente: si la comunidad está apagada o el rol
 * de quien mira no entra en `comunidad_quien_publica`, no se pinta nada de esto.
 * Aquí solo llega `admiteFotos`, que es la única parte del formulario que se
 * enciende y se apaga por separado.
 */

/**
 * `useLayoutEffect` en cliente, `useEffect` en servidor.
 *
 * React avisa por consola si se usa `useLayoutEffect` durante el render del
 * servidor, donde no puede ejecutarse. Aquí hace falta el de layout —para
 * cambiar el formulario por el disparador antes de que el navegador pinte— y el
 * aviso se evita eligiendo uno u otro según dónde estemos. Es el idioma habitual
 * para este caso.
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [hidratado, setHidratado] = useState(false);

  /*
   * `?publicar=1` abre la hoja: es lo que pone el «+» de la barra de abajo
   * cuando se pulsa desde Agenda o Devocional y hay que venir al muro primero.
   *
   * Se lee en el INICIALIZADOR de `useState` y no en un efecto. Un
   * `useEffect(() => setAbierta(true))` es lo primero que sale, y el linter de
   * React lo rechaza con razón: provoca un render en cascada —pinta cerrado y
   * repinta abierto— para un dato que ya se conoce antes del primer render.
   */
  const [abierta, setAbierta] = useState(() => params.get('publicar') === '1');

  useEfectoDeLayout(() => {
    setHidratado(true);
  }, []);

  /*
   * Y cuando el «+» se pulsa estando YA en el muro no hay navegación que
   * provoque nada: este componente no se desmonta, así que el inicializador de
   * arriba no vuelve a correr. Ese caso llega por un evento del navegador.
   *
   * Suscribirse a un evento y llamar a `setState` desde su callback es
   * exactamente el uso para el que existe `useEffect` —sincronizar con un
   * sistema de fuera de React—, al revés que escribir estado en el cuerpo del
   * efecto.
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

  // Antes de hidratar: el formulario entero, como toda la vida. Ver la cabecera.
  if (!hidratado) {
    return <Formulario nombre={nombre} admiteFotos={admiteFotos} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left outline-none hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20 sm:p-4"
      >
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
          {iniciales(nombre)}
        </span>

        {/* Parece un campo pero es un botón: lo que se toca abre la hoja, y un
            campo de verdad aquí haría escribir en el sitio equivocado —y en iOS
            levantaría el teclado sobre una caja de una línea—. */}
        <span className="min-w-0 flex-1 truncate rounded-full bg-surface-alt px-4 py-2.5 text-[15px] text-muted-foreground">
          ¿Qué quieres compartir?
        </span>

        {admiteFotos && (
          <span className="flex size-9 flex-none items-center justify-center rounded-full text-accent">
            <ImagePlus className="size-[19px]" strokeWidth={1.8} />
          </span>
        )}
      </button>

      <Hoja
        abierta={abierta}
        onCambio={cambiarHoja}
        titulo="Nueva publicación"
        descripcion="Escribe lo que quieras compartir con tu congregación."
      >
        <Formulario
          nombre={nombre}
          admiteFotos={admiteFotos}
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
 * El JavaScript de aquí solo sirve para comodidades: enseñar las fotos elegidas
 * antes de enviar y poder quitarlas. Si no llega a cargar, se publica igual.
 */
function Formulario({
  nombre,
  admiteFotos,
  enHoja = false,
  alPublicar,
}: {
  nombre: string;
  admiteFotos: boolean;
  /**
   * Dentro de la hoja el marco sobra —ya lo pone ella— y la caja de texto puede
   * ser grande, que es justo para lo que se abre.
   */
  enHoja?: boolean;
  alPublicar?: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [previas, setPrevias] = useState<{ url: string; nombre: string }[]>([]);

  /**
   * Hay un diálogo de ficheros abierto.
   *
   * `ref` y no estado a propósito: se lee dentro de manejadores que no tienen
   * que provocar un render. Si fuera estado, el valor que leerían sería el del
   * render anterior justo cuando importa.
   */
  const eligiendo = useRef(false);

  /**
   * Al volver del diálogo de ficheros se baja la bandera.
   *
   * Va sobre `window` y no sobre el input porque el navegador NO avisa cuando se
   * cancela el diálogo: no hay `change`, no hay `cancel` fiable en todos, y sin
   * esto la bandera se quedaría levantada para siempre. El `focus` de la ventana
   * sí llega en los dos casos, se elija una foto o se cancele.
   */
  useEffect(() => {
    function alVolver() {
      eligiendo.current = false;
    }
    window.addEventListener('focus', alVolver);
    return () => window.removeEventListener('focus', alVolver);
  }, []);

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
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
            {iniciales(nombre)}
          </span>
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
          // El foco al abrir la hoja, que es lo que se espera al pulsar
          // «¿Qué quieres compartir?». Fuera de la hoja NO: robaría el foco al
          // cargar el muro y levantaría el teclado en el móvil sin pedirlo.
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
            onClick={quitarTodas}
            className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:bg-background"
          >
            <X className="size-4" strokeWidth={1.8} />
            Quitar
          </button>

          {/*
           * El límite se dice AQUÍ y no en la fila de abajo, y el cambio no es
           * de sitio sino de momento: solo importa cuando ya has elegido.
           * `alElegir` recorta a `MAX_IMAGENES` en silencio, así que quien
           * seleccione seis ve un «4 de 4» y entiende solo lo que ha pasado.
           */}
          <span className="text-[12.5px] text-muted-foreground">
            {previas.length} de {MAX_IMAGENES}
          </span>
        </div>
      )}

      <div className={'flex flex-wrap items-center gap-2' + (enHoja ? '' : ' sm:pl-12')}>
        {admiteFotos && (
          <>
            <input
              ref={entrada}
              id={enHoja ? 'imagenes-hoja' : 'imagenes-publicacion'}
              type="file"
              name="imagenes"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={alElegir}
              className="sr-only"
            />

            {/* La etiqueta hace de botón: el input de fichero nativo no se puede
                estilar y su texto lo pone el navegador, en el idioma del
                sistema. */}
            <label
              htmlFor={enHoja ? 'imagenes-hoja' : 'imagenes-publicacion'}
              // Se levanta aquí, en el clic, y NO en el `focus` del input: ese
              // input es `sr-only` y el navegador no siempre lo enfoca al abrir
              // el diálogo desde la etiqueta.
              onPointerDown={() => {
                eligiendo.current = true;
              }}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-alt px-3.5 text-[13.5px] font-semibold text-foreground hover:bg-background"
            >
              <ImagePlus className="size-[17px] text-accent" strokeWidth={1.8} />
              Fotos
            </label>
          </>
        )}

        <span className="flex-1" />

        <Button type="submit" className={enHoja ? 'h-10 px-5' : undefined}>
          Publicar
        </Button>
      </div>
    </form>
  );
}
