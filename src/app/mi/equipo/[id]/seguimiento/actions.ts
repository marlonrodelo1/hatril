'use server';

import * as panel from '@/app/panel/ministerios/[id]/seguimiento/actions';
import { enLaApp } from '@/lib/ministerios/en-la-app/acciones';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';

/**
 * El seguimiento desde la app: las actions del panel, envueltas.
 *
 * Las tres puertas del panel —`ver_seguimiento`, llevar ESTE ministerio y que
 * la persona salga en la lista, que es lo que deja fuera a quien negó el
 * permiso de asistencia— las sigue poniendo la action del panel. `enLaApp()`
 * añade el muro con el destino de aquí y el módulo encendido.
 */

const SEGUIMIENTO = ['seguimiento'] as const;

export async function registrarContacto(
  ministerioId: string,
  miembroId: string,
  formData: FormData,
) {
  await enLaApp(
    {
      ministerioId,
      modulos: SEGUIMIENTO,
      volver: rutaApp(ministerioId, 'seguimiento', miembroId),
    },
    () => panel.registrarContacto(ministerioId, formData),
  );
}

export async function asignarAcompanante(
  ministerioId: string,
  miembroId: string,
  formData: FormData,
) {
  await enLaApp(
    {
      ministerioId,
      modulos: SEGUIMIENTO,
      volver: rutaApp(ministerioId, 'seguimiento', miembroId),
    },
    () => panel.asignarAcompanante(ministerioId, miembroId, formData),
  );
}

export async function borrarContacto(
  ministerioId: string,
  miembroId: string,
  contactoId: string,
) {
  await enLaApp(
    {
      ministerioId,
      modulos: SEGUIMIENTO,
      volver: rutaApp(ministerioId, 'seguimiento', miembroId),
    },
    () => panel.borrarContacto(ministerioId, miembroId, contactoId),
  );
}
