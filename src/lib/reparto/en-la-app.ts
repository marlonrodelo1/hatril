import 'server-only';

import { puedeGestionarDesdeDentro } from '@/lib/auth/permisos';
import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { contarInscritos, jornadaDelDia, quienHaVenido } from './consultas';

/**
 * El reparto en la portada del equipo: cómo va la puerta de hoy.
 *
 * LA PUERTA ESTRECHA
 * ------------------
 * `visiblePara` es `puedeGestionarDesdeDentro`, la misma que `requireReparto`
 * y `PestanasMinisterio` en el panel: pastor o quien lidera ESTE equipo, sin el
 * camino de `gestionar_ministerios`. La RLS del reparto va por equipo (`0042`),
 * y a quien organiza los ministerios desde secretaría la base no le enseña nada
 * de él: la tarjeta le saldría vacía y su enlace le rebotaría.
 *
 * SOLO RECUENTOS
 * --------------
 * Cuántos han venido, cuántos esperan, cuántos hogares hay en el padrón. Ni un
 * nombre: el padrón es de personas de fuera y en situación vulnerable, y la
 * portada se abre en un móvil en medio de la gente. Los nombres están en la
 * pantalla del reparto, que es donde se trabaja con ellos.
 *
 * SIN PANTALLA EN LA APP, Y SIN VISTA DE PARTICIPANTE
 * ---------------------------------------------------
 * La pantalla de la puerta vive en el panel y está pensada para el móvil, así
 * que la tarjeta lleva allí (`pantalla: 'panel'`): el líder entra al panel
 * desde la base común. Y no declara `participante`: en la v1 el voluntario no
 * marca entregas (`docs/modulos/plan.md`, v1.1), y no hay nada suyo que
 * enseñarle que no sea el padrón.
 */
export const repartoEnLaApp: ModuloEnLaApp = {
  id: 'reparto',
  abrir: 'Abrir el reparto',
  pantalla: 'panel',
  visiblePara: (ctx, ministerioId) => puedeGestionarDesdeDentro(ctx, ministerioId),
  async resumen(ctx, ministerio, hoy) {
    const href = `/panel/ministerios/${ministerio.id}/reparto`;
    const jornada = await jornadaDelDia(ctx, ministerio.id, hoy);

    if (!jornada) {
      const inscritos = await contarInscritos(ctx, ministerio.id);
      return {
        pendientes: [],
        vacio:
          inscritos === 0
            ? 'El padrón está vacío. A cada hogar se le apunta en la puerta, el día del reparto.'
            : `${inscritos} ${inscritos === 1 ? 'hogar' : 'hogares'} en el padrón. El día del reparto, empiézalo al abrir la puerta.`,
      };
    }

    const venidos = await quienHaVenido(ctx, jornada.id);
    const enLaCola = venidos.filter((v) => !v.entregado).length;
    // Las entregas sin inscribir cuentan como entregadas, igual que en la
    // pantalla del reparto: «2 entregados (1 sin inscribir)». Separadas, la
    // tarjeta y el panel daban cifras distintas para la misma puerta.
    const entregados = venidos.length - enLaCola + jornada.sinInscribir;
    const esperando = enLaCola;
    const detalle =
      `${entregados} ${entregados === 1 ? 'entregado' : 'entregados'}` +
      (jornada.sinInscribir > 0 ? ` (${jornada.sinInscribir} sin inscribir)` : '');

    // Alguien esperando es lo único que pide algo; sin nadie en la cola, la
    // jornada está en orden y sale como «lo de ahora».
    return esperando > 0
      ? {
          pendientes: [
            {
              texto: `Reparto de hoy · ${esperando} ${esperando === 1 ? 'espera' : 'esperan'}`,
              detalle,
              href,
            },
          ],
          vacio: '',
        }
      : {
          pendientes: [],
          proximo: { texto: 'Reparto de hoy', detalle, href },
          vacio: '',
        };
  },
};
