'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

import { enlaceWhatsappConTexto } from '@/lib/telefono/enlaces';
import { buttonVariants } from '@/components/ui/button';

/**
 * «Escribir a la célula»: el mensaje ya redactado y un botón que abre WhatsApp
 * con él.
 *
 * Lo pidió Marlon el 23-nov: que el líder pueda escribir a todos los de su
 * célula desde aquí. WhatsApp no deja mandar un mensaje a varios números desde
 * fuera sin su API de pago, así que se abre con el texto y sin destinatario, y
 * ahí se elige el grupo que la célula ya tiene —o varias personas—. Lo dice la
 * pantalla, para que nadie espere otra cosa.
 *
 * No se guarda nada: el texto vive en el teléfono hasta que sale por WhatsApp.
 */
export function EscribirALaCelula({ inicial, grupo }: { inicial: string; grupo: string }) {
  const [texto, setTexto] = useState(inicial);
  const vacio = texto.trim().length === 0;

  return (
    <section
      id="escribir"
      className="flex scroll-mt-20 flex-col gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">Escribir a la célula</h2>
        <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">
          Se abre WhatsApp con el mensaje: elige el grupo de {grupo} o a varias
          personas. Desde fuera de WhatsApp no se puede mandar a todos de una vez.
        </p>
      </div>
      <label htmlFor="mensaje-celula" className="sr-only">
        Mensaje para la célula
      </label>
      <textarea
        id="mensaje-celula"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        maxLength={600}
        className="w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16 md:text-[15px]"
      />
      {/* Un `<a>` y no un botón: es un enlace de fuera, que el WebView de la
          app entrega al sistema y abre WhatsApp. Sin texto no lleva a nada. */}
      <a
        href={vacio ? undefined : enlaceWhatsappConTexto(texto.trim())}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={vacio || undefined}
        className={buttonVariants({
          variant: 'outline',
          className: vacio ? 'pointer-events-none w-fit opacity-50' : 'w-fit',
        })}
      >
        <MessageCircle strokeWidth={1.8} aria-hidden />
        Abrir WhatsApp
      </a>
    </section>
  );
}
