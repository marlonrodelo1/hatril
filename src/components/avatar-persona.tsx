import { colorAvatar } from '@/lib/format/color-avatar';
import { iniciales } from '@/lib/format/iniciales';

/**
 * El círculo con las iniciales de una persona.
 *
 * Existía copiado a mano en cinco sitios —el muro, los comentarios, el
 * compositor, el menú de cuenta— con tres tamaños distintos y el mismo beige
 * para todo el mundo. Ahora es un componente y cada persona tiene su color, que
 * sale de su nombre y no cambia nunca. El porqué largo está en
 * `lib/format/color-avatar.ts`.
 *
 * Sin `use client`: es una función de nombre a color y dos `span`. Se puede
 * pintar desde el servidor y desde el cliente, y no manda un byte de JavaScript
 * al navegador en ninguno de los dos casos.
 */
export function AvatarPersona({
  nombre,
  fotoUrl,
  tamano = 'md',
  className = '',
}: {
  nombre: string;
  /**
   * La foto de la ficha, si la hay. Sin ella se pintan las iniciales sobre su
   * color, que es el caso de casi toda la congregación: el pastor da de alta a
   * la gente desde una lista, no subiendo retratos.
   */
  fotoUrl?: string | null;
  /** `sm` para comentarios, `md` para publicaciones y cabeceras. */
  tamano?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const medidas = {
    sm: 'size-8 text-[11px]',
    md: 'size-9 text-[12px]',
    lg: 'size-11 text-[14px]',
  }[tamano];

  const comun =
    'flex flex-none items-center justify-center rounded-full font-bold ' +
    medidas +
    (className ? ' ' + className : '');

  const { fondo, texto } = colorAvatar(nombre);

  return (
    /*
     * Las iniciales SIEMPRE se pintan, y la foto va encima tapándolas.
     *
     * No es un adorno: si la foto no llega —el servicio caído, un móvil sin
     * datos, una URL firmada que caducó— un `<img>` roto deja un hueco con el
     * icono de imagen partida del navegador. Aquí lo que queda debajo son sus
     * iniciales sobre su color, que es exactamente lo que se ve para quien no
     * tiene foto. Nadie nota la diferencia y no hace falta JavaScript para
     * detectar el fallo.
     */
    <span
      className={'relative overflow-hidden ' + comun}
      // En línea y no como clase de Tailwind: los seis tonos se eligen en
      // tiempo de ejecución, y Tailwind solo genera las clases que encuentra
      // escritas en el código. Con `bg-[${fondo}]` no saldría ninguna.
      style={{ backgroundColor: fondo, color: texto }}
    >
      {iniciales(nombre)}

      {fotoUrl && (
        /*
         * `<img>` y no `next/image`. Dos motivos y ninguno es pereza: las fotos
         * de la congregación acabarán en el bucket privado, servidas con URL
         * firmada que caduca —y el optimizador de Next las cachearía con la firma
         * dentro de la clave, reoptimizando la misma cara cada hora—; y en un
         * muro hay veinte avatares de 36px, que es justo el tamaño donde
         * optimizar no ahorra nada.
         *
         * `alt` vacío a propósito: el nombre está escrito al lado, y un lector
         * de pantalla que lea «foto de Lucía Ferrer, Lucía Ferrer» estorba.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
