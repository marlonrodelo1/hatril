import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { fechaDeLaReunion } from '@/lib/grupos/semanas';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { Button } from '@/components/ui/button';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Input } from '@/components/ui/input';
import { MarcoEquipo } from '../../../../_components/marco';
import { guardarTemas } from '../actions';
import type { cargar } from './datos';

/**
 * Los temas de las próximas semanas de un grupo, uno por reunión. Lo pintan
 * igual la web (`./page.tsx`) y la app empaquetada (`movil/`).
 *
 * Cada campo viene con el tema propio si ya lo hay; si no, vacío y con la guía
 * de la red como pista. Dejarlo vacío es quedarse con la guía, y la pantalla lo
 * dice: no hace falta copiarla.
 */
export type DatosTemas = Awaited<ReturnType<typeof cargar>>;

export function VistaTemas({ id, grupoId, error, ctx, ministerio, grupo, hoy, semanas, temas, guias }: DatosTemas) {
  const e = etiquetasDeGrupos(ministerio.tipo);
  const volver = rutaApp(id, 'grupos', grupoId);

  return (
    <MarcoEquipo ctx={ctx} titulo="Próximos temas" subtitulo={grupo.nombre} volver={volver} error={error}>
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
                defaultValue={temas[s] ?? ''}
                placeholder={guias[s] ?? 'p. ej. El perdón, Mateo 18'}
                autoComplete="off"
              />
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit">Guardar los temas</Button>
          <BotonEnlace href={volver} variant="ghost">
            Cancelar
          </BotonEnlace>
        </div>
      </form>
    </MarcoEquipo>
  );
}
