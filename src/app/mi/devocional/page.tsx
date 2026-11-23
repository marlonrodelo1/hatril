import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import {
  devocionalParaLeer,
  devocionalesAnteriores,
} from '@/lib/devocionales/consultas';
import { leerVideo } from '@/lib/devocionales/video';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { TamanoLetra } from '../_components/tamano-letra';
import { VistaDevocional } from './_components/vista-devocional';

export const metadata: Metadata = { title: 'Devocional' };

/**
 * El devocional del día, y el archivo de los anteriores.
 *
 * QUÉ TENÍA ANTES: UN RECTÁNGULO Y TRES PÁRRAFOS
 * ----------------------------------------------
 * Foto de 190px con borde, fecha, título, versículo en una caja y el cuerpo.
 * Funcionaba y se leía como un documento: la misma jerarquía tipográfica de
 * arriba abajo, sin nada que dijera dónde empieza lo importante. Y cuando salía
 * el devocional de mañana, el de hoy dejaba de existir.
 *
 * LO QUE CAMBIA
 * -------------
 *   - **La foto es la portada**, a sangre y con el título encima, como en el
 *     muro. Es la misma pieza visual y da coherencia entre las dos pantallas que
 *     más se abren.
 *   - **Se firma.** Un devocional lo escribe alguien de la congregación, con su
 *     nombre y su cara. Sin autor parece una circular; con él, es Marta la que
 *     te está hablando.
 *   - **El versículo destaca de verdad**, en su tarjeta y un poco más grande
 *     que el cuerpo, en vez de una caja gris más entre otras cajas grises.
 *   - **Se puede compartir**, que es lo que la gente hace con un devocional que
 *     le ha llegado.
 *   - **Hay archivo.** Los anteriores, al pie, y se abren con `?d=fecha`. Sin
 *     eso, lo que se publicó ayer desaparecía para siempre.
 *
 * PARA LEER CON CALMA (zona 2 del rediseño, 17-nov)
 * -------------------------------------------------
 * Un texto largo en el móvil, muchas veces leído por gente mayor: lo que más
 * pesa es la letra.
 *   - **A− y A+ en la cabecera** (`TamanoLetra`), recordado en el móvil y
 *     compartido con la Biblia.
 *   - **Una línea naranja arriba** que se llena mientras se lee
 *     (`BarraLectura`), para saber cuánto queda.
 *   - **«Lo he leído» al final**, que solo ve la propia persona
 *     (`LoHeLeido`, y allí el porqué).
 *   - **El versículo pierde la raya naranja** de adorno: el naranja es para
 *     acciones, y una barra de color junto a un texto se lee como «esto se
 *     pulsa» o como «esto está seleccionado».
 *
 * Y un detalle que se vio abriendo uno viejo: el «· el último publicado» que
 * avisa de que no estás leyendo el de hoy SOLO se pinta cuando la pantalla ha
 * elegido por su cuenta. Si lo has abierto tú desde el archivo, esa coletilla es
 * falsa —no es el último, es el que pediste— y encima confunde.
 *
 * `?d=` VIAJA EN LA URL Y NO EN UN ESTADO
 * ---------------------------------------
 * Igual que la agenda y que el selector de la suscripción: el servidor ya sabe
 * leerlo, el enlace se comparte tal cual y funciona sin JavaScript.
 */
export default async function DevocionalPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { d: pedida } = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida ?? '') ? pedida : undefined;

  const d = await devocionalParaLeer(ctx, fecha);
  const video = leerVideo(d?.videoUrl);
  const anteriores = d ? await devocionalesAnteriores(ctx, d.fecha) : [];

  return (
    <VistaDevocional
      cabecera={
        <CabeceraMiembro
          user={user!}
          titulo="Devocional"
          subtitulo={ctx.iglesia.nombre}
          logoUrl={fecha ? undefined : ctx.iglesia.logoUrl}
          volver={fecha ? '/mi/devocional' : undefined}
        >
          {/* Sin devocional no hay nada que leer, ni letra que cambiar. */}
          {d && <TamanoLetra para="devocional" />}
        </CabeceraMiembro>
      }
      iglesia={ctx.iglesia}
      fecha={fecha}
      d={d}
      video={video}
      anteriores={anteriores}
    />
  );
}
