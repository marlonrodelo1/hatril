'use client';

import {
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { clsx } from 'clsx';

/**
 * El tamaño de la letra de lectura: el devocional y la Biblia.
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * Son las dos pantallas de texto largo de la aplicación, y quien más las lee
 * es gente mayor con el móvil a un palmo. Con un solo tamaño, quien lee mal
 * tiene que ampliar la pantalla entera con dos dedos, y la cabecera, la barra
 * de abajo y el margen se van con ella fuera de la vista (zona 2 del
 * rediseño, 17-nov).
 *
 * CUATRO PASOS Y NO UN DESLIZADOR
 * -------------------------------
 * 14, 15, 17 y 19 px. Un deslizador pide puntería, y dos botones se aciertan
 * con el pulgar. Los pasos no son de uno en uno porque por encima de 15 un
 * píxel no se nota: de 15 a 17 sí.
 *
 * UN SOLO VALOR GUARDADO, DOS PUNTOS DE PARTIDA
 * ---------------------------------------------
 * Si nadie ha tocado nada, el devocional sale a 15 y la Biblia a 17: la Biblia
 * es letra de libro y se lee más rato seguido. En cuanto alguien elige un
 * tamaño, ese es el suyo en las dos pantallas. Se guarda el tamaño y no «un
 * paso más que el normal», porque lo que la persona ha decidido es a qué letra
 * lee, no cuánto más grande que algo que ella no ve.
 *
 * EN `localStorage`, Y PUEDE NO HABERLO
 * -------------------------------------
 * Es una preferencia de este móvil, no de la cuenta, y no merece una columna.
 * En una ventana privada o con el almacenamiento bloqueado, `localStorage`
 * lanza: por eso todo va con try/catch y el valor elegido se queda además en
 * memoria, que dura lo que dura la visita. Se lee con `useSyncExternalStore`,
 * igual que la barra lateral del panel: el servidor pinta el tamaño por
 * defecto y el cliente el guardado, sin discordancia de hidratación.
 *
 * Sin JavaScript se lee igual, al tamaño por defecto: el servidor ya lo
 * escribe en el `style` del contenedor. Lo único que se pierde son los
 * botones.
 */

const CLAVE = 'hatril:letra-lectura';
const PASOS = [14, 15, 17, 19] as const;
const POR_DEFECTO = { devocional: 15, biblia: 17 } as const;

type Pantalla = keyof typeof POR_DEFECTO;

const oyentes = new Set<() => void>();

/** Lo elegido en esta visita: manda aunque `localStorage` no exista. */
let elegida: number | null = null;

/**
 * Si el cambio lo ha hecho la persona en esta visita. Hasta entonces el texto
 * no anima: el salto del tamaño por defecto al guardado ocurre al hidratar, y
 * una letra que crece sola al abrir la pantalla parece un fallo.
 */
let tocadaAMano = false;

function valido(n: number): number | null {
  return (PASOS as readonly number[]).includes(n) ? n : null;
}

function suscribir(avisar: () => void) {
  // `storage` solo llega a las OTRAS pestañas: quien tenga la Biblia abierta
  // en dos y cambie la letra en una ve cambiar también la otra.
  const deOtraPestana = (e: StorageEvent) => {
    if (e.key !== CLAVE && e.key !== null) return;
    elegida = null;
    avisar();
  };
  oyentes.add(avisar);
  window.addEventListener('storage', deOtraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', deOtraPestana);
  };
}

function leer(): number | null {
  if (elegida !== null) return elegida;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    // Un valor que no es uno de los cuatro pasos (otra versión, alguien
    // trasteando) se ignora: mejor el tamaño por defecto que uno roto.
    return crudo === null ? null : valido(Number(crudo));
  } catch {
    return null;
  }
}

function guardar(px: number) {
  elegida = px;
  tocadaAMano = true;
  try {
    window.localStorage.setItem(CLAVE, String(px));
  } catch {
    // Sin almacenamiento vale para esta visita, que es lo que se puede.
  }
  oyentes.forEach((avisar) => avisar());
}

function useLetra(para: Pantalla): number {
  const guardada = useSyncExternalStore(suscribir, leer, () => null);
  return guardada ?? POR_DEFECTO[para];
}

const BOTON =
  'flex cursor-pointer items-center px-2.5 text-label font-bold text-foreground outline-none transition-colors duration-150 hover:bg-surface-alt focus-visible:bg-surface-active disabled:cursor-not-allowed disabled:text-disabled-text disabled:hover:bg-transparent motion-reduce:transition-none';

/**
 * A− y A+. Va en la cabecera, que es pegajosa: la letra se cambia a mitad de
 * lectura, cuando se nota que cuesta, y no hay que subir a buscarla.
 */
export function TamanoLetra({ para }: { para: Pantalla }) {
  const px = useLetra(para);
  const i = (PASOS as readonly number[]).indexOf(px);

  return (
    <div
      role="group"
      aria-label="Tamaño de la letra"
      className="flex h-9 flex-none items-stretch overflow-hidden rounded-full border border-border bg-surface"
    >
      <button
        type="button"
        onClick={() => guardar(PASOS[i - 1])}
        disabled={i <= 0}
        aria-label="Letra más pequeña"
        className={BOTON}
      >
        A−
      </button>
      <span aria-hidden className="my-2 w-px flex-none bg-border" />
      <button
        type="button"
        onClick={() => guardar(PASOS[i + 1])}
        disabled={i >= PASOS.length - 1}
        aria-label="Letra más grande"
        className={BOTON}
      >
        A+
      </button>
    </div>
  );
}

/**
 * El contenedor del texto que se lee. Fija `--letra-lectura` y el tamaño de
 * letra con ella; lo de dentro que no lleve tamaño propio lo hereda.
 *
 * Lo que tenga que ir un poco más grande (el versículo destacado, 2 px más)
 * se escribe en `em` y no con la variable: así crece a la vez que el resto
 * cuando la transición está en marcha, en vez de saltar de golpe al final.
 */
export function TextoAMedida({
  para,
  className,
  children,
}: {
  para: Pantalla;
  className?: string;
  children: ReactNode;
}) {
  const px = useLetra(para);
  const animar = useSyncExternalStore(
    suscribir,
    () => tocadaAMano,
    () => false,
  );

  return (
    <div
      style={{ '--letra-lectura': `${px}px` } as CSSProperties}
      className={clsx(
        'text-(length:--letra-lectura)',
        animar &&
          'transition-[font-size] duration-240 ease-hatril motion-reduce:transition-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
