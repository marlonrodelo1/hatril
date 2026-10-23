import Link from 'next/link';
import type { Metadata } from 'next';

import { esPastor } from '@/lib/auth/permisos';
import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { Aviso } from '@/components/aviso';
import { Bloque, Campo, CamposDelGrupo, SELECT } from '@/components/grupos/formulario';
import { Button, buttonVariants } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { crearGrupo } from '../actions';
import { requireGrupos } from '../guarda';

export const metadata: Metadata = { title: 'Nuevo grupo' };

/**
 * Crear un grupo eligiendo su líder entre el equipo de la red.
 *
 * Solo el equipo: es lo que exige HT132, y lo que hace que «nombrar líder de
 * célula» no sea una puerta lateral para darle a cualquiera una lista de
 * gente. Quien no está, se suma antes al equipo desde «El equipo», donde el
 * pastor ve quién lleva qué.
 *
 * Y quien no es pastor no se ofrece a sí mismo: HT134 se lo rechazaría.
 */
export default async function NuevoGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { ctx, ministerio } = await requireGrupos(id);
  const { error } = await searchParams;

  const e = etiquetasDeGrupos(ministerio.tipo);
  const base = `/panel/ministerios/${id}/grupos`;
  const elegibles = ministerio.equipo.filter(
    (p) => esPastor(ctx) || p.miembroId !== ctx.miembroId,
  );

  return (
    <>
      <CabeceraPanel
        titulo={e.nuevo}
        subtitulo={ministerio.nombre}
        volver={{ href: base, texto: ministerio.nombre }}
      />

      <Contenedor ancho="formulario">
        <form action={crearGrupo.bind(null, id)} className="flex flex-col gap-6">
          {error && <Aviso>{error}</Aviso>}

          <Bloque titulo="Cuándo y dónde se reúne">
            <CamposDelGrupo />
          </Bloque>

          <Bloque
            titulo="Su líder"
            nota="Alguien del equipo de la red. Desde la app verá a su gente, reportará cada semana y compartirá el enlace para invitar."
          >
            {elegibles.length === 0 ? (
              <p className="text-pretty text-body text-muted-foreground">
                En el equipo de la red no hay nadie a quien elegir. Suma antes a las
                personas que van a llevar cada {e.uno} desde{' '}
                <Link href={`/panel/ministerios/${id}`} className="font-semibold">
                  El equipo
                </Link>
                .
              </p>
            ) : (
              <Campo
                etiqueta="Líder"
                nombre="lider"
                requerido
                ayuda="¿No está en la lista? Súmalo antes al equipo desde «El equipo»."
              >
                <select id="lider" name="lider" required defaultValue="" className={SELECT}>
                  <option value="" disabled>
                    Elige a alguien del equipo
                  </option>
                  {elegibles.map((p) => (
                    <option key={p.miembroId} value={p.miembroId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </Bloque>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={elegibles.length === 0}>
              Crear
            </Button>
            <Link href={base} className={buttonVariants({ variant: 'ghost' })}>
              Cancelar
            </Link>
          </div>
        </form>
      </Contenedor>
    </>
  );
}
