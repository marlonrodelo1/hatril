import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { puedeGestionarMinisterio } from '@/lib/auth/permisos';
import {
  misMinisterios,
  obtenerMinisterio,
  type MiMinisterio,
} from '@/lib/ministerios/consultas';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { requireMisEquipos } from '@/lib/ministerios/en-la-app/guarda';
import {
  tarjetasDeLaPortada,
  totalPendientes,
} from '@/lib/ministerios/en-la-app/portada';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import type { ModoEnElEquipo } from '@/lib/ministerios/en-la-app/contrato';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import type { UserContext } from '@/lib/auth/user-context';
import {
  Fila,
  FilaEnlace,
  Lista,
  MarcoEquipo,
  Seccion,
} from './_components/marco';
import { Insignia } from './_components/insignia';

export const metadata: Metadata = { title: 'Equipo' };

/**
 * La pestaña «Equipo»: los equipos en los que sirve esta persona.
 *
 * Con uno solo no hay nada que elegir y se va directo a su portada; la pestaña
 * ya apunta ahí (`mi/layout.tsx`), esto cubre a quien llegue escribiendo la
 * dirección o desde un enlace viejo.
 *
 * Con varios, dos bloques: «Lo que llevas», donde entra a sus herramientas, y
 * «Donde sirves», donde ve lo suyo. Separados porque son dos cosas que se
 * vienen a hacer distintas, y mezclados el voluntario no sabría por qué en una
 * fila hay «2 pendientes» y en la otra no. En cada fila, cuántas cosas piden
 * atención y las dos primeras; si no hay, lo siguiente que viene.
 */
export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireMisEquipos();
  const { error } = await searchParams;

  // Sin `error`, que se perdería: un aviso que vuelve aquí tiene que leerse.
  if (ctx.ministerioIds.length === 1 && !error) {
    redirect(rutaApp(ctx.ministerioIds[0]!));
  }

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const filas = await Promise.all(
    (await misMinisterios(ctx)).map((m) => resumir(ctx, m, hoy)),
  );
  const llevo = filas.filter((f) => f?.modo === 'lider');
  const sirvo = filas.filter((f) => f?.modo === 'participante');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Equipo"
      subtitulo={ctx.iglesia.nombre}
      conLogo
      error={error}
    >
      {llevo.length > 0 && (
        <Seccion rotulo="Lo que llevas">
          <Lista>
            {llevo.map((f) => f && <FilaEquipo key={f.id} fila={f} />)}
          </Lista>
        </Seccion>
      )}
      {sirvo.length > 0 && (
        <Seccion rotulo="Donde sirves">
          <Lista>
            {sirvo.map((f) => f && <FilaEquipo key={f.id} fila={f} />)}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}

type ResumenDeEquipo = {
  id: string;
  nombre: string;
  colorHex: string;
  modo: ModoEnElEquipo;
  total: number;
  lineas: string[];
};

async function resumir(
  ctx: UserContext,
  m: MiMinisterio,
  hoy: string,
): Promise<ResumenDeEquipo | null> {
  const ministerio = await obtenerMinisterio(ctx, m.id);
  if (!ministerio) return null;

  const modo: ModoEnElEquipo = puedeGestionarMinisterio(ctx, m.id)
    ? 'lider'
    : 'participante';
  const tarjetas = await tarjetasDeLaPortada(ctx, ministerio, hoy, modo);

  // Lo urgente primero: si solo caben dos líneas, que sean esas.
  const pendientes = tarjetas
    .flatMap((t) => t.resumen?.pendientes ?? [])
    .sort((a, b) => Number(b.urgente ?? false) - Number(a.urgente ?? false))
    .slice(0, 2)
    .map((p) => (p.detalle ? `${p.texto} · ${p.detalle}` : p.texto));

  const proximo = tarjetas.find((t) => t.resumen?.proximo)?.resumen?.proximo;

  return {
    id: m.id,
    nombre: m.nombre,
    colorHex: m.colorHex,
    modo,
    total: totalPendientes(tarjetas),
    lineas:
      pendientes.length > 0
        ? pendientes
        : proximo
          ? [proximo.texto]
          : ['Nada pendiente'],
  };
}

function FilaEquipo({ fila: f }: { fila: ResumenDeEquipo }) {
  const color = colorDeMinisterio(f.colorHex);
  return (
    <Fila>
      <FilaEnlace
        href={rutaApp(f.id)}
        derecha={
          f.total > 0 ? (
            <Insignia tono="aviso">
              {f.total === 1 ? '1 pendiente' : `${f.total} pendientes`}
            </Insignia>
          ) : undefined
        }
      >
        <span className="flex items-center gap-2 text-body font-semibold">
          {/* El color del ministerio, de `colorDeMinisterio()`: el único
              color que no sale de un token, y por eso en línea. */}
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ backgroundColor: color.hex }}
            aria-hidden
          />
          <span className="truncate">{f.nombre}</span>
        </span>
        {f.lineas.map((l, i) => (
          <span key={i} className="truncate text-label text-muted-foreground">
            {l}
          </span>
        ))}
      </FilaEnlace>
    </Fila>
  );
}
