import { endpointApp, publica } from '@/lib/api/app';
import type { RespuestaVersion } from '@/lib/app-api/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La versión mínima de la app que la API sigue atendiendo.
 *
 * Una versión instalada vive meses, y un fallo en el binario no se arregla
 * desplegando la web. Si alguna vez hay que dejar atrás una versión —un fallo
 * grave, o un `/api/v2/app` que la vieja no entiende—, se sube este número y
 * la app que esté por debajo pide actualizar al abrirse.
 *
 * En variables de entorno y no en el código, como los precios: cambiarlo no
 * debe costar un despliegue. Sin la variable, `0.0.0`: no se le exige nada a
 * nadie.
 */
export const GET = endpointApp({ guarda: publica }, async () => {
  const respuesta: RespuestaVersion = {
    minima: process.env.APP_VERSION_MINIMA?.trim() || '0.0.0',
  };
  return respuesta;
});
