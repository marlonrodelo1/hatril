'use client';

import { useEffect, useState } from 'react';
import { Check, Circle, CircleAlert } from 'lucide-react';
import { clsx } from 'clsx';

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

/** Lo que mira el paso «Tu contraseña» antes de dejar seguir. */
export function cumpleReglaPassword(p: string): boolean {
  return REGLAS.every((r) => r.cumple(p));
}

/**
 * `fallos` cuenta las veces que se ha intentado seguir sin cumplirla.
 *
 * Con cada intento la lista tiembla (la clave nueva la vuelve a montar, y la
 * animación arranca otra vez), y lo que falta pasa a rojo con su icono. Lo
 * segundo no es adorno: con «reducir movimiento» no hay temblor, y sin el rojo
 * no quedaría ninguna señal de por qué no se pasa.
 */
export function ReglaPassword({
  idCampo,
  fallos = 0,
}: {
  idCampo: string;
  fallos?: number;
}) {
  const [valor, setValor] = useState('');

  useEffect(() => {
    const campo = document.getElementById(idCampo) as HTMLInputElement | null;
    if (!campo) return;
    const leer = () => setValor(campo.value);
    campo.addEventListener('input', leer);
    return () => campo.removeEventListener('input', leer);
  }, [idCampo]);

  return (
    <ul
      key={fallos}
      id="regla-password"
      className={clsx('flex flex-col gap-1 pt-0.5', fallos > 0 && 'anim-tiembla')}
    >
      {REGLAS.map((r) => {
        const ok = r.cumple(valor);
        const falta = !ok && fallos > 0;
        return (
          <li
            key={r.texto}
            className={clsx(
              'flex items-center gap-2 text-label transition-colors duration-150 motion-reduce:transition-none',
              ok ? 'text-badge-success-fg' : falta ? 'font-semibold text-badge-danger-fg' : 'text-muted-foreground',
            )}
          >
            {ok ? (
              <Check className="size-[15px] flex-none" strokeWidth={1.8} aria-hidden />
            ) : falta ? (
              <CircleAlert className="size-[15px] flex-none" strokeWidth={1.8} aria-hidden />
            ) : (
              <Circle className="size-[13px] flex-none" strokeWidth={1.8} aria-hidden />
            )}
            {r.texto}
            <span className="sr-only">{ok ? ' (cumplido)' : falta ? ' (falta)' : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}
