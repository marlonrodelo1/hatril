'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Heart } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * El corazón de una publicación o de un comentario.
 *
 * VA DENTRO DE UN `<form>` QUE PONE QUIEN LO USA, CON SU SERVER ACTION
 * --------------------------------------------------------------------
 * El formulario y la acción siguen siendo los de siempre —`alternarMeGusta` o
 * `alternarMeGustaComentario`, atadas a su id—, así que el corazón funciona
 * igual sin JavaScript: el HTML del servidor trae el `<form>` y el botón de
 * enviar. Lo único que hace esta pieza de cliente es pintar mientras viaja.
 *
 * LO QUE SE VE ANTES DE QUE CONTESTE EL SERVIDOR
 * ----------------------------------------------
 * `useFormStatus` dice si el formulario que lo contiene está enviando. Mientras
 * lo está, se pinta ya el estado contrario y la cifra con uno más o uno menos.
 * Sin eso, el corazón tardaba lo que tarda la ida y vuelta en rellenarse, y en
 * un móvil con mala cobertura parecía que no se había pulsado —y se pulsaba
 * otra vez, que lo quitaba—.
 *
 * No hace falta `useOptimistic`: la action termina con `revalidatePath`, y Next
 * trae el muro nuevo en la misma respuesta. Cuando `pending` vuelve a `false`,
 * las props ya traen lo que dice la base, y si alguien más ha dado me gusta a
 * la vez, la cifra se corrige sola.
 *
 * Mientras viaja, `pointer-events-none`: dos toques seguidos serían poner y
 * quitar, y el segundo llegaría cuando la pantalla ya dice que está puesto.
 *
 * EL LATIDO Y LA CIFRA QUE RUEDA
 * ------------------------------
 * El latido es `anim-salta` de `globals.css` sobre el icono, que ya se queda
 * quieto con «reducir movimiento». Solo al DAR el me gusta: al quitarlo no hay
 * nada que celebrar. La `key` que cambia en cada toque vuelve a montar el
 * icono, que es lo que hace que la animación empiece de nuevo.
 *
 * La cifra entra desde abajo cuando sube y desde arriba cuando baja, recortada
 * por su propia caja, como un contador. Solo después del primer toque: sin esa
 * guarda, las treinta cifras del muro entrarían a la vez al cargar la pantalla.
 */
export function BotonMeGusta({
  dado,
  cuenta,
  pequeno = false,
}: {
  dado: boolean;
  cuenta: number;
  /** En un comentario, más bajo y con el icono más pequeño. */
  pequeno?: boolean;
}) {
  const { pending } = useFormStatus();
  const [latidos, setLatidos] = useState(0);
  const [tocado, setTocado] = useState(false);

  const mostrado = pending ? !dado : dado;
  const cifra = pending ? Math.max(0, cuenta + (dado ? -1 : 1)) : cuenta;

  return (
    <button
      type="submit"
      onClick={() => {
        setTocado(true);
        if (!mostrado) setLatidos((n) => n + 1);
      }}
      aria-pressed={mostrado}
      aria-busy={pending || undefined}
      aria-label={mostrado ? 'Quitar el me gusta' : 'Me gusta'}
      className={clsx(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-label font-semibold outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
        pequeno ? 'h-7 px-2' : 'h-9 px-2.5',
        pending && 'pointer-events-none',
        // El rojo de siempre para el que ya está dado, y relleno además de
        // color: quien no distingue el rojo tiene que poder ver que ya le ha
        // dado.
        mostrado
          ? 'text-danger hover:bg-badge-danger-bg'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Heart
        key={latidos}
        aria-hidden
        strokeWidth={1.8}
        fill={mostrado ? 'currentColor' : 'none'}
        className={clsx(
          pequeno ? 'size-[15px]' : 'size-[18px]',
          latidos > 0 && mostrado && 'anim-salta',
        )}
      />
      <span className="inline-flex overflow-hidden">
        <span
          key={cifra}
          className={clsx(
            'tabular-nums',
            tocado &&
              'animate-in fade-in-0 duration-240 ease-hatril motion-reduce:animate-none',
            tocado && (mostrado ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'),
          )}
        >
          {cifra > 0 ? cifra : 'Me gusta'}
        </span>
      </span>
    </button>
  );
}
