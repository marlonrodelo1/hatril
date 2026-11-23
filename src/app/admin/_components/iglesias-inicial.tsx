import { clsx } from 'clsx';

import { colorAvatar } from '@/lib/format/color-avatar';
import { iniciales } from '@/lib/format/iniciales';

/**
 * La inicial de una iglesia en las listas de `/admin`, o su logo si lo tiene.
 *
 * Cuadrada con radio de 8 y no redonda: el círculo es de las personas
 * (`AvatarPersona`), y en Cuentas salen las dos cosas juntas. El color sale del
 * nombre con la misma función que el de las personas, así que Betania es del
 * mismo tono en Inicio, en el listado y dentro de un año. No dice nada del
 * estado: eso lo dice la insignia de al lado.
 *
 * Las iniciales se pintan SIEMPRE y el logo va encima: si la imagen no llega, lo
 * que queda debajo es lo mismo que ve quien no tiene logo, en vez del icono de
 * imagen rota (el mismo truco que `AvatarPersona`).
 */
export function InicialIglesia({
  nombre,
  logoUrl,
  className,
}: {
  nombre: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const { fondo, texto } = colorAvatar(nombre);

  return (
    <span
      aria-hidden
      className={clsx(
        // Su `text-[12px]` es como el de los avatares: la medida va dentro de la
        // pieza, no en la escala de la página (guía, «Tipografía»).
        'relative flex size-9 flex-none items-center justify-center overflow-hidden rounded-lg text-[12px] font-bold',
        className,
      )}
      // En línea: los tonos se eligen al pintar, y Tailwind solo genera las
      // clases que encuentra escritas. Son los seis de `colorAvatar`, los de
      // las personas; ningún color nuevo.
      style={{ backgroundColor: fondo, color: texto }}
    >
      {iniciales(nombre)}
      {logoUrl && (
        // `<img>` y no `next/image`: 36 px, donde optimizar no ahorra nada, y el
        // logo puede venir de cualquier bucket que la iglesia haya usado.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full bg-surface object-cover"
        />
      )}
    </span>
  );
}
