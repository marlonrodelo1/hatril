'use server';

import { redirect } from 'next/navigation';
// Las mismas dos funciones que usa `enLaApp` para leer un `redirect()` de Next.
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';

import * as panel from '@/app/panel/ministerios/[id]/ninos/actions';
import { enLaApp } from '@/lib/ministerios/en-la-app/acciones';
import { rutaApp, traducirAlApp } from '@/lib/ministerios/en-la-app/rutas';

/**
 * El tablón de Niños desde la app del equipo: las actions del panel,
 * envueltas. `enLaApp` pone las puertas de la app (llevar el ministerio, la
 * del adaptador, el módulo encendido) y traduce a dónde vuelve cada una.
 *
 * Fuera, a propósito: el cronograma (en la app se lee, no se escribe) y el
 * drive suelto (borrar y descargar el mes, que son cosa del panel).
 */

const NINOS = ['ninos'] as const;
const tablon = (id: string) => rutaApp(id, 'ninos');
const publicacionEnLaApp = (id: string, pubId: string) => rutaApp(id, 'ninos', 'publicacion', pubId);
const familias = (id: string) => rutaApp(id, 'ninos', 'familias');

export async function crearPublicacion(ministerioId: string, formData: FormData) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: tablon(ministerioId) }, () =>
    panel.crearPublicacion(ministerioId, formData),
  );
}

export async function editarPublicacion(ministerioId: string, publicacionId: string, formData: FormData) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: publicacionEnLaApp(ministerioId, publicacionId) }, () =>
    panel.editarPublicacion(ministerioId, publicacionId, formData),
  );
}

export async function publicar(ministerioId: string, publicacionId: string, formData: FormData) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: publicacionEnLaApp(ministerioId, publicacionId) }, () =>
    panel.publicar(ministerioId, publicacionId, formData),
  );
}

export async function retirarPublicacion(ministerioId: string, publicacionId: string) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: publicacionEnLaApp(ministerioId, publicacionId) }, () =>
    panel.retirarPublicacion(ministerioId, publicacionId),
  );
}

export async function borrarPublicacion(ministerioId: string, publicacionId: string) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: tablon(ministerioId) }, () =>
    panel.borrarPublicacion(ministerioId, publicacionId),
  );
}

export async function adjuntarArchivos(ministerioId: string, publicacionId: string, formData: FormData) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: publicacionEnLaApp(ministerioId, publicacionId) }, () =>
    panel.adjuntarArchivos(ministerioId, publicacionId, formData),
  );
}

export async function quitarDePublicacion(ministerioId: string, publicacionId: string, archivoId: string) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: publicacionEnLaApp(ministerioId, publicacionId) }, () =>
    panel.quitarDePublicacion(ministerioId, publicacionId, archivoId),
  );
}

export async function aceptarSolicitud(ministerioId: string, solicitudId: string, formData: FormData) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: familias(ministerioId) }, () =>
    panel.aceptarSolicitud(ministerioId, solicitudId, formData),
  );
}

export async function rechazarSolicitud(ministerioId: string, solicitudId: string) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: familias(ministerioId) }, () =>
    panel.rechazarSolicitud(ministerioId, solicitudId),
  );
}

export async function quitarFamilia(ministerioId: string, ninoId: string, miembroId: string) {
  await enLaApp({ ministerioId, modulos: NINOS, volver: familias(ministerioId) }, () =>
    panel.quitarFamilia(ministerioId, ninoId, miembroId),
  );
}

/**
 * Las dos de subir DEVUELVEN datos (las URL firmadas, si llegó el fichero), y
 * `enLaApp` es para las que redirigen. Así que van a pelo, con las guardas del
 * panel —que son las mismas puertas que las de la app para este módulo: el
 * pastor o quien lleva el ministerio desde dentro, con el módulo encendido— y
 * con la redirección de esas guardas traducida a la app, para que un «no
 * tienes permiso» no lleve a una ruta del panel que la app no tiene.
 */
async function conRutasDeLaApp<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isRedirectError(err)) redirect(traducirAlApp(getURLFromRedirectError(err)));
    throw err;
  }
}

export async function prepararSubida(
  ministerioId: string,
  datos: Parameters<typeof panel.prepararSubida>[1],
) {
  return conRutasDeLaApp(() => panel.prepararSubida(ministerioId, datos));
}

export async function confirmarSubida(ministerioId: string, archivoId: string) {
  return conRutasDeLaApp(() => panel.confirmarSubida(ministerioId, archivoId));
}
