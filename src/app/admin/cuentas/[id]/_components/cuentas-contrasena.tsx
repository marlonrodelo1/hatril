'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Circle, CircleCheck, Copy, KeyRound, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

import { PASSWORD_MIN, validarPassword } from '@/lib/auth/password';
import { Button } from '@/components/ui/button';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ponerContrasena } from '../../actions';
import { generarContrasena } from './cuentas-generar';

/**
 * «Poner una contraseña provisional»: el botón de la ficha y su ventana.
 *
 * LA MISMA ACTION DE SIEMPRE
 * --------------------------
 * El formulario manda `id` y `password` a `ponerContrasena`, igual que cuando
 * el campo estaba suelto en la ficha. Lo nuevo es solo de este lado: la
 * contraseña viene ya escrita (`cuentas-generar.ts`), se puede pedir otra,
 * copiar o escribir a mano, y la regla se va marcando mientras tanto. La
 * comprobación de verdad sigue en la action y, detrás, en Supabase.
 *
 * NO SE GUARDA EN NINGÚN SITIO
 * ----------------------------
 * Vive en el estado de esta ventana mientras está abierta y se borra al
 * cerrarla. Ni en la URL, ni en el almacenamiento del navegador, ni en el
 * aviso de después: si se pierde antes de dictarla, se pone otra. Por eso el
 * campo es `type="text"` (el gestor de contraseñas del navegador solo se ofrece
 * a guardar los `password`) y lleva las marcas con las que 1Password, LastPass
 * y Bitwarden dejan un campo en paz: guardarla sería apuntar en el ordenador
 * del super admin la contraseña de otra persona.
 */
