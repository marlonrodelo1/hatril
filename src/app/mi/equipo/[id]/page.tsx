import type { Metadata } from 'next';
import { CircleCheck, TriangleAlert } from 'lucide-react';

import {
  ministeriosQueLlevoEnLaApp,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import {
  tarjetasDeLaPortada,
  totalPendientes,
} from '@/lib/ministerios/en-la-app/portada';
import { RAIZ_APP } from '@/lib/ministerios/en-la-app/rutas';
import type { RolEquipo } from '@/lib/db/schema/enums';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { iniciales } from '@/lib/format/iniciales';
import { MarcoEquipo, Vacio } from '../_components/marco';
import { TarjetaModulo } from '../_components/tarjeta-modulo';

export const metadata: Metadata = { title: 'Equipo' };

const ROL: Record<RolEquipo, string> = {
  responsable: 'Responsable',
  colider: 'Colíder',
  voluntario: 'Voluntario',
};

/**
 * La portada de un ministerio en la app: lo que pide atención, módulo a módulo.
 *
 * Se monta entera a partir de `modulosActivos()` y del adaptador de cada
 * módulo (`lib/ministerios/en-la-app/registro.ts`). Esta pantalla no sabe qué
 * es un turno: si el pastor enciende el repertorio, aparece su tarjeta; si
 * mañana se fusiona el reparto, aparece la suya.
 *
 * Arriba, una sola línea con el total: la pregunta con la que se abre esto el
 * sábado por la noche es «¿falta algo para mañana?», y tiene que contestarse
 * sin bajar.
 */
export default async function PortadaMinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const tarjetas = await tarjetasDeLaPortada(ctx, ministerio, hoy);
  const total = totalPendientes(tarjetas);

  const yo = ministerio.equipo.find((p) => p.miembroId === ctx.miembroId);
  // El pastor puede abrir cualquier ministerio sin estar en su equipo.
  const comoQue = yo ? ROL[yo.rolEquipo] : 'Pastor';

  // La flecha solo si hay a dónde volver: con un ministerio, esta ES la
  // pestaña, y volver a la lista rebotaría aquí mismo.
  const varios = ministeriosQueLlevoEnLaApp(ctx).length > 1;

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={ministerio.nombre}
      subtitulo={`${comoQue} · ${ctx.iglesia.nombre}`}
      volver={varios ? RAIZ_APP : undefined}
      error={error}
    >
      {tarjetas.length === 0 ? (
        <Vacio>
          <p>
            Este ministerio no tiene ninguna herramienta encendida. Las enciende
            el pastor desde «Módulos», en el panel, y en cuanto lo haga
            aparecerán aquí.
          </p>
        </Vacio>
      ) : (
        <>
          <p
            className={
              'flex items-center gap-2 px-1 text-[14.5px] font-semibold ' +
              (total > 0 ? 'text-badge-warning-fg' : 'text-badge-success-fg')
            }
          >
            {total > 0 ? (
              <TriangleAlert className="size-4 flex-none" strokeWidth={2} aria-hidden />
            ) : (
              <CircleCheck className="size-4 flex-none" strokeWidth={2} aria-hidden />
            )}
            {total === 0
              ? 'Todo en orden'
              : total === 1
                ? 'Una cosa pide atención'
                : `${total} cosas piden atención`}
          </p>

          {tarjetas.map((t) => (
            <TarjetaModulo key={t.modulo.id} tarjeta={t} />
          ))}
        </>
      )}

      {/*
       * El equipo, plegado. No pide atención y no se gestiona aquí —sumar gente
       * y nombrar colíderes sigue en el panel—, pero es la pregunta que viene
       * detrás de «falta el bajista»: ¿quién más toca el bajo?
       */}
      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-[15px] font-semibold marker:hidden">
          <span className="flex-1">El equipo</span>
          <span className="text-[13.5px] font-medium text-muted-foreground">
            {ministerio.equipo.length}{' '}
            {ministerio.equipo.length === 1 ? 'persona' : 'personas'}
          </span>
        </summary>
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {ministerio.equipo.map((p) => (
            <li key={p.vinculoId} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                {iniciales(p.nombre)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14.5px] font-medium">{p.nombre}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {[p.rolEquipo !== 'voluntario' ? ROL[p.rolEquipo] : null, p.rolEnMinisterio]
                    .filter(Boolean)
                    .join(' · ') || ROL.voluntario}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </MarcoEquipo>
  );
}
