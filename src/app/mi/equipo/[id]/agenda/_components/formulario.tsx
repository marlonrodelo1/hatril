import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReunionDetalle } from '@/lib/asistencia/consultas';
import { AREA } from '../../../_components/estilos';

/**
 * El formulario de una reunión del equipo: un ensayo, una reunión, una salida.
 *
 * Los mismos campos que el del panel —la action que lo recibe es la misma—,
 * dentro de un bloque y en una columna en el móvil, como pide la guía. Lo
 * obligatorio no se marca; lo opcional, sí.
 */
export function FormularioReunion({
  accion,
  reunion,
  hoy,
  texto,
}: {
  accion: (formData: FormData) => Promise<void>;
  reunion?: ReunionDetalle;
  hoy: string;
  texto: string;
}) {
  return (
    <form
      action={accion}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titulo">Qué es</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          maxLength={120}
          defaultValue={reunion?.titulo ?? ''}
          placeholder="Ensayo del jueves"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="fecha">Día</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            required
            defaultValue={reunion?.fecha ?? hoy}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="hora">
            Hora
            <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="hora"
            name="hora"
            type="time"
            defaultValue={reunion?.hora?.slice(0, 5) ?? ''}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lugar">
          Dónde
          <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="lugar"
          name="lugar"
          maxLength={160}
          defaultValue={reunion?.lugar ?? ''}
          placeholder="Salón de abajo"
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
          rows={3}
          maxLength={2000}
          defaultValue={reunion?.notas ?? ''}
          placeholder="Traed las partituras del domingo."
          className={AREA}
        />
      </div>

      <div>
        <Button type="submit">{texto}</Button>
      </div>
    </form>
  );
}
