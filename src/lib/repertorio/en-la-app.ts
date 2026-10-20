import 'server-only';

import { sumarDias } from '@/lib/agenda/horarios';
import { tieneModulo } from '@/lib/ministerios/modulos';
import type { ModuloEnLaApp } from '@/lib/ministerios/en-la-app/contrato';
import { cuandoCorto, diaCorto } from '@/lib/ministerios/en-la-app/fechas';
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
    // La lista cuelga del turno: sin los turnos encendidos no hay culto que
    // enseñar, y su pantalla daría 404. Es la regla de `guardaDeLaLista` en el
    // panel, que pide las dos herramientas. Los turnos que ya existían siguen
    // en la base, por eso no basta con que no haya ninguno.
    if (!tieneModulo(ministerio.modulos, 'turnos')) {
      return {
        pendientes: [],
        vacio:
          'La lista de cada culto se monta dentro de su turno, y este ministerio no tiene los turnos encendidos. Los enciende el pastor desde «Módulos».',
      };
    }

    const [siguiente] = await proximosTurnos(ctx, ministerio.id, hoy);

    if (!siguiente) {
      return {
        pendientes: [],
        // Que lo diga es cosa de la tarjeta de los turnos; aquí, dónde se hace.
        vacio:
          'No hay cultos en las próximas tres semanas. La lista de canciones se monta dentro de cada turno.',
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

    return {
      pendientes: [],
      proximo: { texto: `${cuando} · ${cuantas(lista.length)}`, detalle: primeras(lista), href },
      vacio: '',
    };
  },

  /**
   * Lo que se toca el próximo culto del equipo, para quien lo va a tocar.
   *
   * El del EQUIPO y no solo el suyo: el músico quiere ensayar lo del domingo
   * aunque esta semana no le toque, y la ficha del turno en la agenda
   * (`turnoParaMiembro`) se la abre a cualquiera del equipo. Una lista que
   * todavía no está no es un pendiente suyo, así que no pide atención.
   */
  async participante(ctx, ministerio, hoy) {
    // Lo mismo que para el líder: con los turnos apagados, ni el próximo culto
    // ni sus canciones son algo que el equipo esté usando.
    if (!tieneModulo(ministerio.modulos, 'turnos')) {
      return {
        pendientes: [],
        vacio: 'Las canciones de cada culto saldrán aquí cuando el equipo use los turnos.',
      };
    }

    const [siguiente] = await proximosTurnos(ctx, ministerio.id, hoy);
    if (!siguiente) {
      return {
        pendientes: [],
        vacio: 'No hay ningún culto del equipo en las próximas tres semanas.',
      };
    }

    const lista = await cancionesDelTurno(ctx, siguiente.id);
    const cuando = `${cuandoCorto(siguiente.fecha, siguiente.hora, hoy)} · ${siguiente.titulo}`;

    return {
      pendientes: [],
      proximo:
        lista.length > 0
          ? {
              texto: `${cuando} · ${cuantas(lista.length)}`,
              detalle: primeras(lista),
              href: `/mi/agenda/turno/${siguiente.id}`,
            }
          : null,
      vacio: `Todavía no está la lista ${paraElDia(siguiente.fecha, hoy)}. Saldrá aquí en cuanto la monten.`,
    };
  },
};

/** «para hoy», «para mañana», «del domingo 25». */
function paraElDia(fecha: string, hoy: string): string {
  const dia = diaCorto(fecha, hoy);
  if (dia === 'Hoy') return 'para hoy';
  if (dia === 'Mañana') return 'para mañana';
  return `del ${dia.toLocaleLowerCase('es')}`;
}

function cuantas(n: number): string {
  return `${n} ${n === 1 ? 'canción' : 'canciones'}`;
}

/** «Way Maker, Cuán grande es Él, Santo…»: las tres primeras, y basta. */
function primeras(lista: { titulo: string }[]): string {
  const titulos = lista.map((c) => c.titulo);
  return titulos.length > 3 ? `${titulos.slice(0, 3).join(', ')}…` : titulos.join(', ');
}
