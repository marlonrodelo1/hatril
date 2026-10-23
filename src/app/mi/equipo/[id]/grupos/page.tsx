import Link from 'next/link';
import type { Metadata } from 'next';

import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { contarLaRed, gruposDeLaRed, guiasDeLaRed } from '@/lib/grupos/consultas';
import { etiquetasDeGrupos, mayuscula } from '@/lib/grupos/etiquetas';
import { lunesDe } from '@/lib/grupos/semanas';
import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import {
  CuentaDeLaRedTarjeta,
  GuiaDeLaRed,
  ListaDeLaRed,
  RedVacia,
} from '@/components/grupos/red';
import { buttonVariants } from '@/components/ui/button';
import { CONFIRMACIONES, SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';
import { MarcoEquipo, Seccion } from '../../_components/marco';
import { publicarGuia } from './actions';

export const metadata: Metadata = { title: 'Grupos' };

/**
 * La red en el móvil de quien la lleva: cómo va, qué células no han reportado,
 * y la guía de la semana.
 *
 * Las mismas piezas que el panel (`components/grupos/red.tsx`), para que el
 * responsable en el ordenador y el colíder en el móvil vean lo mismo. Crear
 * células y cambiar a su gente sigue en el panel —es trabajo de escritorio, y
 * lo hace una persona por red—; aquí el enlace lleva allí.
 *
 * La puerta es `requireMinisterioEnLaApp(id, 'grupos')`, que aplica la estrecha
 * del adaptador: pastor o quien lidera la red desde dentro. El naranja es
 * «Guardar la guía», que es lo único que se escribe aquí.
 */
export default async function RedEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'grupos');
  const { error, guardado } = await searchParams;

  const e = etiquetasDeGrupos(ministerio.tipo);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const semanas = Array.from({ length: SEMANAS_POR_DELANTE }, (_, i) =>
    sumarDias(lunesDe(hoy), 7 * i),
  );

  const [lista, guias] = await Promise.all([
    gruposDeLaRed(ctx, id, hoy),
    guiasDeLaRed(ctx, id, semanas[0]!, semanas[semanas.length - 1]!),
  ]);
  const enElPanel = `/panel/ministerios/${id}/grupos`;

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={mayuscula(e.varios)}
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado && Object.hasOwn(CONFIRMACIONES, guardado) ? CONFIRMACIONES[guardado] : undefined}
    >
      {lista.length === 0 ? (
        <RedVacia
          etiquetas={e}
          accion={
            <Link href={`${enElPanel}/nuevo`} className={buttonVariants({ variant: 'outline' })}>
              Crearlas en el panel
            </Link>
          }
        />
      ) : (
        <>
          <CuentaDeLaRedTarjeta cuenta={contarLaRed(lista)} etiquetas={e} />
          <Seccion rotulo={mayuscula(e.varios)}>
            <ListaDeLaRed
              grupos={lista}
              hoy={hoy}
              hrefDe={(g) => rutaApp(id, 'grupos', g)}
            />
            <Link href={enElPanel} className="px-1 text-label font-semibold text-muted-foreground">
              Crear o cambiar {e.varios} en el panel
            </Link>
          </Seccion>
        </>
      )}

      <GuiaDeLaRed
        accion={publicarGuia.bind(null, id)}
        semanas={semanas}
        guias={guias}
        hoy={hoy}
        etiquetas={e}
      />
    </MarcoEquipo>
  );
}
