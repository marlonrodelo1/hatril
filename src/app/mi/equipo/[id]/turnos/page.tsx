import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, CircleCheck, TriangleAlert } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarTurnos } from '@/lib/turnos/consultas';
import { estadoDeTurno, textoDelEstado } from '@/lib/turnos/en-la-app';
import { puestosDelMinisterio } from '@/lib/turnos/puestos';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Button } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/turnos/constantes';
import {
  FilaEnlace,
  Lista,
  MarcoEquipo,
  Rotulo,
  Vacio,
} from '../../_components/marco';

export const metadata: Metadata = { title: 'Turnos' };

/**
 * Los turnos del equipo, en la app.
 *
 * VERSIÓN DE APP Y NO LA DEL PANEL DENTRO DEL MARCO
 * -------------------------------------------------
 * La del panel se ve bien a 375 px, pero cada fila está pensada para el ancho:
 * fecha a la izquierda, gente en medio, insignias a la derecha. En el móvil lo
 * que hay que leer de cada culto es una sola cosa —¿le falta algo?—, así que
 * aquí cada fila dice eso en una línea, con las mismas cuentas que la portada
 * (`estadoDeTurno`). Las consultas son las del panel, sin copiar ninguna.
 *
 * Los cinco anteriores, como en el panel, para copiar de ellos o mirar quién
 * fue: plegados, que no son lo que se viene a hacer.
 */
export default async function TurnosEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'turnos');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const puestos = puestosDelMinisterio(ministerio);
  const base = rutaApp(id, 'turnos');

  const [proximos, anteriores] = await Promise.all([
    listarTurnos(ctx, id, { desde: hoy, orden: 'asc', limite: 30 }),
    listarTurnos(ctx, id, { hasta: sumarDias(hoy, -1), orden: 'desc', limite: 5 }),
  ]);

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Turnos"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <Button className="self-start" render={<Link href={`${base}/planificar`} />}>
        <CalendarPlus strokeWidth={1.8} />
        Planificar cultos
      </Button>

      <Rotulo>Próximos</Rotulo>
      {proximos.length === 0 ? (
        <Vacio>
          <p>
            No hay turnos por delante. Marca en qué cultos de las próximas
            semanas sirve el equipo y después pon a cada persona en su puesto: a
            quien tenga la aplicación le llega el aviso y confirma desde su
            agenda.
          </p>
        </Vacio>
      ) : (
        <Lista>
          {proximos.map((t) => {
            const estado = estadoDeTurno(t, puestos);
            const texto = textoDelEstado(estado);
            const urgente = estado.huecos.length > 0 || estado.noPueden.length > 0;
            const Icono = texto ? TriangleAlert : CircleCheck;

            return (
              <li key={t.id}>
                <FilaEnlace href={`${base}/${t.id}`}>
                  <span className="text-[15px] font-bold tracking-[-0.012em]">
                    {cuandoCorto(t.fecha, t.hora, hoy)}
                  </span>
                  <span className="truncate text-[13.5px] text-muted-foreground">
                    {t.titulo}
                  </span>
                  <span
                    className={
                      'flex items-start gap-1.5 text-[13px] leading-snug ' +
                      (!texto
                        ? 'text-badge-success-fg'
                        : urgente
                          ? 'text-badge-warning-fg'
                          : 'text-muted-foreground')
                    }
                  >
                    <Icono className="mt-px size-3.5 flex-none" strokeWidth={2.1} aria-hidden />
                    {texto ?? 'Todo cubierto y confirmado'}
                  </span>
                </FilaEnlace>
              </li>
            );
          })}
        </Lista>
      )}

      {anteriores.length > 0 && (
        <details className="rounded-xl border border-border bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-[15px] font-semibold marker:hidden">
            Los últimos {anteriores.length}
          </summary>
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {anteriores.map((t) => (
              <li key={t.id}>
                <FilaEnlace href={`${base}/${t.id}`}>
                  <span className="text-[14.5px] font-semibold">
                    {cuandoCorto(t.fecha, t.hora, hoy)}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {t.titulo} · {new Set(t.personas.map((p) => p.miembroId)).size}{' '}
                    {new Set(t.personas.map((p) => p.miembroId)).size === 1
                      ? 'persona'
                      : 'personas'}
                  </span>
                </FilaEnlace>
              </li>
            ))}
          </ul>
        </details>
      )}
    </MarcoEquipo>
  );
}
