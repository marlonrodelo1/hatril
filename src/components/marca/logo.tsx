import { cn } from '@/lib/utils';

/**
 * La marca de Hatril: el símbolo solo, o el logotipo, la palabra entera.
 *
 * LA «t» ES EL ATRIL
 * ------------------
 * El logo final es la propuesta 3-b, «el atril, de pie» (20-oct-2026): la «t»
 * de Hatril es un atril, con el pupitre inclinado, la Biblia abierta encima y
 * el asta como columna. Los SVG originales, la lámina y el porqué de cada
 * medida están en `Versiones/marca/final/` (fuera del repo, con sus
 * generadores). Si el dibujo cambia, se cambia aquí y en `assets/` (el icono y
 * los dos favicons, y luego `npm run app:iconos`), y nada más: quien usa el
 * componente pide una variante y un tamaño y no sabe del dibujo.
 *
 *   - `logotipo`: «Hatril» en Plus Jakarta Sans Bold, la misma letra de la
 *     aplicación, con la t-atril en naranja y el resto en carbón.
 *   - `simbolo`: el icono de la app, el atril blanco sobre el naranja, en un
 *     cuadrado con las esquinas al 22 %: a 56 px da 12, el radio de las
 *     tarjetas. El icono instalado va sin redondear porque se lo recorta cada
 *     sistema; aquí no hay quien lo recorte.
 *
 * EL NOMBRE VA DIBUJADO, Y POR ESO LLEVA ETIQUETA
 * -----------------------------------------------
 * El logotipo provisional escribía «Hatril» en un `<span>`. Con el atril ya no
 * se puede: la «t» no es una letra de la fuente. Así que la palabra entera es
 * un trazado, y el `<svg>` se anuncia como una imagen llamada «Hatril». Dentro
 * de un enlace con su propia etiqueta («Hatril, ir a la portada») manda la del
 * enlace, que es lo que se quiere.
 *
 * TRES DIBUJOS PARA EL SÍMBOLO, SEGÚN EL TAMAÑO
 * ---------------------------------------------
 * Por debajo de unos 40 px el libro y el pupitre del dibujo vectorial se
 * funden en un solo bloque inclinado. Para eso están los favicons, dibujados
 * a mano en la rejilla de 16 y de 32 píxeles; aquí se usan los mismos, con
 * `crispEdges`, para que el símbolo pequeño de la web sea el de la pestaña.
 *
 * COLORES POR TOKEN
 * -----------------
 * `fill-primary` (el naranja), `fill-support` (el carbón) y
 * `fill-primary-foreground` (el blanco sobre el naranja), nunca en hex: es lo
 * que lo mantiene al día si la paleta vuelve a cambiar. Sin degradados ni
 * sombras.
 */

type Variante = 'simbolo' | 'logotipo';

export function Logo({
  variante = 'logotipo',
  tamano = 32,
  className,
}: {
  variante?: Variante;
  /**
   * Alto en px. En el símbolo es el lado del cuadrado; en el logotipo, la
   * altura de la palabra, de la base al remate de la «l» (la «H» mide un 97 %).
   */
  tamano?: number;
  className?: string;
}) {
  if (variante === 'simbolo') {
    return <Simbolo tamano={tamano} className={className} />;
  }

  return (
    <svg
      viewBox="72 -757 2474 769"
      width={Math.round((tamano * 2474) / 769)}
      height={tamano}
      role="img"
      aria-label="Hatril"
      focusable="false"
      className={cn('block shrink-0', className)}
    >
      <path className="fill-support" d={LETRAS} />
      <path className="fill-primary" d={T_ATRIL} />
    </svg>
  );
}

