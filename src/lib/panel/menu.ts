import 'server-only';

import { cache } from 'react';

import type { UserContext } from '@/lib/auth/user-context';
import {
  esPastor,
  puede,
  puedeGestionarEventos,
  puedeGestionarFinanzas,
} from '@/lib/auth/permisos';
import { contarSolicitudesPendientes } from '@/lib/solicitudes/consultas';
import { misTurnosPendientes } from '@/lib/devocionales/consultas';

/**
 * Qué secciones del panel le tocan a esta persona, y con qué números encima.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO EN EL LAYOUT
 * -----------------------------------
 * Antes esto vivía suelto dentro de `panel/layout.tsx`, que era el único sitio
 * que lo necesitaba. Ahora lo piden dos: el menú lateral de escritorio y el
 * menú móvil, que sale de la cabecera de cada página. Con el cálculo duplicado,
 * el día que se añada una sección aparecería en uno de los dos menús y en el
 * otro no —y ese fallo no lo caza ni el typecheck ni el lint, solo abrir el
 * teléfono—.
 *
 * `cache()` DE REACT, Y ES LO QUE HACE QUE ESTO SALGA GRATIS
 * ----------------------------------------------------------
 * Dentro de un mismo render, layout y cabecera llaman a esta función y solo se
 * ejecuta una vez. Sin él, cada carga del panel haría dos veces la consulta de
 * solicitudes pendientes y dos veces la de turnos de devocional.
 *
 * Ojo con el matiz: `cache()` deduplica por render de servidor, no entre
 * peticiones. No es un caché de datos y no hay nada que invalidar.
 */
export type FlagsDelMenu = {
  solicitudesPendientes: number;
  puedeVerSolicitudes: boolean;
  puedeEscribirDevocionales: boolean;
  puedeVerFinanzas: boolean;
  puedeVerEventos: boolean;
  puedeVerReuniones: boolean;
  esPastorDeLaIglesia: boolean;
};

export const flagsDelMenu = cache(
  async (ctx: UserContext): Promise<FlagsDelMenu> => {
    const puedeVerSolicitudes =
      esPastor(ctx) || puede(ctx, 'aprobar_solicitudes');

    // Con el permiso, o simplemente teniendo un turno asignado: a quien le toca
    // el jueves tiene que poder llegar a escribirlo sin que nadie le configure
    // nada más.
    const puedeEscribirDevocionales =
      esPastor(ctx) ||
      puede(ctx, 'escribir_devocionales') ||
      (await misTurnosPendientes(ctx)).length > 0;

    // El contador solo se pide si esta persona va a ver la sección. Para un
    // líder de alabanza sería una consulta en cada carga del panel para un
    // número que no se pinta.
    const solicitudesPendientes = puedeVerSolicitudes
      ? await contarSolicitudesPendientes(ctx)
      : 0;

    return {
      solicitudesPendientes,
      puedeVerSolicitudes,
      puedeEscribirDevocionales,
      puedeVerFinanzas: puedeGestionarFinanzas(ctx),
      puedeVerEventos: puedeGestionarEventos(ctx),
      // Sin función propia en `permisos.ts` como finanzas o eventos: no hay
      // ámbito que cruzar ni segundo camino que resolver, es el permiso a secas
      // más el pastor. Una función `puedeRegistrarAsistencia()` que solo
      // envolviera este `||` sería una indirección sin nada dentro.
      puedeVerReuniones: esPastor(ctx) || puede(ctx, 'registrar_asistencia'),
      esPastorDeLaIglesia: esPastor(ctx),
    };
  },
);
