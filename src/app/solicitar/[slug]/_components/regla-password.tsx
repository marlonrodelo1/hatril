'use client';

import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';

/**
 * La regla de la contraseña, visible antes de escribir y marcándose sola.
 *
 * Es la misma de `validarPassword` (`lib/auth/password.ts`), que es la que
 * decide: esto solo enseña por adelantado lo que el servidor va a pedir, para
 * que nadie descubra la regla a base de errores. Sin JavaScript se ve la lista
 * sin marcar, que sigue diciendo lo mismo.
 */
const REGLAS = [
  { texto: '8 caracteres o más', cumple: (p: string) => p.length >= 8 },
  { texto: 'Una mayúscula y una minúscula', cumple: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { texto: 'Un número', cumple: (p: string) => /[0-9]/.test(p) },
];

export function ReglaPassword({ idCampo }: { idCampo: string }) {
  const [valor, setValor] = useState('');

  useEffect(() => {
    const campo = document.getElementById(idCampo) as HTMLInputElement | null;
    if (!campo) return;
    const leer = () => setValor(campo.value);
    campo.addEventListener('input', leer);
    return () => campo.removeEventListener('input', leer);
  }, [idCampo]);

  return (
    <ul id="regla-password" className="flex flex-col gap-1 pt-0.5">
      {REGLAS.map((r) => {
        const ok = r.cumple(valor);
        return (
          <li
            key={r.texto}
            className={'flex items-center gap-2 text-[13px] ' + (ok ? 'text-badge-success-fg' : 'text-muted-foreground')}
          >
            {ok ? (
              <Check className="size-[15px]" strokeWidth={2.2} aria-hidden />
            ) : (
              <Circle className="size-[13px]" strokeWidth={1.8} aria-hidden />
            )}
            {r.texto}
            <span className="sr-only">{ok ? ' (cumplido)' : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}
