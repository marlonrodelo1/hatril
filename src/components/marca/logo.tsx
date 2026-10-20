import { cn } from '@/lib/utils';

/**
 * La marca de Hatril: el símbolo solo, o el símbolo con el nombre al lado.
 *
 * PROVISIONAL
 * -----------
 * Lo que se pinta hoy es el icono de la app nativa (`assets/icono.svg`): una H
 * blanca sobre el naranja quemado. El logo definitivo —el que tiene que llevar
 * el atril, de donde sale el nombre— está por elegir. Cuando llegue se cambia
 * SOLO este fichero: el `<path>` de `Simbolo`, y si hace falta su `viewBox`.
 * Quien lo usa pide una variante y un tamaño, y no sabe nada del dibujo.
 *
 * Lo que tiene que seguir cumpliendo el que lo sustituya:
 *   - Leerse a 16 px y a 1024.
 *   - Colores por token (`fill-primary`, `fill-primary-foreground`), nunca en
 *     hex: es lo que lo mantiene al día si la paleta vuelve a cambiar.
 *   - Sin degradados ni sombras.
 *
 * EL NOMBRE VA EN TEXTO, NO DIBUJADO
 * ----------------------------------
 * En el logotipo, «Hatril» es un `<span>` con la letra de la aplicación y no un
 * trazado. Así lo lee un lector de pantalla tal cual, se puede seleccionar, y
 * sale con la misma Plus Jakarta Sans que el resto de la pantalla. El símbolo,
 * en cambio, lleva `aria-hidden` cuando el nombre está al lado: si no, se
 * anunciaría «Hatril, Hatril».
 *
 * Los tamaños del nombre se calculan del símbolo y por eso van en `style`: es
 * una pieza de marca, como el avatar, que lleva sus medidas dentro.
 */

type Variante = 'simbolo' | 'logotipo';

export function Logo({
  variante = 'logotipo',
  tamano = 32,
  className,
}: {
  variante?: Variante;
  /** Lado del símbolo, en px. En el logotipo, el nombre se escala con él. */
  tamano?: number;
  className?: string;
}) {
  if (variante === 'simbolo') {
    return (
      <span
        role="img"
        aria-label="Hatril"
        className={cn('inline-flex shrink-0', className)}
      >
        <Simbolo tamano={tamano} />
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex shrink-0 items-center text-foreground', className)}
      style={{ gap: Math.round(tamano * 0.3) }}
    >
      <Simbolo tamano={tamano} />
      <span
        className="leading-none font-extrabold tracking-[-0.03em]"
        style={{ fontSize: Math.round(tamano * 0.62) }}
      >
        Hatril
      </span>
    </span>
  );
}

/**
 * El dibujo. Cuadrado con las esquinas redondeadas a un 22 %: a 56 px da 12,
 * el radio de las tarjetas, y a 36 da 8, el de los botones. El icono de la app
 * va sin redondear porque se lo recorta cada sistema; aquí no hay quien lo
 * recorte.
 */
function Simbolo({ tamano }: { tamano: number }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={tamano}
      height={tamano}
      aria-hidden
      focusable="false"
      className="block shrink-0"
    >
      <rect width="1024" height="1024" rx="224" className="fill-primary" />
      <path
        className="fill-primary-foreground"
        d="M319 282H425V457H599V282H705V742H599V535H425V742H319Z"
      />
    </svg>
  );
}