export function VentanaContrasena({
  id,
  para,
}: {
  /** El id de la cuenta, que viaja oculto en el formulario. */
  id: string;
  /** Cómo se nombra a la cuenta en el título: «para pastor.sion». */
  para: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState('');
  const [copiada, setCopiada] = useState(false);
  const [vueltas, setVueltas] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copiar y cerrar antes de que pase el segundo y medio dejaría un setState
  // apuntando a un componente que ya no existe.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  function cambiar(abrir: boolean) {
    setAbierta(abrir);
    // Se genera al abrir, en el clic, y no al pintar: el servidor no puede
    // escribirla (no debe conocerla) y generarla en el render daría una
    // distinta en cada pasada. Al cerrar se olvida.
    setValor(abrir ? generarContrasena() : '');
    setCopiada(false);
  }

  function otra() {
    setValor(generarContrasena());
    setCopiada(false);
    setVueltas((v) => v + 1);
  }

  function marcarCopiada() {
    setCopiada(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiada(false), 1500);
  }

  async function copiar() {
    try {
      // Dentro del propio clic: fuera de un gesto de la persona, el navegador
      // rechaza escribir en el portapapeles.
      await navigator.clipboard.writeText(valor);
      marcarCopiada();
    } catch {
      // Sin portapapeles —contexto no seguro, un WebView capado— se prueba el
      // camino viejo sobre el texto seleccionado. Si tampoco, se queda
      // seleccionado y basta con Ctrl+C.
      campo.current?.focus();
      campo.current?.select();
      if (document.execCommand('copy')) marcarCopiada();
    }
  }

  // Los mismos tres criterios que `validarPassword`. El botón de enviar, en
  // cambio, pregunta a `validarPassword` directamente, para que lo que deja
  // pasar no dependa de que esta lista esté al día.
  const reglas = [
    { texto: `${PASSWORD_MIN} caracteres o más`, ok: valor.length >= PASSWORD_MIN },
    {
      texto: 'Una mayúscula y una minúscula',
      ok: /[a-z]/.test(valor) && /[A-Z]/.test(valor),
    },
    { texto: 'Un número', ok: /[0-9]/.test(valor) },
  ];
  const valida = validarPassword(valor) === null;

  return (
    <Dialog open={abierta} onOpenChange={cambiar}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <KeyRound strokeWidth={1.8} /> Poner una
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="gap-4 p-5 sm:max-w-md">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-[18px] flex-none" strokeWidth={1.8} aria-hidden />
            {/* El tamaño va en el `span`: el `text-base` del título es una
                utilidad y ganaría a `t-subtitulo`, que vive en `components`. */}
            <span className="t-subtitulo min-w-0 break-words">
              Contraseña provisional para {para}
            </span>
          </DialogTitle>
          <DialogDescription>
            <span className="text-label text-muted-foreground">
              Para quien no puede recuperarla por correo. Díctasela por
              teléfono y pídele que la cambie al entrar. Su contraseña de ahora
              deja de valer.
            </span>
          </DialogDescription>
        </div>

        <form action={ponerContrasena} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <CerrarAlTerminar alTerminar={() => cambiar(false)} />

          <div className="flex flex-col gap-2">
            {/* El anillo, solo cuando el foco está en el campo: con
                `focus-within`, pulsar «Otra» o «Copiar» encendía la caja
                entera como si se estuviera escribiendo. */}
            <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-surface-alt py-1.5 pr-1.5 pl-3 transition-colors duration-150 has-[input:focus-visible]:border-primary has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-primary/16 motion-reduce:transition-none">
              <input
                ref={campo}
                name="password"
                type="text"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  setCopiada(false);
                }}
                required
                minLength={PASSWORD_MIN}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                aria-label="Contraseña provisional"
                aria-describedby="regla-contrasena"
                className="min-w-0 flex-1 bg-transparent font-mono text-subtitle font-semibold tracking-wide outline-none"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={otra}
                aria-label="Generar otra"
                title="Otra"
              >
                <RefreshCw
                  strokeWidth={1.8}
                  className="transition-transform duration-360 ease-hatril motion-reduce:transition-none"
                  style={{ transform: `rotate(${vueltas * 180}deg)` }}
                />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={copiar}
                aria-label={copiada ? 'Copiada' : 'Copiar'}
                title="Copiar"
                className={clsx(copiada && 'text-badge-success-fg')}
              >
                {copiada ? <Check strokeWidth={2} /> : <Copy strokeWidth={1.8} />}
              </Button>
            </div>

            <ul id="regla-contrasena" className="flex flex-col gap-1">
              {reglas.map((r) => (
                <li
                  key={r.texto}
                  className={clsx(
                    'flex items-center gap-1.5 text-label transition-colors duration-150 motion-reduce:transition-none',
                    r.ok ? 'text-badge-success-fg' : 'text-muted-foreground',
                  )}
                >
                  {/* El icono cambia de forma, no solo de color: un círculo
                      vacío y uno marcado se distinguen sin ver los colores. */}
                  {r.ok ? (
                    <CircleCheck className="size-[15px] flex-none" strokeWidth={1.8} aria-hidden />
                  ) : (
                    <Circle className="size-[15px] flex-none" strokeWidth={1.8} aria-hidden />
                  )}
                  <span className="sr-only">{r.ok ? 'Cumple: ' : 'Falta: '}</span>
                  {r.texto}
                </li>
              ))}
            </ul>

            <p className="text-label text-pretty text-muted-foreground">
              Cópiala o apúntala antes de ponerla: después no se vuelve a ver.
            </p>

            {/* Para el lector de pantalla, que no ve el icono del botón cambiar. */}
            <span className="sr-only" aria-live="polite">
              {copiada ? 'Contraseña copiada' : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancelar
            </DialogClose>
            <BotonEnviar size="sm" pendiente="Poniéndola…" disabled={!valida}>
              Ponerla
            </BotonEnviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cierra la ventana cuando la action acaba.
 *
 * `ponerContrasena` siempre redirige a esta misma ficha, con `?ok=` o con
 * `?error=`, y en una navegación a la misma página React conserva este
 * componente y su estado: la ventana seguiría abierta, con la contraseña
 * dentro, encima del aviso que dice cómo ha ido. El envío pasa a «pendiente»
 * al pulsar y vuelve cuando la página nueva ya está pintada; ese regreso es
 * la señal. Mirar la URL no basta: dos errores iguales seguidos dejan la misma.
 */
function CerrarAlTerminar({ alTerminar }: { alTerminar: () => void }) {
  const { pending } = useFormStatus();
  const antes = useRef(false);

  useEffect(() => {
    if (antes.current && !pending) alTerminar();
    antes.current = pending;
  }, [pending, alTerminar]);

  return null;
}
