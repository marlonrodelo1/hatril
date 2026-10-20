'use server';

import * as panel from '@/app/panel/ministerios/[id]/repertorio/actions';
import { enLaApp } from '@/lib/ministerios/en-la-app/acciones';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';

/**
 * El repertorio desde la app: las actions del panel, envueltas. Las de la
 * lista de un culto no están aquí sino en `../turnos/actions.ts`, porque viven
 * en la pantalla del turno.
 */

const REPERTORIO = ['repertorio'] as const;

export async function crearCancion(ministerioId: string, formData: FormData) {
  await enLaApp(
    { ministerioId, modulos: REPERTORIO, volver: rutaApp(ministerioId, 'repertorio', 'nueva') },
    () => panel.crearCancion(ministerioId, formData),
  );
}

export async function editarCancion(
  ministerioId: string,
  cancionId: string,
  formData: FormData,
) {
  await enLaApp(
    { ministerioId, modulos: REPERTORIO, volver: rutaApp(ministerioId, 'repertorio', cancionId) },
    () => panel.editarCancion(ministerioId, cancionId, formData),
  );
}

export async function archivarCancion(
  ministerioId: string,
  cancionId: string,
  archivar: boolean,
) {
  await enLaApp(
    { ministerioId, modulos: REPERTORIO, volver: rutaApp(ministerioId, 'repertorio', cancionId) },
    () => panel.archivarCancion(ministerioId, cancionId, archivar === true),
  );
}

export async function borrarCancion(ministerioId: string, cancionId: string) {
  await enLaApp(
    { ministerioId, modulos: REPERTORIO, volver: rutaApp(ministerioId, 'repertorio', cancionId) },
    () => panel.borrarCancion(ministerioId, cancionId),
  );
}
