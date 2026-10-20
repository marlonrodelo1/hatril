import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Cancion } from '@/lib/repertorio/consultas';
import { AREA } from '../../../_components/estilos';

/**
 * Una canción del repertorio, para apuntarla o corregirla desde el móvil.
 *
 * Los mismos campos que `FormularioCancion` del panel, porque la action es la
 * misma. No se reutiliza aquel tal cual porque su «Cancelar» es un
 * `<Button render={<Link/>}>`, que la guía visual descarta —Base UI avisa en
 * consola y le pone `type="button"` a un enlace—, y aquí ya hay flecha de
 * volver. Lo que sí se mantiene es el aviso de derechos: Hatril enlaza, no
 * guarda letras ni acordes.
 */
export function FormularioCancion({
  accion,
  cancion,
  texto,
}: {
  accion: (formData: FormData) => Promise<void>;
  cancion?: Cancion;
  texto: string;
}) {
  return (
    <form
      action={accion}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          maxLength={120}
          defaultValue={cancion?.titulo}
          placeholder="Cuán grande es Él"
        />
      </div>

      <div className="grid grid-cols-[1fr_96px] gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="autor">Quién la canta</Label>
          <Input
            id="autor"
            name="autor"
            maxLength={120}
            defaultValue={cancion?.autor ?? ''}
            placeholder="Marcos Witt"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="tono">Tono</Label>
          <Input
            id="tono"
            name="tono"
            maxLength={12}
            defaultValue={cancion?.tono ?? ''}
            placeholder="G, Re…"
          />
        </div>
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
          placeholder="La página de acordes o el PDF del Drive"
        />
        <p className="t-label text-pretty text-muted-foreground">
          Pega el enlace tal cual. Hatril no guarda letras ni acordes: casi todo
          lo que se canta tiene derechos de autor, así que se enlaza a donde ya
          está.
        </p>
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
          placeholder="Empezar por el coro."
          className={AREA}
        />
      </div>

      <div>
        <Button type="submit">{texto}</Button>
      </div>
    </form>
  );
}
