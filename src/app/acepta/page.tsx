import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { estadoConsentimiento } from '@/lib/rgpd/consultas';
import { VistaAcepta } from './_components/vista-acepta';

export const metadata: Metadata = { title: 'Tu permiso' };

/**
 * Volver a pedir el consentimiento cuando la política cambia de fondo.
 *
 * FUERA DE `/panel`, Y ESO ES LO QUE EVITA EL BUCLE
 * -------------------------------------------------
 * El corte vive en `panel/layout.tsx`. Si esta pantalla colgara de ahí, se
 * redirigiría a sí misma para siempre. Colgando de la raíz, quien tiene el
 * consentimiento caducado puede llegar aquí, leer y decidir.
 *
 * SE DICE QUÉ HA CAMBIADO, NO SOLO QUE HA CAMBIADO
 * -------------------------------------------------
 * «Hemos actualizado nuestra política, acepta para continuar» es la fórmula que
 * todo el mundo pulsa sin leer, y un consentimiento que nadie ha leído no es
 * válido aunque esté marcado (art. 7.2). Aquí se enumera lo que se añadió desde
 * la versión anterior, en tres líneas y en castellano.
 */
export default async function AceptaPage() {
  const ctx = await requireIglesia();

  // Sin versión aceptada, esta persona no viene de un texto viejo: es una
  // cuenta del alta asistida que todavía no ha dicho nada. «Ha cambiado» y
  // «qué es lo nuevo» le estarían hablando de algo que nunca leyó.
  const primeraVez =
    (await estadoConsentimiento(ctx)).versionAceptada === null;

  return <VistaAcepta iglesiaNombre={ctx.iglesia.nombre} primeraVez={primeraVez} />;
}
