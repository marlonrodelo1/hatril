import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EntradaCronograma } from '@/lib/ninos/consultas';

const CLASE_TEXTAREA =
  'min-h-[120px] w-full rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[16px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px]';

const CLASE_SELECT =
  'h-[42px] w-full rounded-lg border border-input bg-surface-alt px-3 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px]';

/** Quién puede dar la clase: la responsable y los colíderes, que son los maestros. */
export function maestrosDe(
  equipo: { miembroId: string; nombre: string; rolEquipo: string }[],
): { miembroId: string; nombre: string }[] {
  return equipo
    .filter((i) => i.rolEquipo === 'responsable' || i.rolEquipo === 'colider')
    .map((i) => ({ miembroId: i.miembroId, nombre: i.nombre }));
}

/**
 * Los campos de una clase del cronograma, para apuntarla y para editarla.
 *
 * Inputs nativos (con `text-[16px]` en el móvil: por debajo, Safari amplía la
 * página al tocar el campo, el M1 del inventario visual). Los puntos van en
 * texto libre porque son del TEMA —«Valentía. Versículo: 1 Samuel 17:45»—,
 * nunca de un niño; la pantalla lo recuerda.
 */
export function CamposClase({
  maestros,
  hoy,
  entrada,
}: {
  maestros: { miembroId: string; nombre: string }[];
  hoy: string;
  entrada?: EntradaCronograma;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fecha">Día</Label>
          <Input id="fecha" name="fecha" type="date" required defaultValue={entrada?.fecha ?? hoy} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maestro">Quién la da</Label>
          <select
            id="maestro"
            name="maestro"
            defaultValue={entrada?.maestro?.miembroId ?? ''}
            className={CLASE_SELECT}
          >
            <option value="">Sin decidir</option>
            {maestros.map((m) => (
              <option key={m.miembroId} value={m.miembroId}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tema">Tema</Label>
        <Input
          id="tema"
          name="tema"
          required
          maxLength={120}
          defaultValue={entrada?.tema}
          placeholder="David y Goliat"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="puntos">Puntos de la clase</Label>
        <textarea
          id="puntos"
          name="puntos"
          maxLength={2000}
          rows={5}
          defaultValue={entrada?.puntos ?? ''}
          placeholder={'Valentía cuando tenemos miedo.\nVersículo: 1 Samuel 17:45.\nManualidad: la honda de papel.'}
          className={CLASE_TEXTAREA}
        />
        <p className="t-label text-muted-foreground">
          Del tema y de la clase, nunca de un niño en concreto.
        </p>
      </div>
    </>
  );
}
