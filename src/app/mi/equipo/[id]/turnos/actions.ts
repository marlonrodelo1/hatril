'use server';

import * as panel from '@/app/panel/ministerios/[id]/turnos/actions';
import * as lista from '@/app/panel/ministerios/[id]/repertorio/actions';
import { enLaApp } from '@/lib/ministerios/en-la-app/acciones';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';

/**
 * Los turnos desde la app: las MISMAS actions del panel, envueltas.
 *
 * Aquí no hay lógica, y es el punto. Quién puede, que el turno sea de este
 * ministerio, los avisos a quien se pone en un puesto: todo eso lo hace la
 * action del panel, que es la única que existe. `enLaApp()` comprueba el muro y
 * el módulo con el destino de aquí, la ejecuta y cambia `/panel/ministerios` por
 * `/mi/equipo` en su `redirect`. El porqué, entero, en `en-la-app/acciones.ts`.
 *
 * Los ids llegan por `.bind()` desde las pantallas, igual que en el panel, y
 * `rutaApp()` los valida antes de usarlos para construir un destino.
 *
 * La lista de canciones también va aquí aunque sus actions sean del
 * repertorio: vive en la pantalla del turno y pide las dos herramientas.
 */

const TURNOS = ['turnos'] as const;
const LISTA = ['turnos', 'repertorio'] as const;

export async function planificarTurnos(ministerioId: string, formData: FormData) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', 'planificar') },
    () => panel.planificarTurnos(ministerioId, formData),
  );
}

export async function crearTurno(ministerioId: string, formData: FormData) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', 'planificar') },
    () => panel.crearTurno(ministerioId, formData),
  );
}

export async function editarTurno(
  ministerioId: string,
  turnoId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => panel.editarTurno(ministerioId, turnoId, formData),
  );
}

export async function borrarTurno(ministerioId: string, turnoId: string) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => panel.borrarTurno(ministerioId, turnoId),
  );
}

export async function asignarAlTurno(
  ministerioId: string,
  turnoId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => panel.asignarAlTurno(ministerioId, turnoId, formData),
  );
}

export async function quitarDelTurno(
  ministerioId: string,
  turnoId: string,
  asignacionId: string,
) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => panel.quitarDelTurno(ministerioId, turnoId, asignacionId),
  );
}

export async function marcarRespuesta(
  ministerioId: string,
  turnoId: string,
  miembroId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => panel.marcarRespuesta(ministerioId, turnoId, miembroId, formData),
  );
}

export async function copiarTurno(
  ministerioId: string,
  turnoId: string,
  desdeTurnoId: string,
) {
  await enLaApp(
    { ministerioId, modulos: TURNOS, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => panel.copiarTurno(ministerioId, turnoId, desdeTurnoId),
  );
}

// ---------------------------------------------------------------------------
// La lista de canciones del culto
// ---------------------------------------------------------------------------

export async function agregarCancionAlTurno(
  ministerioId: string,
  turnoId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: LISTA, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => lista.agregarCancionAlTurno(ministerioId, turnoId, formData),
  );
}

export async function quitarCancionDelTurno(
  ministerioId: string,
  turnoId: string,
  filaId: string,
) {
  await enLaApp(
    { ministerioId, modulos: LISTA, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => lista.quitarCancionDelTurno(ministerioId, turnoId, filaId),
  );
}

export async function moverCancion(
  ministerioId: string,
  turnoId: string,
  filaId: string,
  direccion: 'arriba' | 'abajo',
) {
  await enLaApp(
    { ministerioId, modulos: LISTA, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => lista.moverCancion(ministerioId, turnoId, filaId, direccion),
  );
}

export async function cambiarTonoDelDia(
  ministerioId: string,
  turnoId: string,
  filaId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: LISTA, volver: rutaApp(ministerioId, 'turnos', turnoId) },
    () => lista.cambiarTonoDelDia(ministerioId, turnoId, filaId, formData),
  );
}
