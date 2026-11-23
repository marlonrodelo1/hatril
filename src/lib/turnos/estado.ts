import type { TurnoResumen } from './consultas';

/**
 * Qué le falta a un turno, y cómo se dice en una línea. Sin `server-only`:
 * son cuentas sobre lo que ya se consultó, y las pinta también la vista de
 * turnos que comparten la web y la app empaquetada. Vivían en `./en-la-app`,
 * que las sigue exportando.
 */
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
