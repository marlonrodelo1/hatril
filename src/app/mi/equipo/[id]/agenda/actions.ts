'use server';

import * as panel from '@/app/panel/ministerios/[id]/agenda/actions';
import { enLaApp } from '@/lib/ministerios/en-la-app/acciones';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';

/**
 * La agenda del equipo desde la app: las actions del panel, envueltas.
 *
 * `guardarListaDelEquipo` es la importante y no se toca ni una coma: escribe
 * una fila por cada persona de `listaDelEquipo()`, no por cada uuid que traiga
 * el formulario, y esa lista ya deja fuera a quien negó el permiso de
 * asistencia. Si aquí se reescribiera, esa promesa de `/privacidad` tendría dos
 * sitios donde romperse.
 */

const AGENDA = ['agenda'] as const;

export async function crearReunionDeMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: AGENDA, volver: rutaApp(ministerioId, 'agenda', 'nueva') },
    () => panel.crearReunionDeMinisterio(ministerioId, formData),
  );
}

export async function editarReunionDeMinisterio(
  ministerioId: string,
  reunionId: string,
  formData: FormData,
) {
  await enLaApp(
    {
      ministerioId,
      modulos: AGENDA,
      volver: rutaApp(ministerioId, 'agenda', reunionId, 'editar'),
    },
    () => panel.editarReunionDeMinisterio(ministerioId, reunionId, formData),
  );
}

export async function guardarListaDelEquipo(
  ministerioId: string,
  reunionId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: AGENDA, volver: rutaApp(ministerioId, 'agenda', reunionId) },
    () => panel.guardarListaDelEquipo(ministerioId, reunionId, formData),
  );
}

export async function borrarReunionDeMinisterio(
  ministerioId: string,
  reunionId: string,
) {
  await enLaApp(
    { ministerioId, modulos: AGENDA, volver: rutaApp(ministerioId, 'agenda', reunionId) },
    () => panel.borrarReunionDeMinisterio(ministerioId, reunionId),
  );
}
