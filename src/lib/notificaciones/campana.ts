import 'server-only';

import { haceCuanto } from '@/lib/fecha/relativo';
import { textoNotificacion } from './textos';
import type { Notificacion } from './consultas';
import type { AvisoEnCampana } from '@/components/campana';

/**
 * Los avisos, ya compuestos para el desplegable de la campana.
 *
 * POR QUÉ AQUÍ Y NO DENTRO DE CADA CABECERA
 * -----------------------------------------
 * Vivía suelta en `panel/_components/cabecera.tsx`. La cabecera del área del
 * miembro necesita exactamente lo mismo, y copiarla habría dejado dos sitios
 * donde decidir cuántos avisos caben y cómo se escribe la hora — que es
 * literalmente el error que `lib/fecha/relativo.ts` cuenta en su cabecera.
 *
 * Se compone en el SERVIDOR a propósito: así el navegador no recibe el catálogo
 * entero de textos de `textos.ts` por un desplegable que la mayoría no abre. Es
 * la razón de que `Campana` reciba cadenas y no filas.
 *
 * Se cortan a ocho: el desplegable no es la bandeja, es el vistazo. Lo demás
 * está detrás de «Verlos todos».
 */
export function paraLaCampana(avisos: Notificacion[]): AvisoEnCampana[] {
  return avisos.slice(0, 8).map((a) => {
    const { titulo, detalle } = textoNotificacion(a.tipo, a.datos);
    return {
      id: a.id,
      titulo,
      detalle,
      cuando: haceCuanto(a.createdAt),
      leida: a.leida,
    };
  });
}
