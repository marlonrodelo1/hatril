import Link from 'next/link';
import { Check } from 'lucide-react';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarcoEquipo } from '../../../_components/marco';
import { Insignia } from '../../../_components/insignia';
import { AREA } from '../../../_components/estilos';
import { crearTurno, planificarTurnos } from '../actions';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
/** Las mismas seis semanas que el panel. */
export const SEMANAS = 6;

export type DatosPlanificar = Awaited<ReturnType<typeof cargar>>;

export function VistaPlanificar({ id, error, ctx, ministerio, hoy, cultos, pendientes, base }: DatosPlanificar) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Planificar"
      subtitulo={ministerio.nombre}
      volver={base}
      error={error}
    >
      <form
        action={planificarTurnos.bind(null, id)}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="t-subtitulo">Las próximas {SEMANAS} semanas</h2>
          <p className="text-pretty text-label leading-relaxed text-muted-foreground">
            Marca los cultos en los que sirve el equipo. Después, en cada uno,
            pones a cada persona en su puesto.
          </p>
        </div>

        {cultos.length === 0 ? (
          // Un párrafo y no otra tarjeta: dentro de una tarjeta nada lleva 12.
          <p className="text-pretty text-body leading-relaxed text-muted-foreground">
            Tu iglesia todavía no tiene horarios semanales, así que no hay
            cultos que proponer. Los escribe el pastor en los ajustes de la
            iglesia. Mientras tanto, puedes crear un turno suelto aquí debajo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cultos.map((c) => {
              const clave = `${c.fecha}|${c.hora ?? ''}|${c.titulo}`;

              if (c.turnoId) {
                return (
                  <li key={clave}>
                    <Link
                      href={`${base}/${c.turnoId}`}
                      className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-muted-foreground no-underline hover:bg-surface-alt hover:no-underline"
                    >
                      <Check
                        className="size-4 flex-none text-badge-success-fg"
                        strokeWidth={1.8}
                        aria-hidden
                      />
                      <Linea fecha={c.fecha} hora={c.hora} titulo={c.titulo} hoy={hoy} />
                      <Insignia tono="exito">Ya está</Insignia>
                    </Link>
                  </li>
                );
              }

              return (
                <li key={clave}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 hover:bg-background has-checked:border-primary has-checked:bg-accent">
                    <input
                      type="checkbox"
                      name="cultos"
                      value={clave}
                      defaultChecked={c.destacado}
                      className="size-[18px] flex-none accent-primary"
                    />
                    <Linea fecha={c.fecha} hora={c.hora} titulo={c.titulo} hoy={hoy} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {pendientes.length > 0 && (
          <div>
            <Button type="submit">Añadir los marcados</Button>
          </div>
        )}
      </form>

      <form
        action={crearTurno.bind(null, id)}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="t-subtitulo">Un culto que no está en el horario</h2>
          <p className="text-label text-muted-foreground">
            Una vigilia, un culto especial, una boda.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titulo">Qué es</Label>
          <Input
            id="titulo"
            name="titulo"
            required
            maxLength={120}
            placeholder="Vigilia de fin de año"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="fecha">Día</Label>
            <Input id="fecha" name="fecha" type="date" required min={hoy} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="hora">
              Hora
              <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="hora" name="hora" type="time" />
          </div>
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
            maxLength={1000}
            placeholder="Llegar media hora antes para la prueba de sonido."
            className={AREA}
          />
        </div>
        <div>
          <Button type="submit" variant="outline">
            Crear el turno
          </Button>
        </div>
      </form>
    </MarcoEquipo>
  );
}
function Linea({
  fecha,
  hora,
  titulo,
  hoy,
}: {
  fecha: string;
  hora: string | null;
  titulo: string;
  hoy: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-body font-semibold text-foreground">
        {cuandoCorto(fecha, hora, hoy)}
      </span>
      <span className="truncate text-label text-muted-foreground">{titulo}</span>
    </span>
  );
}
