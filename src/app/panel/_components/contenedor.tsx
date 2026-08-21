import { cn } from '@/lib/utils';

/**
 * El contenedor de contenido de una pantalla del panel.
 *
 * ONCE ANCHOS DISTINTOS, Y NINGÚN CRITERIO
 * ----------------------------------------
 * Las pantallas del panel usaban 560, 620, 640, 680, 760, 820, 860, 1000, 1100,
 * 1400 y 1600 px. No respondía a nada: el formulario de un movimiento a 560 y
 * el de un miembro a 760 hacen lo mismo, y Eventos a 1000 junto a Miembros a
 * 1400 hace que el contenido salte de sitio al cambiar de sección.
 *
 * Aquí hay dos, y la diferencia sí significa algo:
 *
 *   `ancho` — listados, tarjetas y paneles. 1600 px. Es lo que el usuario pedía
 *     al decir que sobraba media pantalla: por debajo de eso, un monitor de
 *     escritorio se queda con una columna estrecha pegada al menú.
 *
 *   `formulario` — altas y ediciones. 760 px. NO se estira, y esta es la parte
 *     que parece contradecir lo anterior y no lo hace: un campo de texto de
 *     1500 px de ancho no se rellena mejor, se rellena peor. Lo que se hace en
 *     una pantalla ancha con un formulario es ponerlo a dos columnas —eso lo
 *     hace cada formulario con `sm:grid-cols-2`—, no alargar los campos.
 *
 * El sangrado también se unifica: 16px en móvil, 32 a partir de `md`. Antes
 * había páginas a `px-5` y otras a `px-4` sin motivo, y el contenido bailaba
 * respecto a la cabecera al navegar.
 */
export function Contenedor({
  ancho = 'panel',
  className,
  children,
}: {
  ancho?: 'panel' | 'formulario';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-6 px-4 pb-16 pt-5 md:px-8 md:pt-6',
        ancho === 'panel' ? 'max-w-[1600px]' : 'max-w-[760px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
