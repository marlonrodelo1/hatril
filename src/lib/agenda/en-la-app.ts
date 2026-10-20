import 'server-only';

import { listarReuniones } from '@/lib/asistencia/consultas';
import type {
  ModuloEnLaApp,
  Pendiente,
} from '@/lib/ministerios/en-la-app/contrato';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { sumarDias } from './horarios';

/**
 * La agenda del equipo en la portada del líder: los ensayos sin lista y el
 * siguiente que viene.
 *
 * SIN LISTA ES `marcados === 0`, NO «NO VINO NADIE»
 * --------------------------------------------------
 * Es la distinción que ya hace `listarReuniones`: cero filas repasadas es que
 * nadie pasó lista, y un ensayo al que no fue nadie tiene sus filas, todas en
 * «no vino». Solo lo primero pide atención.
 *
 * Y solo lo de las últimas tres semanas. Un ensayo de junio sin lista ya no lo
 * va a pasar nadie, y enseñarlo cada vez convierte la tarjeta en un reproche
 * que se deja de leer. En la pantalla de la agenda sigue saliendo marcado.
 *
 * El de hoy cuenta como pendiente aunque sea por la noche: es justo el que el
 * líder abre en el ensayo para pasar lista, y tenerlo arriba ahorra buscarlo.
 */

const DIAS_HACIA_ATRAS = 21;
const EN_LA_PORTADA = 2;

export const agendaEnLaApp: ModuloEnLaApp = {
  id: 'agenda',
  abrir: 'Ver la agenda',
  pantalla: 'app',
  async resumen(ctx, ministerio, hoy) {
    // Vienen de la más reciente hacia atrás, con las futuras delante.
    const reuniones = await listarReuniones(ctx, {
      ministerioId: ministerio.id,
      limite: 40,
    });
    const base = rutaApp(ministerio.id, 'agenda');
    const desde = sumarDias(hoy, -DIAS_HACIA_ATRAS);

    const sinLista: Pendiente[] = reuniones
      .filter((r) => r.fecha <= hoy && r.fecha >= desde && r.marcados === 0)
      .map((r) => ({
        texto: `${cuandoCorto(r.fecha, r.hora, hoy)} · ${r.titulo}`,
        detalle: 'Sin lista pasada',
        href: `${base}/${r.id}`,
      }));

    const siguiente = reuniones
      .filter((r) => r.fecha > hoy)
      .sort((a, b) =>
        a.fecha === b.fecha
          ? (a.hora ?? '').localeCompare(b.hora ?? '')
          : a.fecha.localeCompare(b.fecha),
      )[0];

    return {
      pendientes: sinLista.slice(0, EN_LA_PORTADA),
      restantes: Math.max(0, sinLista.length - EN_LA_PORTADA),
      proximo: siguiente
        ? {
            texto: `${cuandoCorto(siguiente.fecha, siguiente.hora, hoy)} · ${siguiente.titulo}`,
            detalle: siguiente.lugar ?? undefined,
            href: `${base}/${siguiente.id}`,
          }
        : null,
      vacio: 'No hay nada en la agenda del equipo.',
    };
  },
};
