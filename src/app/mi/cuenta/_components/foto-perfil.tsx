'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { clsx } from 'clsx';

import { AvatarPersona } from '@/components/avatar-persona';
import { quitarFoto, subirFoto } from '../actions';

/**
 * La cabeza de Mi cuenta: la cara, el nombre y el correo.
 *
 * LA CARA ES EL BOTÓN
 * -------------------
 * El `<label>` envuelve la foto entera y la cámara de la esquina: se toca la
 * cara y se elige otra, como en los ajustes de cualquier móvil. La cámara es
 * la pista de que se puede; el sitio que se toca es todo el círculo, que en un
 * pulgar acierta mejor que los 28 px de la cámara sola.
 *
 * Elegir la foto ya es enviarla: el formulario se manda solo al cambiar el
 * fichero. Un segundo botón de «Guardar» después de elegirla es un paso que en
 * el móvil se olvida, y la foto se quedaría sin subir sin que nadie lo note.
 */
export function FotoPerfil({
  nombre,
  correo,
  foto,
}: {
  nombre: string;
  correo: string;
  foto: string | null;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  return (
    <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
      <form ref={formulario} action={subirFoto} className="flex-none">
        <label
          className={clsx(
            'group relative block cursor-pointer rounded-full outline-none focus-within:ring-3 focus-within:ring-ring/20',
            // La cara de la cuenta, más grande que la de una fila: 56 px y no
            // los 44 del `lg`, que con la cámara encima quedaba tapada.
            // `AvatarPersona` no tiene ese tamaño y no es de esta pantalla
            // dárselo; se agranda desde aquí, que gana por especificidad.
            '[&>span:first-child]:size-14 [&>span:first-child]:text-body',
            subiendo && 'pointer-events-none',
          )}
        >
          <AvatarPersona nombre={nombre} fotoUrl={foto} tamano="lg" />
          {subiendo && (
            // Encima de la foto, el velo de todas las hojas y el giro en
            // blanco: es el único sitio donde el blanco vale, sobre una foto.
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-velo">
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground motion-reduce:animate-none" />
            </span>
          )}
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-support text-secondary-foreground transition-colors duration-150 group-hover:bg-support-hover"
          >
            <Camera className="size-3.5" strokeWidth={1.8} />
          </span>
          <span className="sr-only">
            {subiendo ? 'Subiendo la foto…' : foto ? 'Cambiar la foto' : 'Añadir una foto'}
          </span>
          <input
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              if (!e.target.files?.length) return;
              setSubiendo(true);
              formulario.current?.requestSubmit();
            }}
          />
        </label>
      </form>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-subtitulo truncate">{nombre}</span>
        <span className="truncate text-label text-muted-foreground">{correo}</span>
        {foto && (
          <form action={quitarFoto} className="mt-1">
            <button
              type="submit"
              className="cursor-pointer rounded-lg text-label font-semibold text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
            >
              Quitar la foto
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
