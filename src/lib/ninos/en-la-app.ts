import 'server-only';

import { esPastor, puedeGestionarDesdeDentro } from '@/lib/auth/permisos';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { cronograma, solicitudesPendientes } from './consultas';

/**
 * El tablón de familias en la portada del equipo, y la puerta de sus pantallas
 * en la app (`/mi/equipo/[id]/ninos`, desde la fase N5).
 *
 * La puerta es la ESTRECHA, como el reparto: `puedeGestionarDesdeDentro`, el
 * pastor o quien lidera ESTE ministerio (la responsable y los maestros, que
 * son colíderes). Quien organiza los ministerios desde secretaría no ve nada
 * de él: la RLS de la `0060` va por equipo, y la tarjeta le llevaría a una
 * pantalla vacía (lo avisa `registro.ts`).
 *
 * Sin nombres de niños ni de familias en la tarjeta: solo cuántas familias
 * esperan y la próxima clase. Sin vista de participante: el voluntario no
 * lleva nada aquí.
 */
export const ninosEnLaApp: ModuloEnLaApp = {
  id: 'ninos',
  abrir: 'Abrir el tablón',
  pantalla: 'app',
  visiblePara: (ctx, ministerioId) => puedeGestionarDesdeDentro(ctx, ministerioId),
  async resumen(ctx, ministerio, hoy) {
    const base = rutaApp(ministerio.id, 'ninos');
    // Aceptar familias es de la responsable y del pastor; a un colíder la RLS
    // le devuelve la lista vacía, así que ni se pregunta.
    const acepta =
      esPastor(ctx) ||
      ministerio.equipo.some((i) => i.miembroId === ctx.miembroId && i.rolEquipo === 'responsable');

    const [pendientes, proximas] = await Promise.all([
      acepta ? solicitudesPendientes(ctx, ministerio.id) : Promise.resolve([]),
      cronograma(ctx, ministerio.id, { desde: hoy }),
    ]);
    const siguiente = proximas[0];

    return {
      pendientes:
        pendientes.length > 0
          ? [
              {
                texto:
                  pendientes.length === 1
                    ? '1 familia espera a que la aceptes'
                    : `${pendientes.length} familias esperan a que las aceptes`,
                href: `${base}/familias`,
              },
            ]
          : [],
      proximo: siguiente
        ? {
            texto: `${formatearFechaLarga(siguiente.fecha)} · ${siguiente.tema}`,
            detalle: siguiente.maestro ? `La da ${siguiente.maestro.nombre}` : undefined,
            href: `${base}/cronograma`,
          }
        : null,
      vacio: 'No hay clases apuntadas por delante en el cronograma.',
    };
  },
};
