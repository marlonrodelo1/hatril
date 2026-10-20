import 'server-only';

import { cache } from 'react';

import type { UserContext } from '@/lib/auth/user-context';
import { sumarDias } from '@/lib/agenda/horarios';
import type {
  ModuloEnLaApp,
  Pendiente,
} from '@/lib/ministerios/en-la-app/contrato';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarTurnos, misTurnos, type TurnoResumen } from './consultas';
import { puestosDelMinisterio } from './puestos';
import { ETIQUETA_RESPUESTA } from './respuestas';

/**
 * Los turnos en la zona de equipos: el adaptador de la portada y las cuentas que
 * comparten la portada y la lista de turnos.
 */

/** Tres semanas, como «Te toca servir» en la agenda del miembro. */
export const DIAS_POR_DELANTE = 21;

/**
 * Los turnos del equipo de hoy en adelante.
 *
 * En `cache()` de React porque en la portada lo piden dos tarjetas —la de los
 * turnos y la del repertorio, que mira la lista del próximo culto— y serían dos
 * viajes iguales a Irlanda en el mismo render. Como `getCurrentUserContext`,
 * deduplica dentro de una petición y nunca entre personas.
 */
export const proximosTurnos = cache(
  (ctx: UserContext, ministerioId: string, hoy: string) =>
    listarTurnos(ctx, ministerioId, {
      desde: hoy,
      hasta: sumarDias(hoy, DIAS_POR_DELANTE - 1),
      limite: 12,
    }),
);

export type EstadoDeTurno = {
  /** No hay nadie puesto en ningún puesto. */
  vacio: boolean;
  /** Puestos de la lista sin nadie que vaya a ir. */
  huecos: string[];
  /** Quién ha dicho que no puede, sin repetir a quien lo dijo en dos puestos. */
  noPueden: string[];
  /** Personas, no puestos, que todavía no han contestado. */
  sinContestar: number;
};

/**
 * Qué le falta a un turno.
 *
 * UN PUESTO CON SOLO «NO PUEDO» ESTÁ SIN CUBRIR
 * --------------------------------------------
 * El panel pinta «Sin cubrir» cuando no hay nadie puesto. Aquí se cuenta además
 * el puesto cuya única persona dijo que no: para quien mira la portada el
 * sábado por la noche, «Bajo: Pedro (no puede)» y «Bajo: nadie» piden lo mismo,
 * buscar a otro.
 */
export function estadoDeTurno(
  turno: TurnoResumen,
  puestos: string[],
): EstadoDeTurno {
  const cubiertos = new Set(
    turno.personas
      .filter((p) => p.respuesta !== 'no_puede')
      .map((p) => p.puesto.toLocaleLowerCase('es')),
  );

  return {
    vacio: turno.personas.length === 0,
    huecos: puestos.filter((p) => !cubiertos.has(p.toLocaleLowerCase('es'))),
    // Por ficha y no por nombre: dos Martas en el equipo son dos personas.
    // Y solo el nombre de pila, que en una línea de móvil es lo que cabe.
    noPueden: [
      ...new Map(
        turno.personas
          .filter((p) => p.respuesta === 'no_puede')
          .map((p) => [p.miembroId, p.nombre.split(' ')[0]!]),
      ).values(),
    ],
    sinContestar: new Set(
      turno.personas
        .filter((p) => p.respuesta === 'pendiente')
        .map((p) => p.miembroId),
    ).size,
  };
}

/** Hasta aquí se nombran los puestos; de ahí en adelante, «y 3 más». */
const PUESTOS_NOMBRADOS = 3;

/**
 * «Marta no puede · Sin cubrir: Bajo, Teclado · 2 sin contestar».
 *
 * Un turno sin nadie dice eso y nada más: la lista de los siete puestos de
 * alabanza ocupaba tres líneas para contar lo mismo. Y a partir del cuarto
 * puesto vacío se dejan de nombrar, por lo mismo.
 */
export function textoDelEstado(e: EstadoDeTurno): string | null {
  if (e.vacio) return 'Nadie puesto todavía';

  const partes: string[] = [];

  if (e.noPueden.length === 1) partes.push(`${e.noPueden[0]} no puede`);
  if (e.noPueden.length > 1) {
    partes.push(
      `${e.noPueden.slice(0, -1).join(', ')} y ${e.noPueden.at(-1)} no pueden`,
    );
  }
  if (e.huecos.length > 0) {
    const nombrados = e.huecos.slice(0, PUESTOS_NOMBRADOS).join(', ');
    const resto = e.huecos.length - PUESTOS_NOMBRADOS;
    partes.push(`Sin cubrir: ${nombrados}${resto > 0 ? ` y ${resto} más` : ''}`);
  }
  if (e.sinContestar === 1) partes.push('1 sin contestar');
  if (e.sinContestar > 1) partes.push(`${e.sinContestar} sin contestar`);

  return partes.length > 0 ? partes.join(' · ') : null;
}

