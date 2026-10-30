'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';

import { AvatarPersona } from '@/components/avatar-persona';
import { Button } from '@/components/ui/button';
import { quitarFoto, subirFoto } from '../actions';

/**
 * La cara de la cuenta, con «Cambiar» y «Quitar».
 *
 * Elegir la foto ya es enviarla: el formulario se manda solo al cambiar el
 * fichero. Un segundo botón de «Guardar» después de elegirla es un paso que en
 * el móvil se olvida, y la foto se quedaría sin subir sin que nadie lo note.
 */
export function FotoPerfil({
  nombre,
  correo,
  foto,
}: {
  nombre: string;
  correo: string;
  foto: string | null;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  return (
    <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
      <AvatarPersona nombre={nombre} fotoUrl={foto} tamano="lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[16px] font-bold tracking-[-0.018em]">{nombre}</span>
          <span className="truncate text-[13.5px] text-muted-foreground">{correo}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form ref={formulario} action={subirFoto}>
            <label
              className={
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-alt px-3.5 text-[13.5px] font-semibold hover:bg-surface-active focus-within:ring-3 focus-within:ring-ring/20 ' +
                (subiendo ? 'pointer-events-none opacity-60' : '')
              }
            >
              <Camera className="size-[16px]" strokeWidth={1.8} />
              {subiendo ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Añadir foto'}
              <input
                type="file"
                name="foto"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  if (!e.target.files?.length) return;
                  setSubiendo(true);
                  formulario.current?.requestSubmit();
                }}
              />
            </label>
          </form>

          {foto && (
            <form action={quitarFoto}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Quitar
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
