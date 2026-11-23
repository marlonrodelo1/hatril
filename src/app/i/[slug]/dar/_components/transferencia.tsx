'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

import { DatoCopiable } from './dato-copiable';

/**
 * La cuenta que la iglesia publica para transferencias.
 *
 * Dos formas: debajo del formulario, plegada tras «¿Prefieres transferencia?»
 * (la tarjeta manda y esto es la segunda opción), o abierta y sola cuando la
 * iglesia todavía no cobra con tarjeta.
 *
 * El texto es el de la ventana «Donar» de la web y no habla de IBAN: lo que
 * pega la iglesia puede ser un IBAN, un Nequi o un código de Bizum para ONG, y
 * la primera iglesia real puso justo el tercero.
 */
export function Transferencia({
  iglesiaNombre,
  cuenta,
  titular,
  plegada,
}: {
  iglesiaNombre: string;
  cuenta: string;
  titular: string | null;
  /** Debajo del formulario de tarjeta: empieza cerrada. */
  plegada: boolean;
}) {
  const [abierta, setAbierta] = useState(!plegada);
  const id = useId();

  const caja = (
    <div
      id={id}
      // Siempre en el DOM y con `hidden`: así `aria-controls` apunta a algo
      // también con la cuenta plegada, y al abrirse vuelve a entrar animada
      // (una animación arranca de nuevo al dejar de ser `display: none`).
      hidden={!abierta}
      className={clsx(
        'flex flex-col gap-3 rounded-xl border border-border p-4',
        // Plegada va un escalón por debajo del formulario: es la otra forma,
        // no la principal.
        plegada ? 'anim-aparece bg-surface-alt' : 'bg-surface',
      )}
    >
      <span className="t-micro">Cuenta de {iglesiaNombre}</span>
      <DatoCopiable etiqueta="Cuenta" valor={cuenta} que="la cuenta" />
      {titular && <DatoCopiable etiqueta="Titular" valor={titular} que="el titular" />}
      <p className="text-label text-pretty text-muted-foreground">
        Directamente a la iglesia, por el medio que indica aquí. Hatril no cobra
        ni guarda datos de tarjetas. Indica en el concepto si es diezmo u
        ofrenda.
      </p>
    </div>
  );

  if (!plegada) return caja;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((v) => !v)}
        className="inline-flex cursor-pointer items-center gap-1.5 self-center rounded-lg px-2 py-1.5 text-label font-semibold text-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        {abierta ? 'Ocultar la cuenta' : '¿Prefieres transferencia?'}
        <ChevronDown
          aria-hidden
          strokeWidth={1.8}
          className={clsx(
            'size-4 transition-transform duration-240 ease-hatril motion-reduce:transition-none',
            abierta && 'rotate-180',
          )}
        />
      </button>
      {caja}
    </div>
  );
}
