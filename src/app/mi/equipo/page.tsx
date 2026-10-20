import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import {
  ministeriosQueLlevoEnLaApp,
  requireZonaDelLider,
} from '@/lib/ministerios/en-la-app/guarda';
import {
  tarjetasDeLaPortada,
  totalPendientes,
} from '@/lib/ministerios/en-la-app/portada';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { FilaEnlace, Lista, MarcoEquipo, Rotulo } from './_components/marco';

export const metadata: Metadata = { title: 'Equipo' };

/**
 * La pestaña «Equipo»: los ministerios que lleva esta persona.
 *
 * Con uno solo no hay nada que elegir y se va directo a su portada; la pestaña
 * ya apunta ahí (`mi/layout.tsx`), esto cubre a quien llegue escribiendo la
 * dirección o desde un enlace viejo.
 *
 * Con varios, una fila por ministerio con cuántas cosas piden atención y las
 * dos primeras. Es lo que contesta «¿tengo algo que hacer?» sin abrir cada uno,
 * y para eso hace falta resumir todos: con dos o tres ministerios —lo normal en
 * quien lleva más de uno— son unas pocas consultas en paralelo.
 */
export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireZonaDelLider();
  const { error } = await searchParams;

  const llevo = ministeriosQueLlevoEnLaApp(ctx);
  // Sin `error`, que se perdería: un aviso que vuelve aquí tiene que leerse.
  if (llevo.length === 1 && !error) redirect(rutaApp(llevo[0]!.id));

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const resumenes = await Promise.all(
    llevo.map(async (m) => {
      const ministerio = await obtenerMinisterio(ctx, m.id);
      if (!ministerio) return null;
      const tarjetas = await tarjetasDeLaPortada(ctx, ministerio, hoy);
      const pendientes = tarjetas.flatMap((t) => t.resumen?.pendientes ?? []);
      return {
        ministerio,
        total: totalPendientes(tarjetas),
        // Lo urgente primero: si solo caben dos líneas, que sean esas.
        primeros: [...pendientes]
          .sort((a, b) => Number(b.urgente ?? false) - Number(a.urgente ?? false))
          .slice(0, 2),
      };
    }),
  );

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Equipo"
      subtitulo={ctx.iglesia.nombre}
      error={error}
    >
      <Rotulo>Lo que llevas</Rotulo>
      <Lista>
        {resumenes.map((r) => {
          if (!r) return null;
          const color = colorDeMinisterio(r.ministerio.colorHex);
          return (
            <li key={r.ministerio.id}>
              <FilaEnlace
                href={rutaApp(r.ministerio.id)}
                derecha={
                  r.total > 0 ? (
                    <span className="flex-none rounded-md bg-badge-warning-bg px-2 py-0.5 text-[12px] font-semibold text-badge-warning-fg">
                      {r.total}
                    </span>
                  ) : undefined
                }
              >
                <span className="flex items-center gap-2 text-[15.5px] font-bold tracking-[-0.015em]">
                  <span
                    className="size-2.5 flex-none rounded-full"
                    style={{ backgroundColor: color.hex }}
                    aria-hidden
                  />
                  <span className="truncate">{r.ministerio.nombre}</span>
                </span>
                {r.primeros.length === 0 ? (
                  <span className="text-[13px] text-muted-foreground">
                    Nada pendiente
                  </span>
                ) : (
                  r.primeros.map((p, i) => (
                    <span
                      key={i}
                      className="truncate text-[13px] text-muted-foreground"
                    >
                      {p.texto}
                      {p.detalle && ` · ${p.detalle}`}
                    </span>
                  ))
                )}
              </FilaEnlace>
            </li>
          );
        })}
      </Lista>
    </MarcoEquipo>
  );
}
