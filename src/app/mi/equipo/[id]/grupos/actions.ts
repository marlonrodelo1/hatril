'use server';

import * as panel from '@/app/panel/ministerios/[id]/grupos/actions';
import { enLaApp } from '@/lib/ministerios/en-la-app/acciones';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';

/**
 * La guía de la red desde la app: la action del panel, envuelta.
 *
 * `enLaApp` aplica la puerta estrecha del adaptador (`gruposEnLaApp.
 * visiblePara`, `puedeGestionarDesdeDentro`) antes de llamarla, y traduce su
 * `redirect` a esta pantalla. La del panel vuelve a mirar las suyas.
 */
export async function publicarGuia(ministerioId: string, formData: FormData) {
  await enLaApp(
    { ministerioId, modulos: ['grupos'], volver: rutaApp(ministerioId, 'grupos') },
    () => panel.publicarGuia(ministerioId, formData),
  );
}
