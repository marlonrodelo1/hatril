import Link from 'next/link';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLORES_MINISTERIO } from '@/lib/ministerios/colores';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';

/**
 * Alta y edición de un ministerio.
 *
 * EL RESPONSABLE SOLO APARECE AL EDITAR
 * -------------------------------------
 * Y solo si ya hay equipo. Al crear no se puede elegir: la lista de candidatos
 * son los integrantes, y un ministerio recién creado no tiene ninguno. Enseñar
 * un desplegable vacío en el alta obliga a explicar por qué está vacío; no
 * enseñarlo no obliga a nada.
 */
export function FormularioMinisterio({
  accion,
  ministerio,
  integrantes,
  error,
}: {
  accion: (formData: FormData) => Promise<void>;
  ministerio?: MinisterioDetalle;
  integrantes?: { id: string; nombre: string; apellidos: string | null }[];
  error?: string;
}) {
  const colorActual = ministerio?.colorHex ?? COLORES_MINISTERIO[0].hex;

  return (
    <form action={accion} className="flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Nombre del ministerio</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            autoFocus
            maxLength={80}
            defaultValue={ministerio?.nombre}
            placeholder="Alabanza"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descripcion">
            Qué hace
            <span className="ml-1.5 font-normal text-muted-foreground">
              (opcional)
            </span>
          </Label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            maxLength={400}
            defaultValue={ministerio?.descripcion ?? ''}
            placeholder="Música y canto en los cultos del domingo. Ensayo los jueves a las 19:30."
            className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
          />
        </div>

        {/*
         * Cinco colores fijos y no un selector libre. El porqué está en
         * `lib/ministerios/colores.ts`: cada color lleva su pareja suave para
         * el fondo, y con un color arbitrario esa pareja habría que inventarla.
         *
         * Radios nativos: viajan en el FormData sin JavaScript de por medio, y
         * el teclado los recorre con las flechas por ser un mismo `name`.
         */}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="t-label mb-2.5">Color de la etiqueta</legend>
          <div className="flex flex-wrap gap-2.5">
            {COLORES_MINISTERIO.map((c) => (
              <label
                key={c.hex}
                className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface-alt px-3 py-2.5 text-[14px] font-medium has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground"
              >
                <input
                  type="radio"
                  name="colorHex"
                  value={c.hex}
                  defaultChecked={c.hex === colorActual}
                  className="sr-only"
                />
                <span
                  className="flex size-7 items-center justify-center rounded-lg"
                  style={{ background: c.suave }}
                >
                  <span
                    className="size-3 rounded-sm"
                    style={{ background: c.hex }}
                  />
                </span>
                {c.nombre}
              </label>
            ))}
          </div>
        </fieldset>

        {ministerio && integrantes && integrantes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="liderMiembroId">Responsable</Label>
            <select
              id="liderMiembroId"
              name="liderMiembroId"
              defaultValue={ministerio.lider?.id ?? ''}
              className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            >
              <option value="">Sin responsable</option>
              {integrantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.nombre, p.apellidos].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
            <p className="t-label text-muted-foreground">
              Solo puedes elegir a alguien que ya esté en el equipo.
            </p>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit">
          {ministerio ? 'Guardar los cambios' : 'Crear el ministerio'}
        </Button>
        <Button
          variant="ghost"
          render={
            <Link
              href={
                ministerio
                  ? `/panel/ministerios/${ministerio.id}`
                  : '/panel/ministerios'
              }
            />
          }
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
