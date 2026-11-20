import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { VistaAgenda } from './_components/vista-agenda';
import { datosDeLaAgenda } from './datos';

export const metadata: Metadata = { title: 'Agenda' };

/**
 * La agenda de un miembro, como calendario.
 *
 * Junta en un solo sitio lo que antes estaba repartido: los cultos y reuniones
 * fijas de la semana, los eventos de la iglesia y los ensayos de los equipos
 * donde sirve. Para un miembro son la misma pregunta —qué tengo yo esta
 * semana— y separarlas le obliga a mirar en dos sitios para contestarla.
 *
 * LA VISTA VIAJA EN LA URL, NO EN EL ESTADO
 * -----------------------------------------
 * `?v=mes|semana|dia` y `?d=YYYY-MM-DD`. Igual que el selector de mensual/anual
 * de la suscripción, y por lo mismo: son dos datos que el servidor ya sabe leer,
 * el enlace se puede compartir tal cual, y avanzar de mes funciona sin una línea
 * de JavaScript. Lo único que vive en el navegador es qué día está abierto en la
 * hoja, que es lo único que no se puede saber sin un dedo.
 *
 * SE PIDE LO QUE SE PINTA, MÁS TRES SEMANAS PARA «PRÓXIMOS»
 * ----------------------------------------------------------
 * La vista necesita su trozo: en mes, las seis semanas completas de la rejilla
 * —con los arrastres del mes vecino, que también se pintan y también tienen que
 * poder marcarse—; en semana, siete días; en día, uno. Y la lista de «Próximos»
 * necesita tres semanas por delante de hoy, mire donde mire la vista.
 *
 * Se traen los dos rangos de una vez. Lo que NO se hace es pedir «los próximos
 * tres meses» por si acaso: eso multiplicaría por doce la expansión de los
 * horarios semanales para enseñar treinta días.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    v?: string;
    d?: string;
    error?: string;
    guardado?: string;
  }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { v, d, error, guardado } = await searchParams;

  const { vista, ancla, hoy, lista, porContestar } = await datosDeLaAgenda(ctx, v, d);

  return (
    <VistaAgenda
      cabecera={
        <CabeceraMiembro
          user={user!}
          titulo="Agenda"
          subtitulo={ctx.iglesia.nombre}
          logoUrl={ctx.iglesia.logoUrl}
        />
      }
      iglesiaNombre={ctx.iglesia.nombre}
      vista={vista}
      ancla={ancla}
      hoy={hoy}
      lista={lista}
      porContestar={porContestar}
      error={error}
      guardado={guardado}
    />
  );
}