/** Cuántos turnos con algo pendiente se enseñan en la portada. */
const EN_LA_PORTADA = 3;

export const turnosEnLaApp: ModuloEnLaApp = {
  id: 'turnos',
  abrir: 'Ver los turnos',
  pantalla: 'app',
  async resumen(ctx, ministerio, hoy) {
    const turnos = await proximosTurnos(ctx, ministerio.id, hoy);
    const puestos = puestosDelMinisterio(ministerio);
    const base = rutaApp(ministerio.id, 'turnos');

    if (turnos.length === 0) {
      return {
        pendientes: [
          {
            texto: 'Ningún culto planificado en las próximas tres semanas',
            detalle: 'Marca en cuáles sirve el equipo y pon a cada persona en su puesto.',
            href: `${base}/planificar`,
          },
        ],
        vacio: '',
      };
    }

    const conAlgo: Pendiente[] = [];
    for (const t of turnos) {
      const e = estadoDeTurno(t, puestos);
      const detalle = textoDelEstado(e);
      if (!detalle) continue;

      conAlgo.push({
        texto: `${cuandoCorto(t.fecha, t.hora, hoy)} · ${t.titulo}`,
        detalle,
        href: `${base}/${t.id}`,
        // Contestar a tiempo no es urgente; un puesto vacío o un «no puedo» sí:
        // si nadie lo mira, el domingo falta alguien.
        urgente: e.huecos.length > 0 || e.noPueden.length > 0,
      });
    }

    // El primero solo sale como «próximo» si no está ya entre los pendientes:
    // contado dos veces, parece que hay dos cultos.
    const primero = turnos[0]!;
    const primeroEnOrden = !textoDelEstado(estadoDeTurno(primero, puestos));

    return {
      pendientes: conAlgo.slice(0, EN_LA_PORTADA),
      restantes: Math.max(0, conAlgo.length - EN_LA_PORTADA),
      proximo: primeroEnOrden
        ? {
            texto: `${cuandoCorto(primero.fecha, primero.hora, hoy)} · ${primero.titulo}`,
            detalle: 'Todo cubierto y confirmado',
            href: `${base}/${primero.id}`,
          }
        : null,
      vacio: '',
    };
  },

  /**
   * Los turnos de quien mira, en este equipo. Con `misTurnos`, que se acota
   * sola a sus propias filas: aquí no sale ni el cuadrante ni lo que han
   * contestado los demás.
   *
   * Pide atención lo que tiene sin contestar. Lo confirmado sale como
   * «próximo» y el «no puedo» se dice tal cual, sin alarma: ya lo dijo, y a
   * quien lleva el equipo ya le llegó el aviso.
   */
  async participante(ctx, ministerio, hoy) {
    const mios = (
      await misTurnos(ctx, hoy, sumarDias(hoy, DIAS_POR_DELANTE - 1))
    ).filter((t) => t.ministerio.id === ministerio.id);

    const sinContestar = mios.filter((t) => t.respuesta === 'pendiente');
    const siguiente = mios.find((t) => t.respuesta !== 'pendiente');

    return {
      pendientes: sinContestar.slice(0, EN_LA_PORTADA).map((t) => ({
        texto: `${cuandoCorto(t.fecha, t.hora, hoy)} · ${t.titulo}`,
        detalle: `Te toca ${t.puestos.join(' y ')} · sin confirmar`,
        href: `/mi/agenda/turno/${t.id}`,
      })),
      restantes: Math.max(0, sinContestar.length - EN_LA_PORTADA),
      proximo:
        siguiente && sinContestar.length === 0
          ? {
              texto: `${cuandoCorto(siguiente.fecha, siguiente.hora, hoy)} · ${siguiente.titulo}`,
              detalle: `${siguiente.puestos.join(' y ')} · ${ETIQUETA_RESPUESTA[siguiente.respuesta].miembro}`,
              href: `/mi/agenda/turno/${siguiente.id}`,
            }
          : null,
      vacio: 'No te han puesto en ningún turno de las próximas tres semanas.',
      enlace: { texto: 'Ver mi agenda', href: '/mi/agenda' },
    };
  },
};
