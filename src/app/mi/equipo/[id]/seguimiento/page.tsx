import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Phone } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { personasPorFaltas } from '@/lib/seguimiento/consultas';
import { RESULTADOS } from '@/lib/seguimiento/catalogos';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/seguimiento/constantes';
import { MarcoEquipo, Vacio } from '../../_components/marco';

export const metadata: Metadata = { title: 'Seguimiento' };

/**
 * A quién llamar, desde el móvil.
 *
 * La lista es `personasPorFaltas`, la del panel: quien negó el permiso de
 * asistencia no sale, y el orden es el suyo —quien más se ha perdido, primero—.
 * La guarda (`requireMinisterioEnLaApp(id, 'seguimiento')`) pide además
 * `ver_seguimiento` a través del adaptador, la misma puerta de más que el
 * `layout.tsx` del panel.
 *
 * EL TELÉFONO, A UN TOQUE Y FUERA DE LA FILA
 * ------------------------------------------
 * Cada fila lleva a la ficha, y el teléfono es un botón aparte a su derecha:
 * un enlace `tel:` dentro de otro enlace no es HTML válido, y en el móvil el
 * toque acabaría en uno o en otro según dónde caiga el dedo. Llamar primero y
 * apuntar después es el orden real, así que el botón está en la lista y no
 * solo en la ficha.
 */
export default async function SeguimientoEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'seguimiento');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const personas = await personasPorFaltas(ctx, id);
  const ausentes = personas.filter((p) => p.faltasSeguidas > 0);
  const base = rutaApp(id, 'seguimiento');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Seguimiento"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      {ausentes.length === 0 ? (
        <Vacio>
          <p>
            {personas.length === 0
              ? 'No hay nadie en el fichero todavía.'
              : 'Nadie se ha perdido ninguna de las reuniones en las que se pasó lista. Si te sorprende, puede que falte apuntar algún culto.'}
          </p>
        </Vacio>
      ) : (
        <>
          <p className="px-1 text-[14px] text-muted-foreground">
            {ausentes.length}{' '}
            {ausentes.length === 1 ? 'persona se ha' : 'personas se han'} perdido
            alguna reunión.
          </p>

          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {ausentes.map((p) => (
              <li key={p.miembroId} className="flex items-stretch">
                <Link
                  href={`${base}/${p.miembroId}`}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-foreground no-underline hover:bg-surface-alt hover:no-underline"
                >
                  <span
                    className={`flex size-10 flex-none items-center justify-center rounded-full text-[12px] font-bold ${ESTADOS[p.estado].avatar}`}
                  >
                    {iniciales(p.nombre)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold tracking-[-0.012em]">
                      {p.nombre}
                    </span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {p.faltasSeguidas}{' '}
                      {p.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} sin venir
                      {p.ultimaAsistencia
                        ? ` · vino el ${diaCorto(p.ultimaAsistencia, hoy).toLocaleLowerCase('es')}`
                        : ''}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      {p.acompana ? (
                        <span>Le acompaña {p.acompana.nombre}</span>
                      ) : (
                        // Sin color de alarma: que nadie la acompañe todavía es
                        // lo normal el primer día, no un fallo.
                        <span className="rounded-md border border-dashed border-border px-1.5 py-px font-semibold">
                          Sin asignar
                        </span>
                      )}
                      {p.ultimoContacto && (
                        <span
                          className={`rounded px-1.5 py-px font-semibold ${RESULTADOS[p.ultimoContacto.resultado].badge}`}
                        >
                          {RESULTADOS[p.ultimoContacto.resultado].etiqueta}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 flex-none text-disabled-text"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                </Link>
                {p.telefono && (
                  <a
                    href={`tel:${p.telefono}`}
                    aria-label={`Llamar a ${p.nombre}`}
                    className="flex w-14 flex-none items-center justify-center border-l border-border text-foreground no-underline hover:bg-surface-alt hover:no-underline"
                  >
                    <Phone className="size-5" strokeWidth={1.8} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </MarcoEquipo>
  );
}
