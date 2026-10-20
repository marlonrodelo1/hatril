import 'server-only';

import { sumarDias } from '@/lib/agenda/horarios';
import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { proximosTurnos } from '@/lib/turnos/en-la-app';
import { cancionesDelTurno } from './consultas';

/**
 * El repertorio en la portada del líder: la lista del próximo culto.
 *
 * Mira el turno y no el repertorio, porque lo que pide atención el viernes no
 * es cuántas canciones tiene el equipo, sino si ya se sabe qué se toca el
 * domingo. El enlace baja a la lista dentro del turno (`#canciones`), que es
 * donde se monta, y no al repertorio.
 *
 * Los turnos los pide con `proximosTurnos()`, el mismo `cache()` que la tarjeta
 * de los turnos: en la portada salen las dos y el viaje se hace una vez.
 */

/** Por debajo de esto, una lista vacía deja de ser «pendiente» y pasa a urgente. */
const DIAS_DE_MARGEN = 3;

export const repertorioEnLaApp: ModuloEnLaApp = {
  id: 'repertorio',
  abrir: 'Ver el repertorio',
  pantalla: 'app',
  async resumen(ctx, ministerio, hoy) {
    const [siguiente] = await proximosTurnos(ctx, ministerio.id, hoy);

    if (!siguiente) {
      return {
        pendientes: [],
        vacio:
          'La lista de canciones cuelga de cada turno, y no hay ninguno en las próximas semanas.',
      };
    }

    const lista = await cancionesDelTurno(ctx, siguiente.id);
    const cuando = `${cuandoCorto(siguiente.fecha, siguiente.hora, hoy)} · ${siguiente.titulo}`;
    const href = `${rutaApp(ministerio.id, 'turnos', siguiente.id)}#canciones`;

    if (lista.length === 0) {
      return {
        pendientes: [
          {
            texto: cuando,
            detalle: 'Todavía sin lista de canciones',
            href,
            urgente: siguiente.fecha <= sumarDias(hoy, DIAS_DE_MARGEN),
          },
        ],
        vacio: '',
      };
    }

    const titulos = lista.map((c) => c.titulo);
    return {
      pendientes: [],
      proximo: {
        texto: `${cuando} · ${lista.length} ${lista.length === 1 ? 'canción' : 'canciones'}`,
        detalle:
          titulos.length > 3
            ? `${titulos.slice(0, 3).join(', ')}…`
            : titulos.join(', '),
        href,
      },
      vacio: '',
    };
  },
};
