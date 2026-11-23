import Link from 'next/link';
import type { Metadata } from 'next';

import { esPastor } from '@/lib/auth/permisos';
import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { fichasFueraDelEquipo, LIMITE_FUERA_DEL_EQUIPO } from '@/lib/grupos/consultas';
import { Aviso } from '@/components/aviso';
import { Bloque, Campo, CamposDelGrupo, SELECT } from '@/components/grupos/formulario';
import { Button, buttonVariants } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { crearGrupo } from '../actions';
import { requireGrupos } from '../guarda';

export const metadata: Metadata = { title: 'Nuevo grupo' };

/**
 * Crear un grupo eligiendo su líder.
 *
 * Desde el 23-nov, de toda la iglesia y no solo del equipo de la red: Marlon
 * quiere que el pastor encargue a los líderes de célula en un paso. Quien no
 * estaba en el equipo entra en él al crear la célula (`sumarAlEquipo`), que es
 * lo que la base exige (HT132), y la pantalla lo dice: ahí el pastor sigue
 * viendo quién lleva qué. No es una puerta lateral: quien llega aquí ya podía
 * sumar voluntarios al equipo.
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
  const pastor = esPastor(ctx);
  const delEquipo = ministerio.equipo.filter((p) => pastor || p.miembroId !== ctx.miembroId);
  const deFuera = (await fichasFueraDelEquipo(ctx, id)).filter((p) => pastor || p.id !== ctx.miembroId);
  const cortada = deFuera.length >= LIMITE_FUERA_DEL_EQUIPO;
  const hayAQuien = delEquipo.length + deFuera.length > 0;

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
            nota="Desde la app verá a su gente con su teléfono, reportará cada semana y compartirá el enlace para invitar."
          >
            {!hayAQuien ? (
              <p className="text-pretty text-body text-muted-foreground">
                No hay nadie en el fichero a quien elegir.
              </p>
            ) : (
              <Campo
                etiqueta="Líder"
                nombre="lider"
                requerido
                ayuda={
                  cortada
                    ? `Si no está en la lista, súmalo antes al equipo desde «El equipo». Quien no esté en el equipo de ${e.laRed} entra en él al crear la ${e.uno}.`
                    : `Quien no esté en el equipo de ${e.laRed} entra en él al crear la ${e.uno}, y lo verás en «El equipo».`
                }
              >
                <select id="lider" name="lider" required defaultValue="" className={SELECT}>
                  <option value="" disabled>
                    Elige a quién la lleva
                  </option>
                  {delEquipo.length > 0 && (
                    <optgroup label="Del equipo de la red">
                      {delEquipo.map((p) => (
                        <option key={p.miembroId} value={p.miembroId}>
                          {p.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {deFuera.length > 0 && (
                    <optgroup label="Del resto de la iglesia">
                      {deFuera.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Campo>
            )}
          </Bloque>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!hayAQuien}>
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
