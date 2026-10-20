import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Phone } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { personasPorFaltas } from '@/lib/seguimiento/consultas';
import { RESULTADOS } from '@/lib/seguimiento/catalogos';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { AvatarPersona } from '@/components/avatar-persona';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/seguimiento/constantes';
import {
  Fila,
  Lista,
  MarcoEquipo,
  Seccion,
  Vacio,
} from '../../_components/marco';
import { Insignia } from '../../_components/insignia';

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
        personas.length === 0 ? (
          <Vacio titulo="Todavía no hay nadie en el fichero">
            Cuando la iglesia tenga a su gente dada de alta y se pase lista en
            los cultos, aquí saldrá quién lleva tiempo sin venir.
          </Vacio>
        ) : (
          <Vacio titulo="Nadie se ha perdido ninguna reunión">
            Todas las personas vinieron a la última reunión en la que se pasó
            lista. Si te sorprende, puede que falte apuntar algún culto.
          </Vacio>
        )
      ) : (
        <Seccion
          rotulo={`${ausentes.length} ${ausentes.length === 1 ? 'persona sin venir' : 'personas sin venir'}`}
        >
          <Lista>
            {ausentes.map((p) => (
              <Fila key={p.miembroId}>
                <div className="flex items-stretch">
                  <Link
                    href={`${base}/${p.miembroId}`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:pl-5"
                  >
                    <AvatarPersona nombre={p.nombre} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-body font-semibold">
                        {p.nombre}
                      </span>
                      <span className="truncate text-label text-muted-foreground">
                        {p.faltasSeguidas}{' '}
                        {p.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} sin venir
                        {p.ultimaAsistencia
                          ? ` · vino el ${diaCorto(p.ultimaAsistencia, hoy).toLocaleLowerCase('es')}`
                          : ''}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {p.acompana ? (
                          <span className="text-label text-muted-foreground">
                            Le acompaña {p.acompana.nombre}
                          </span>
                        ) : (
                          // Neutra y no de aviso: que nadie la acompañe todavía
                          // es lo normal el primer día, no un fallo.
                          <Insignia tono="neutro">Sin asignar</Insignia>
                        )}
                        {p.ultimoContacto && (
                          <Insignia clase={RESULTADOS[p.ultimoContacto.resultado].badge}>
                            {RESULTADOS[p.ultimoContacto.resultado].etiqueta}
                          </Insignia>
                        )}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 flex-none text-disabled-text"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  </Link>
                  {p.telefono && (
                    <a
                      href={`tel:${p.telefono}`}
                      aria-label={`Llamar a ${p.nombre}`}
                      className="flex w-14 flex-none items-center justify-center border-l border-border text-foreground no-underline hover:bg-surface-alt hover:no-underline"
                    >
                      <Phone className="size-5" strokeWidth={1.8} aria-hidden />
                    </a>
                  )}
                </div>
              </Fila>
            ))}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}