function Simbolo({ tamano, className }: { tamano: number; className?: string }) {
  const comun = {
    width: tamano,
    height: tamano,
    role: 'img',
    'aria-label': 'Hatril',
    focusable: 'false' as const,
    className: cn('block shrink-0', className),
  };

  if (tamano <= 24) {
    return (
      <svg viewBox="0 0 16 16" shapeRendering="crispEdges" {...comun}>
        <path className="fill-primary" d={FAVICON_16.fondo} />
        <path className="fill-primary-foreground" d={FAVICON_16.atril} />
      </svg>
    );
  }

  if (tamano < 40) {
    return (
      <svg viewBox="0 0 32 32" shapeRendering="crispEdges" {...comun}>
        <path className="fill-primary" d={FAVICON_32.fondo} />
        <path className="fill-primary-foreground" d={FAVICON_32.atril} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 1024 1024" {...comun}>
      <rect width="1024" height="1024" rx="224" className="fill-primary" />
      <path className="fill-primary-foreground" d={ATRIL} />
    </svg>
  );
}

/* --- Los trazados, copiados tal cual de Versiones/marca/final/ ------------ */

/** H, a, r, i y l de `logotipo.svg`. */
const LETRAS =
  'M208 0L72 0L72-745L208-745L208-420L525-420L525-745L662-745L662 0L525 0L525-300L208-300L208 0ZM959 12L959 12Q902 12 860-7Q818-26 795-61.50Q772-97 772-144L772-144Q772-189 792-224.50Q812-260 854-284Q896-308 960-318L960-318L1138-347L1138-247L985-221Q946-214 927-196Q908-178 908-149L908-149Q908-121 929.50-104.50Q951-88 983-88L983-88Q1024-88 1055.50-105.50Q1087-123 1104.50-154Q1122-185 1122-222L1122-222L1122-362Q1122-397 1094.50-420.50Q1067-444 1022-444L1022-444Q980-444 947.50-421.50Q915-399 900-362L900-362L793-414Q809-457 843.50-488.50Q878-520 925-538Q972-556 1027-556L1027-556Q1094-556 1145-531.50Q1196-507 1224.50-463.50Q1253-420 1253-362L1253-362L1253 0L1129 0L1129-93L1157-95Q1136-60 1107-36.50Q1078-13 1041-0.50Q1004 12 959 12ZM1920 0L1789 0L1789-544L1912-544L1912-423L1902-441Q1921-502 1961.50-526Q2002-550 2059-550L2059-550L2091-550L2091-434L2044-434Q1988-434 1954-399.50Q1920-365 1920-303L1920-303L1920 0ZM2294 0L2163 0L2163-544L2294-544L2294 0ZM2294-605L2163-605L2163-745L2294-745L2294-605ZM2546 0L2415 0L2415-757L2546-757L2546 0Z';

/** La t-atril de `logotipo.svg`: pupitre y columna, y el libro encima. */
const T_ATRIL =
  'M1321,-510.13l370,-45.43v128.57h-159v231c0,48.72 61.65,88 137,84v112h-98c-95.2,0 -170,-74.8 -170,-170v-257h-80zM1281.45,-644.31c52.38,-10.38 105.21,-17.99 158.36,-23.16c23.64,-2.57 46.06,9.89 58.11,30.2c5.28,8.9 7.11,17.46 9.44,27.68c-0.21,-10.47 -0.5,-19.23 2.47,-29.14c6.78,-22.63 25.52,-40.14 49.08,-43.36c52.82,-7.84 105.92,-13.23 159.26,-15.83l11.7,95.28c-43.29,8.44 -86.58,16.9 -129.89,25.25c-28.79,5.55 -57.64,11.88 -86.76,15.46c-29.12,3.58 -58.65,4.41 -87.93,5.99c-44.04,2.37 -88.09,4.64 -132.14,6.92z';

/** El atril de `icono-app.svg`, dentro del círculo del 66 %. */
const ATRIL =
  'M352.71,384.31l318.58,-39.12v104.23l-104.38,0v207.08c0,50.57 45.27,90.54 100.6,87.19v63.72h-311.03v-63.72c55.33,3.35 100.6,-36.62 100.6,-87.19v-207.08h-104.38zM323.99,271.27c43.92,-8.7 88.21,-15.08 132.76,-19.42c19.82,-2.16 38.62,8.29 48.72,25.32c4.43,7.46 5.96,14.64 7.92,23.2c-0.17,-8.78 -0.42,-16.12 2.07,-24.43c5.68,-18.97 21.4,-33.65 41.15,-36.35c44.28,-6.57 88.8,-11.1 133.52,-13.27l9.81,79.88c-36.29,7.08 -72.59,14.17 -108.9,21.17c-24.14,4.65 -48.33,9.96 -72.74,12.96c-24.41,3 -49.17,3.7 -73.71,5.02c-36.92,1.99 -73.85,3.89 -110.78,5.81z';

/** `favicon-16.svg`: el cuadrado de esquinas escalonadas y el atril. */
const FAVICON_16 = {
  fondo:
    'M2 0h12v1h-12zM1 1h14v1h-14zM0 2h16v1h-16zM0 3h16v1h-16zM0 4h16v1h-16zM0 5h16v1h-16zM0 6h16v1h-16zM0 7h16v1h-16zM0 8h16v1h-16zM0 9h16v1h-16zM0 10h16v1h-16zM0 11h16v1h-16zM0 12h16v1h-16zM0 13h16v1h-16zM1 14h14v1h-14zM2 15h12v1h-12z',
  atril:
    'M9 2h2v1h-2zM5 3h2v1h-2zM9 3h2v1h-2zM5 4h6v1h-6zM8 6h4v1h-4zM4 7h8v1h-8zM7 8h2v1h-2zM7 9h2v1h-2zM7 10h2v1h-2zM7 11h2v1h-2zM6 12h4v1h-4zM4 13h8v1h-8z',
};

/** `favicon-32.svg`, con el retoque del 20-oct: pupitre de 14 y sin roce. */
const FAVICON_32 = {
  fondo:
    'M4 0h24v1h-24zM3 1h26v1h-26zM2 2h28v1h-28zM1 3h30v1h-30zM0 4h32v1h-32zM0 5h32v1h-32zM0 6h32v1h-32zM0 7h32v1h-32zM0 8h32v1h-32zM0 9h32v1h-32zM0 10h32v1h-32zM0 11h32v1h-32zM0 12h32v1h-32zM0 13h32v1h-32zM0 14h32v1h-32zM0 15h32v1h-32zM0 16h32v1h-32zM0 17h32v1h-32zM0 18h32v1h-32zM0 19h32v1h-32zM0 20h32v1h-32zM0 21h32v1h-32zM0 22h32v1h-32zM0 23h32v1h-32zM0 24h32v1h-32zM0 25h32v1h-32zM0 26h32v1h-32zM0 27h32v1h-32zM1 28h30v1h-30zM2 29h28v1h-28zM3 30h26v1h-26zM4 31h24v1h-24z',
  atril:
    'M17 5h6v1h-6zM9 6h6v1h-6zM16 6h7v1h-7zM9 7h6v1h-6zM16 7h7v1h-7zM9 8h14v1h-14zM9 9h7v1h-7zM17 10h6v1h-6zM9 11h14v1h-14zM9 12h14v1h-14zM14 13h4v1h-4zM14 14h4v1h-4zM14 15h4v1h-4zM14 16h4v1h-4zM14 17h4v1h-4zM14 18h4v1h-4zM14 19h4v1h-4zM14 20h4v1h-4zM14 21h4v1h-4zM13 22h6v1h-6zM12 23h8v1h-8zM11 24h10v1h-10zM10 25h12v1h-12zM10 26h12v1h-12z',
};
