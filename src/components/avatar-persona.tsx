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
  tamano = 'md',
  className = '',
}: {
  nombre: string;
  /** `sm` para comentarios, `md` para publicaciones y cabeceras. */
  tamano?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { fondo, texto } = colorAvatar(nombre);

  const medidas = {
    sm: 'size-8 text-[11px]',
    md: 'size-9 text-[12px]',
    lg: 'size-11 text-[14px]',
  }[tamano];

  return (
    <span
      className={
        'flex flex-none items-center justify-center rounded-full font-bold ' +
        medidas +
        (className ? ' ' + className : '')
      }
      // En línea y no como clase de Tailwind: los seis tonos se eligen en
      // tiempo de ejecución, y Tailwind solo genera las clases que encuentra
      // escritas en el código. Con `bg-[${fondo}]` no saldría ninguna.
      style={{ backgroundColor: fondo, color: texto }}
    >
      {iniciales(nombre)}
    </span>
  );
}
