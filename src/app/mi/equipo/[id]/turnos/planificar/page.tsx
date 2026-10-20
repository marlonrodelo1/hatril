import Link from 'next/link';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { cultosParaPlanificar } from '@/lib/turnos/consultas';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarcoEquipo, Vacio } from '../../../_components/marco';
import { AREA, CAMPO } from '../../../_components/estilos';
import { crearTurno, planificarTurnos } from '../actions';

export const metadata: Metadata = { title: 'Planificar turnos' };

/** Las mismas seis semanas que el panel. */
const SEMANAS = 6;

/**
 * En qué cultos de las próximas semanas sirve el equipo.
 *
 * Salen del horario de la iglesia con `cultosParaPlanificar`, la consulta del
 * panel, y vienen marcados los que el pastor señaló como destacados. Los que ya
 * tienen turno se enseñan también, con su enlace: ver el domingo como «ya
 * planificado» contesta por qué no se puede marcar.
 *
 * El naranja es «Añadir los marcados», que es lo que se viene a hacer. El
 * culto suelto va debajo en contorno.
 */
export default async function PlanificarEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'turnos');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const cultos = await cultosParaPlanificar(
    ctx,
    id,
    hoy,
    sumarDias(hoy, SEMANAS * 7 - 1),
  );
  const pendientes = cultos.filter((c) => !c.turnoId);
  const base = rutaApp(id, 'turnos');

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
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Las próximas {SEMANAS} semanas</h2>
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Marca los cultos en los que sirve el equipo. Después, en cada uno,
            pones a cada persona en su puesto.
          </p>
        </div>

        {cultos.length === 0 ? (
          <Vacio>
            <p>
              Tu iglesia todavía no tiene horarios semanales, así que no hay
              cultos que proponer. Los escribe el pastor en los ajustes de la
              iglesia. Mientras tanto, puedes crear un turno suelto aquí debajo.
            </p>
          </Vacio>
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
                        strokeWidth={2.2}
                        aria-hidden
                      />
                      <Linea fecha={c.fecha} hora={c.hora} titulo={c.titulo} hoy={hoy} />
                      <span className="flex-none text-[12.5px] font-semibold">
                        Ya está
                      </span>
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
                      className="size-[18px] flex-none"
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
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Un culto que no está en el horario</h2>
          <p className="text-[14px] text-muted-foreground">
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
            className={CAMPO}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="fecha">Día</Label>
            <Input id="fecha" name="fecha" type="date" required min={hoy} className={CAMPO} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="hora">Hora</Label>
            <Input id="hora" name="hora" type="time" className={CAMPO} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notas">Para el equipo</Label>
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
      <span className="text-[14.5px] font-semibold text-foreground">
        {cuandoCorto(fecha, hora, hoy)}
      </span>
      <span className="truncate text-[13px] text-muted-foreground">{titulo}</span>
    </span>
  );
}
