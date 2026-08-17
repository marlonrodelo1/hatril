'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/format/iniciales';
import { publicar } from '../actions';
import { MAX_IMAGENES } from '@/lib/comunidad/limites';

/**
 * Escribir en el muro.
 *
 * ES UN `<form>` DE VERDAD
 * ------------------------
 * Con `action={publicar}`, una server action. Sin `fetch`, sin estado de envío
 * a mano y sin JavaScript para lo esencial: si el navegador tarda en hidratar
 * —un móvil viejo con mala cobertura, que es la mitad de esta congregación— el
 * formulario ya funciona.
 *
 * El JavaScript de este componente solo sirve para dos comodidades: enseñar las
 * fotos elegidas antes de enviar y poder quitar alguna. Si no llega a cargar,
 * se publica igual.
 */
export function Publicador({ nombre }: { nombre: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [previas, setPrevias] = useState<{ url: string; nombre: string }[]>([]);

  function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheros = Array.from(e.target.files ?? []);
    // `URL.createObjectURL` y no un `FileReader` con base64: el objeto apunta al
    // fichero que ya está en memoria, así que una foto de 4 MB no se convierte
    // en 5,5 MB de texto dentro del DOM.
    setPrevias(
      ficheros.slice(0, MAX_IMAGENES).map((f) => ({
        url: URL.createObjectURL(f),
        nombre: f.name,
      })),
    );
  }

  function quitarTodas() {
    for (const p of previas) URL.revokeObjectURL(p.url);
    setPrevias([]);
    if (entrada.current) entrada.current.value = '';
  }

  return (
    <form
      ref={formulario}
      action={async (formData) => {
        await publicar(formData);
        formulario.current?.reset();
        quitarTodas();
      }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
          {iniciales(nombre)}
        </span>

        <textarea
          name="texto"
          rows={2}
          maxLength={3000}
          placeholder="¿Qué quieres compartir con la iglesia?"
          className="min-h-[62px] flex-1 resize-y rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
      </div>

      {previas.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-12">
          {previas.map((p) => (
            <span
              key={p.url}
              className="relative size-20 overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.nombre}
                className="size-full object-cover"
              />
            </span>
          ))}

          <button
            type="button"
            onClick={quitarTodas}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:bg-background"
          >
            <X className="size-4" strokeWidth={1.8} />
            Quitar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pl-12">
        <input
          ref={entrada}
          id="imagenes-publicacion"
          type="file"
          name="imagenes"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={alElegir}
          className="sr-only"
        />

        {/* La etiqueta hace de botón: el input de fichero nativo no se puede
            estilar y su texto lo pone el navegador, en el idioma del sistema. */}
        <label
          htmlFor="imagenes-publicacion"
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-alt px-3.5 text-[13.5px] font-semibold text-foreground hover:bg-background"
        >
          <ImagePlus className="size-[17px]" strokeWidth={1.8} />
          Fotos
        </label>

        <span className="text-[12.5px] text-muted-foreground">
          hasta {MAX_IMAGENES}
        </span>

        <span className="flex-1" />

        <Button type="submit">Publicar</Button>
      </div>
    </form>
  );
}
