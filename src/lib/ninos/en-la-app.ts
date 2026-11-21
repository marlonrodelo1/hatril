import 'server-only';

import { esPastor, puedeGestionarDesdeDentro } from '@/lib/auth/permisos';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { cronograma, solicitudesPendientes } from './consultas';

/**
 * El tablón de familias en la portada del equipo: lo mínimo para que la
 * tarjeta no le salga a quien el panel rebota.
 *
 * POR QUÉ EXISTE YA, CON LA WEB `/mi` CONGELADA
 * ---------------------------------------------
 * Sin adaptador, la portada pinta la tarjeta de respaldo con la puerta ANCHA
 * (`puedeGestionarMinisterio`), y este módulo tiene la estrecha, como el
 * reparto: `puedeGestionarDesdeDentro`. Quien organiza los ministerios desde
 * secretaría vería la tarjeta y su enlace le rebotaría (lo avisa `registro.ts`).
 * Lo de los maestros en la app de verdad (cronograma, publicar) llega con la
 * fase N5, en `movil/`; esto lleva al panel, que ya funciona en el móvil.
 *
 * Sin nombres de niños ni de familias: solo cuántas familias esperan y la
 * próxima clase. Sin vista de participante: el voluntario no lleva nada aquí.
 */
export const ninosEnLaApp: ModuloEnLaApp = {
  id: 'ninos',
  abrir: 'Abrir el tablón',
  pantalla: 'panel',
  visiblePara: (ctx, ministerioId) => puedeGestionarDesdeDentro(ctx, ministerioId),
  async resumen(ctx, ministerio, hoy) {
    const base = `/panel/ministerios/${ministerio.id}/ninos`;
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
