import Link from 'next/link';

import { etiquetasDeGrupos, mayuscula } from '@/lib/grupos/etiquetas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { CuentaDeLaRedTarjeta, GuiaDeLaRed, ListaDeLaRed, RedVacia } from '@/components/grupos/red';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/grupos/constantes';
import { MarcoEquipo, Seccion } from '../../_components/marco';
import { publicarGuia } from './actions';
import type { cargar } from './datos';

/**
 * La red en el móvil de quien la lleva: cómo va, qué células no han reportado,
 * y la guía de la semana. Lo pintan igual la web (`./page.tsx`) y la app
 * empaquetada (`movil/`).
 *
 * Las mismas piezas que el panel (`components/grupos/red.tsx`), para que el
 * responsable en el ordenador y el colíder en el móvil vean lo mismo. Crear
 * células y cambiar a su gente sigue en el panel —es trabajo de escritorio, y
 * lo hace una persona por red—; aquí el enlace lleva allí.
 *
 * El naranja es «Guardar la guía», que es lo único que se escribe aquí.
 */
export type DatosRed = Awaited<ReturnType<typeof cargar>>;

export function VistaRed({ id, error, guardado, ctx, ministerio, hoy, semanas, lista, cuenta, guias }: DatosRed) {
  const e = etiquetasDeGrupos(ministerio.tipo);
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
            <BotonEnlace href={`${enElPanel}/nuevo`} variant="outline">
              Crearlas en el panel
            </BotonEnlace>
          }
        />
      ) : (
        <>
          <CuentaDeLaRedTarjeta cuenta={cuenta} etiquetas={e} />
          <Seccion rotulo={mayuscula(e.varios)}>
            <ListaDeLaRed grupos={lista} hoy={hoy} hrefDe={(g) => rutaApp(id, 'grupos', g)} />
            <Link href={enElPanel} className="px-1 text-label font-semibold text-muted-foreground">
              Crear o cambiar {e.varios} en el panel
            </Link>
          </Seccion>
        </>
      )}

      <GuiaDeLaRed
        accion={publicarGuia.bind(null, id)}
        semanas={semanas}
        guias={new Map(Object.entries(guias))}
        hoy={hoy}
        etiquetas={e}
      />
    </MarcoEquipo>
  );
}
