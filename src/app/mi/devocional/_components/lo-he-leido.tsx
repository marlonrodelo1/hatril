'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * «Lo he leído», al final del devocional.
 *
 * SOLO EN ESTE MÓVIL, Y A PROPÓSITO
 * ---------------------------------
 * Se guarda en el `localStorage` de quien lo pulsa y en ningún otro sitio: no
 * toca la base de datos, no viaja al servidor y no lo ve nadie más, ni el
 * pastor ni quien escribió el devocional. Es una marca para uno mismo, como
 * doblar la esquina de una página.
 *
 * Guardarlo en la base convertiría un gesto íntimo en un registro de quién
 * lee y quién no, dentro de una iglesia: dato de práctica religiosa (art. 9
 * RGPD) que alguien acabaría queriendo ver en una lista. Si algún día se
 * quiere eso, es otra decisión y otra conversación; no esta.
 *
 * El precio: en otro móvil, o después de borrar los datos del navegador, sale
 * sin marcar. Para una marca personal es aceptable.
 *
 * «LEÍDO HOY» SOLO SI ES HOY
 * --------------------------
 * Se guarda el día en que se marcó. Abierto desde el archivo una semana
 * después, dice «Leído» a secas: un «hoy» que ya no es verdad es la misma
 * mentira pequeña que el «· el último publicado» de la portada, que solo se
 * pinta cuando lo es.
 *
 * La clave va por iglesia y fecha (`clave`): el devocional no tiene otro
 * identificador en la pantalla, y quien esté en dos iglesias tiene dos
 * devocionales distintos el mismo día. Cada marca son unos sesenta bytes, así
 * que no se limpian.
 */

const PREFIJO = 'hatril:devocional-leido:';

const oyentes = new Set<() => void>();

/** Lo marcado en esta visita: vale aunque `localStorage` no exista. */
const enMemoria = new Map<string, string | null>();

function suscribir(avisar: () => void) {
  const deOtraPestana = () => {
    enMemoria.clear();
    avisar();
  };
  oyentes.add(avisar);
  window.addEventListener('storage', deOtraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', deOtraPestana);
  };
}

function leer(clave: string): string | null {
  if (enMemoria.has(clave)) return enMemoria.get(clave) ?? null;
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string | null) {
  enMemoria.set(clave, valor);
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, valor);
  } catch {
    // Ventana privada o almacenamiento bloqueado: vale para esta visita.
  }
  oyentes.forEach((avisar) => avisar());
}

/** El día de hoy en el reloj del móvil, que es el de quien lee. */
function hoyAqui(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

type Estado = 'sin-leer' | 'hoy' | 'antes';

export function LoHeLeido({ clave }: { clave: string }) {
  const k = PREFIJO + clave;

  // El estado ya resuelto, y no la fecha cruda: una cadena fija entre llamadas
  // es lo que pide `useSyncExternalStore`, y así «hoy» se calcula fuera del
  // render.
  const estado = useSyncExternalStore<Estado>(
    suscribir,
    () => {
      const dia = leer(k);
      return dia === null ? 'sin-leer' : dia === hoyAqui() ? 'hoy' : 'antes';
    },
    () => 'sin-leer',
  );

  // La marca salta solo al pulsar. Si ya estaba leído al abrir la pantalla,
  // el cambio llega al hidratar, y un icono que salta solo parece un aviso.
  const [recien, setRecien] = useState(false);
  const leido = estado !== 'sin-leer';

  function alternar() {
    setRecien(!leido);
    escribir(k, leido ? null : hoyAqui());
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={leido}
      className={clsx(
        'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-label font-semibold outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
        leido
          ? 'border-transparent bg-badge-success-bg text-badge-success-fg'
          : 'border-dashed border-border-strong text-muted-foreground hover:bg-surface-alt hover:text-foreground',
      )}
    >
      <Check
        key={leido ? 'si' : 'no'}
        aria-hidden
        className={clsx('size-4', leido && recien && 'anim-salta')}
        strokeWidth={1.8}
      />
      {estado === 'hoy' ? 'Leído hoy' : estado === 'antes' ? 'Leído' : 'Lo he leído'}
    </button>
  );
}
