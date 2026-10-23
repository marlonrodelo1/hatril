import Link from 'next/link';
import type { Metadata } from 'next';

import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { guiasDeLaRed, semanasDelGrupo } from '@/lib/grupos/consultas';
import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { requireGrupoEnLaApp } from '@/lib/grupos/guarda';
import { fechaDeLaReunion, proximasSemanas } from '@/lib/grupos/semanas';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';
import { MarcoEquipo } from '../../../../_components/marco';
import { guardarTemas } from '../actions';

export const metadata: Metadata = { title: 'Próximos temas' };

/**
 * Los temas de las próximas semanas de un grupo, uno por reunión.
 *
 * Cada campo viene con el tema propio si ya lo hay; si no, vacío y con la guía
 * de la red como pista. Dejarlo vacío es quedarse con la guía, y la pantalla lo
 * dice: no hace falta copiarla.
 */
export default async function TemasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; grupoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, grupoId } = await params;
  const { ctx, grupo, ministerio } = await requireGrupoEnLaApp(id, grupoId);
  const { error } = await searchParams;

  const e = etiquetasDeGrupos(ministerio.tipo);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const semanas = proximasSemanas(grupo.diaSemana, hoy, SEMANAS_POR_DELANTE);
  const desde = semanas[0]!;
  const hasta = semanas[semanas.length - 1]!;
  const volver = rutaApp(id, 'grupos', grupoId);

  const [guardadas, guias] = await Promise.all([
    semanasDelGrupo(ctx, grupoId, desde, hasta),
    guiasDeLaRed(ctx, id, desde, hasta),
  ]);

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Próximos temas"
      subtitulo={grupo.nombre}
      volver={volver}
      error={error}
    >
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-pretty text-label text-muted-foreground">
        Lo que se va a hablar en cada reunión. Si dejas una vacía, se queda el tema de
        la guía de {e.laRed}, el que sale en gris.
      </p>

      <form action={guardarTemas.bind(null, id, grupoId)} className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          {semanas.map((s) => (
            <div key={s} className="flex flex-col gap-1.5">
              <label htmlFor={`tema-${s}`} className="text-label font-semibold">
                {diaCorto(fechaDeLaReunion(s, grupo.diaSemana), hoy)}
              </label>
              <Input
                id={`tema-${s}`}
                name={`tema-${s}`}
                maxLength={120}
                defaultValue={guardadas.get(s)?.tema ?? ''}
                placeholder={guias.get(s) ?? 'p. ej. El perdón, Mateo 18'}
                autoComplete="off"
              />
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit">Guardar los temas</Button>
          <Link href={volver} className={buttonVariants({ variant: 'ghost' })}>
            Cancelar
          </Link>
        </div>
      </form>
    </MarcoEquipo>
  );
}
