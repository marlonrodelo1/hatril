import Image from 'next/image';

/**
 * El logo de la iglesia, o sus iniciales si todavía no ha subido ninguno.
 *
 * Existe como componente y no como dos ternarios sueltos porque lo piden el menú
 * lateral y el de móvil, y son la misma marca en dos sitios: si uno cae a las
 * iniciales y el otro enseña el logo, la aplicación parece de dos iglesias
 * distintas según el tamaño de la pantalla.
 *
 * EL CUADRO NARANJA ES EL RESPALDO, NO EL DEFECTO
 * -----------------------------------------------
 * Se pintaban siempre las iniciales sobre `bg-primary`, y eso gasta el único
 * naranja de la pantalla en algo que no es una acción — la regla del sistema de
 * diseño es un solo botón naranja, y el menú competía con él en cada vista. Con
 * logo, el recuadro es neutro y el color vuelve a significar «pulsa aquí».
 *
 * `unoptimized`: el logo vive en el bucket público de Supabase y ya viene
 * recortado a un tamaño razonable. Pasarlo por el optimizador de Next añade un
 * salto por el servidor en cada carga del panel para una imagen de 36 píxeles.
 */
export function MarcaIglesia({
  logoUrl,
  iniciales,
  nombre,
}: {
  logoUrl: string | null;
  iniciales: string;
  nombre: string;
}) {
  if (!logoUrl) {
    return (
      <span className="flex size-[36px] flex-none items-center justify-center rounded-[10px] bg-primary text-[13.5px] font-bold tracking-[-0.02em] text-primary-foreground">
        {iniciales}
      </span>
    );
  }

  return (
    <span className="flex size-[36px] flex-none items-center justify-center overflow-hidden rounded-[10px] border border-border bg-surface-alt">
      <Image
        src={logoUrl}
        alt={`Logo de ${nombre}`}
        width={36}
        height={36}
        unoptimized
        // `contain` y no `cover`: un logotipo recortado por los bordes deja de
        // ser el logotipo de nadie. Si no es cuadrado, que sobre fondo.
        className="size-full object-contain"
      />
    </span>
  );
}
