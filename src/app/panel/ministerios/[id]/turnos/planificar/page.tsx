import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { cultosParaPlanificar } from '@/lib/turnos/consultas';
import { sumarDias } from '@/lib/agenda/horarios';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { crearTurno, planificarTurnos } from '../actions';

export const metadata: Metadata = { title: 'Planificar turnos' };

/** Seis semanas: lo que un responsable planifica de una sentada. */
const SEMANAS = 6;

/**
 * Elegir en qué cultos sirve el equipo.
 *
 * SALEN DEL HORARIO, NO DE UN FORMULARIO EN BLANCO
 * ------------------------------------------------
 * Los cultos de la iglesia ya están escritos en su horario semanal, y pedirle al
 * responsable que teclee «domingo 19, 11:00, Culto» cinco veces al mes es
 * pedirle que lo copie mal una de ellas. Aquí se marcan con un dedo. Lo que no
 * está en el horario —una vigilia, un culto especial— va en el formulario de
 * abajo.
 *
 * Viene marcado de salida el culto que la iglesia tiene como DESTACADO, que
 * suele ser el del domingo. El resto, sin marcar: un equipo de alabanza no
 * sirve en la reunión de jóvenes del martes, y que aparezca marcada obligaría a
 * desmarcarla cada vez.
 */
export default async function PlanificarTurnosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const hasta = sumarDias(hoy, SEMANAS * 7 - 1);
  const cultos = await cultosParaPlanificar(ctx, id, hoy, hasta);

  const base = `/panel/ministerios/${id}/turnos`;
  const pendientes = cultos.filter((c) => !c.turnoId);

  return (
    <>
      <CabeceraPanel
        titulo="Planificar turnos"
        volver={{ href: base, texto: ministerio.nombre }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <form
          action={planificarTurnos.bind(null, id)}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Cultos de las próximas {SEMANAS} semanas</h2>
            <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
              Marca aquellos en los que sirve el equipo. Después, en cada uno,
              pones a cada persona en su puesto.
            </p>
          </div>

          {cultos.length === 0 ? (
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              Tu iglesia todavía no tiene horarios semanales, así que no hay
              cultos que proponer.{' '}
              {esPastor(ctx) ? (
                <>
                  Escríbelos en{' '}
                  <Link href="/panel/ajustes" className="underline">
                    Ajustes
                  </Link>{' '}
                  y aparecerán aquí.
                </>
              ) : (
                'Los escribe el pastor en los ajustes de la iglesia.'
              )}{' '}
              Mientras tanto, puedes crear un turno suelto con el formulario de
              abajo.
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
                        className="flex items-center gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-muted-foreground no-underline hover:bg-surface-alt hover:no-underline"
                      >
                        <Check className="size-4 flex-none text-badge-success-fg" strokeWidth={2.2} aria-hidden />
                        <LineaCulto fecha={c.fecha} hora={c.hora} titulo={c.titulo} />
                        <span className="flex-none text-[12.5px] font-semibold">
                          Ya planificado
                        </span>
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={clave}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 hover:bg-background has-checked:border-primary has-checked:bg-accent">
                      <input
                        type="checkbox"
                        name="cultos"
                        value={clave}
                        defaultChecked={c.destacado}
                        className="flex-none"
                      />
                      <LineaCulto fecha={c.fecha} hora={c.hora} titulo={c.titulo} />
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
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Un culto que no está en el horario</h2>
            <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
              Una vigilia, un culto especial, una boda.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Qué es</Label>
            <Input id="titulo" name="titulo" required maxLength={120} placeholder="Vigilia de fin de año" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fecha">Día</Label>
              <Input id="fecha" name="fecha" type="date" required min={hoy} defaultValue={hoy} />
            </div>
            <div className="flex flex-col gap-1.5">
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
              placeholder="Llegar a las 21:30 para la prueba de sonido."
              className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            />
          </div>

          <div>
            <Button type="submit" variant="outline">
              Crear el turno
            </Button>
          </div>
        </form>
      </Contenedor>
    </>
  );
}

function LineaCulto({
  fecha,
  hora,
  titulo,
}: {
  fecha: string;
  hora: string | null;
  titulo: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
      <span className="text-[14.5px] font-semibold first-letter:uppercase">
        {formatearFechaLarga(fecha)}
      </span>
      <span className="truncate text-[13.5px] text-muted-foreground">
        {hora && `${hora} · `}
        {titulo}
      </span>
    </span>
  );
}
