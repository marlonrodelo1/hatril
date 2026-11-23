'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/button';

/**
 * Un dato de contacto con su botón de copiar: el correo del pastor, el de la
 * iglesia, el teléfono. Lo que se hace con ellos es pegarlos en otro sitio (el
 * correo, WhatsApp), y seleccionar un correo a mano en un móvil es la mitad
 * de las veces seleccionar también el espacio de al lado.
 */
export function Copiable({
  valor,
  que,
}: {
  valor: string;
  /** «el correo», «el teléfono»: para el botón y para lo que se anuncia. */
  que: string;
}) {
  const [estado, setEstado] = useState<'copiado' | 'fallo' | null>(null);
  const texto = useRef<HTMLSpanElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copiar y salir de la página antes del segundo y medio dejaría un setState
  // apuntando a un componente que ya no existe.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  function marcar(nuevo: 'copiado' | 'fallo') {
    setEstado(nuevo);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado(null), 1500);
  }

  /** El camino viejo, sobre un campo de texto fuera de la vista. */
  function copiarALaAntigua(): boolean {
    const campo = document.createElement('textarea');
    campo.value = valor;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    let hecho = false;
    try {
      hecho = document.execCommand('copy');
    } catch {
      hecho = false;
    }
    campo.remove();
    return hecho;
  }

  /** Si nada copia, el dato queda seleccionado para Ctrl+C. */
  function seleccionar(): 'fallo' {
    const el = texto.current;
    if (el) window.getSelection()?.selectAllChildren(el);
    return 'fallo';
  }

  function sinPortapapeles() {
    marcar(copiarALaAntigua() ? 'copiado' : seleccionar());
  }

  function copiar() {
    // `writeText` se llama aquí mismo, dentro del clic, sin nada esperado
    // antes: fuera de un gesto de la persona el navegador lo rechaza. Sin
    // portapapeles (contexto no seguro, un WebView capado) se prueba el camino
    // viejo.
    let escribir: Promise<void> | undefined;
    try {
      escribir = navigator.clipboard?.writeText(valor);
    } catch {
      escribir = undefined;
    }
    if (!escribir) {
      sinPortapapeles();
      return;
    }
    escribir.then(() => marcar('copiado'), sinPortapapeles);
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span ref={texto} className="min-w-0 truncate text-body select-all">
        {valor}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={copiar}
        aria-label={`Copiar ${que}`}
        className={clsx(
          'flex-none',
          estado === 'copiado' &&
            'border-transparent bg-badge-success-bg text-badge-success-fg hover:bg-badge-success-bg',
          estado === 'fallo' && 'text-danger',
        )}
      >
        {estado === 'copiado' ? (
          <Check className="anim-aparece size-4" strokeWidth={1.8} />
        ) : estado === 'fallo' ? (
          <CircleAlert className="anim-aparece size-4" strokeWidth={1.8} />
        ) : (
          <Copy className="size-4" strokeWidth={1.8} />
        )}
      </Button>
      {/* Lo que pasó, para quien no ve el icono cambiar. */}
      <span role="status" className="sr-only">
        {estado === 'copiado'
          ? `Se ha copiado ${que}`
          : estado === 'fallo'
            ? `No se ha podido copiar ${que}. Está seleccionado: cópialo con el teclado.`
            : ''}
      </span>
    </span>
  );
}
