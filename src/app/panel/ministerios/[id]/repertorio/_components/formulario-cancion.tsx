import Link from 'next/link';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Cancion } from '@/lib/repertorio/consultas';

/**
 * Alta y edición de una canción.
 *
 * Dos enlaces y no uno, porque son dos usos distintos que el músico abre en
 * momentos distintos: el de escuchar, para aprendérsela el martes; el de los
 * acordes, abierto en el atril el domingo. Juntos en un campo, siempre se acaba
 * pegando uno y el otro se busca en el grupo de WhatsApp.
 *
 * Ni letra ni acordes dentro: ver la cabecera de `canciones` en el schema.
 */
export function FormularioCancion({
  accion,
  cancion,
  error,
  cancelarHref,
}: {
  accion: (formData: FormData) => Promise<void>;
  cancion?: Cancion;
  error?: string;
  cancelarHref: string;
}) {
  return (
    <form action={accion} className="flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            name="titulo"
            required
            maxLength={120}
            autoFocus={!cancion}
            defaultValue={cancion?.titulo}
            placeholder="Cuán grande es Él"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="autor">
              Quién la canta
              <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="autor"
              name="autor"
              maxLength={120}
              defaultValue={cancion?.autor ?? ''}
              placeholder="Marcos Witt"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tono">
              Tono
              <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="tono"
              name="tono"
              maxLength={12}
              defaultValue={cancion?.tono ?? ''}
              placeholder="G, Re…"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Dónde está</h2>
          <p className="t-label text-pretty text-muted-foreground">
            Pega el enlace tal cual. Hatril no guarda letras ni acordes: casi
            todo lo que se canta tiene derechos de autor, así que se enlaza a
            donde ya está.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enlaceAudio">Para escucharla</Label>
          <Input
            id="enlaceAudio"
            name="enlaceAudio"
            type="text"
            inputMode="url"
            maxLength={500}
            defaultValue={cancion?.enlaceAudio ?? ''}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enlacePartitura">Acordes, letra o partitura</Label>
          <Input
            id="enlacePartitura"
            name="enlacePartitura"
            type="text"
            inputMode="url"
            maxLength={500}
            defaultValue={cancion?.enlacePartitura ?? ''}
            placeholder="La página de acordes o el PDF del Drive del equipo"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notas">
            Para el equipo
            <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            maxLength={500}
            defaultValue={cancion?.notas ?? ''}
            placeholder="Empezar por el coro. Bajar medio tono si la dirige Marta."
            className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit">
          {cancion ? 'Guardar los cambios' : 'Añadir al repertorio'}
        </Button>
        <Button variant="ghost" render={<Link href={cancelarHref} />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
