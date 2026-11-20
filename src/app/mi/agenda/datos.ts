import 'server-only';

import type { UserContext } from '@/lib/auth/user-context';
import { agendaEntre, sumarDias } from '@/lib/agenda/calendario';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { misMinisterios } from '@/lib/ministerios/consultas';
import { misTurnos } from '@/lib/turnos/consultas';
import type { Vista } from './_components/segmentado';
import { rangoDe } from './_components/vista-agenda';

/**
 * Lo que consulta la agenda: lo usan la página de la web y la API de la app
 * (`/api/v1/app/mi/agenda`), para que las dos pidan exactamente lo mismo.
 * Salió de `./page.tsx` el 20-nov, con sus comentarios.
 */
export async function datosDeLaAgenda(ctx: UserContext, v?: string, d?: string) {
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const vista: Vista = v === 'dia' || v === 'semana' ? v : 'mes';
  const ancla = /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d! : hoy;

  const ministerios = await misMinisterios(ctx);
  const { desde, hasta } = rangoDe(vista, ancla);

  /*
   * SE CONSULTA UN RANGO Y SE PINTAN DOS COSAS DISTINTAS
   *
   * La vista necesita su trozo —un día, una semana, la rejilla del mes— y la
   * lista de «Próximos» necesita tres semanas por delante de HOY, mire donde
   * mire la vista. Con una sola consulta que cubra los dos, «Próximos» sigue
   * siendo útil en la vista de día.
   *
   * El primer intento reutilizaba el rango de la vista sin más, y en la vista de
   * día quedaba una pantalla que decía «no hay nada ese día» y debajo «no hay
   * nada apuntado por aquí»: dos veces lo mismo, y la segunda además era falsa
   * —había cosas al día siguiente—. Se vio abriendo la pantalla, no leyendo el
   * código.
   */
  const finProximos = sumarDias(hoy, 21);

  /*
   * Los turnos, además, arriba de todo y con sus botones. Salen también en el
   * calendario, pero ahí son una línea entre cultos y eventos; lo que aquí
   * importa es que la persona conteste, y eso necesita un botón a la vista, no
   * una fila más que hay que abrir. Tres semanas, como «Próximos»: lo que cae
   * más lejos todavía no se contesta.
   *
   * En paralelo con la agenda y no detrás: es otro viaje a la base, y con ella
   * en Irlanda y la gente en Colombia, en fila serían dos esperas en vez de una.
   */
  const [lista, porContestar] = await Promise.all([
    agendaEntre(
      ctx,
      desde < hoy ? desde : hoy,
      hasta > finProximos ? hasta : finProximos,
      ministerios.map((m) => m.id),
    ),
    misTurnos(ctx, hoy, finProximos),
  ]);

  return { vista, ancla, hoy, lista, porContestar };
}
