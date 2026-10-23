import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { contarLaRed, gruposDeLaRed, guiasDeLaRed } from '@/lib/grupos/consultas';
import { etiquetasDeGrupos, mayuscula } from '@/lib/grupos/etiquetas';
import { lunesDe } from '@/lib/grupos/semanas';
import { Aviso } from '@/components/aviso';
import {
  CuentaDeLaRedTarjeta,
  GuiaDeLaRed,
  ListaDeLaRed,
  RedVacia,
} from '@/components/grupos/red';
import { buttonVariants } from '@/components/ui/button';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { publicarGuia } from './actions';
import { CONFIRMACIONES, SEMANAS_POR_DELANTE } from './constantes';
import { requireGrupos } from './guarda';

export const metadata: Metadata = { title: 'Grupos' };

/**
 * Los grupos de una red: cómo va, cuáles no han reportado, y la guía común.
 *
 * Lo primero que se mira es si falta algún reporte, así que la cuenta va
 * arriba y cada fila lleva su insignia; «sin reportar» es la única con icono,
 * porque es la única que pide algo. Debajo, la guía de las próximas semanas.
 *
 * El naranja es «Nueva célula», en la cabecera. La guía va de contorno.
 */
export default async function GruposPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  // La puerta en la página y no solo en el layout: ver `guarda.ts`.
  const { ctx, ministerio } = await requireGrupos(id);
  const { error, guardado } = await searchParams;

  const e = etiquetasDeGrupos(ministerio.tipo);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const semanas = Array.from({ length: SEMANAS_POR_DELANTE }, (_, i) =>
    sumarDias(lunesDe(hoy), 7 * i),
  );
  const base = `/panel/ministerios/${id}/grupos`;

  const [lista, guias] = await Promise.all([
    gruposDeLaRed(ctx, id, hoy),
    guiasDeLaRed(ctx, id, semanas[0]!, semanas[semanas.length - 1]!),
  ]);

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo={`${mayuscula(e.varios)} de ${e.laRed}: su líder y cómo va cada semana`}
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      >
        <Link href={`${base}/nuevo`} className={buttonVariants()}>
          <Plus strokeWidth={1.8} />
          {e.nuevo}
        </Link>
      </CabeceraPanel>

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="grupos" />

        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {lista.length === 0 ? (
          <RedVacia
            etiquetas={e}
            accion={
              <Link href={`${base}/nuevo`} className={buttonVariants({ variant: 'outline' })}>
                <Plus strokeWidth={1.8} />
                Crear la primera
              </Link>
            }
          />
        ) : (
          <>
            <CuentaDeLaRedTarjeta cuenta={contarLaRed(lista)} etiquetas={e} />
            <section className="flex flex-col gap-2.5">
              <h2 className="t-micro px-1">{mayuscula(e.varios)}</h2>
              <ListaDeLaRed grupos={lista} hoy={hoy} hrefDe={(g) => `${base}/${g}`} />
            </section>
          </>
        )}

        <GuiaDeLaRed
          accion={publicarGuia.bind(null, id)}
          semanas={semanas}
          guias={guias}
          hoy={hoy}
          etiquetas={e}
          boton="outline"
        />
      </Contenedor>
    </>
  );
}
