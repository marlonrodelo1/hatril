import 'server-only';

/**
 * Consentimiento para datos de categoría especial (art. 9 RGPD).
 *
 * POR QUÉ ESTO NO ES UNA CASILLA
 * ------------------------------
 * La pertenencia a una congregación revela la confesión religiosa de una
 * persona, que el art. 9.1 del RGPD prohíbe tratar salvo que se dé alguna de
 * las excepciones del 9.2. A Hatril le aplican dos, y conviene tenerlas claras
 * porque no dicen lo mismo:
 *
 *   9.2.a) consentimiento explícito del interesado.
 *   9.2.d) tratamiento por una entidad sin ánimo de lucro de finalidad
 *          religiosa, referido solo a sus miembros o a quienes mantienen
 *          contacto regular con ella, y siempre que los datos NO se comuniquen
 *          fuera sin consentimiento.
 *
 * La iglesia se ampara normalmente en la (d) para su propio fichero. Hatril, en
 * cambio, es un TERCERO que trata esos datos por cuenta de la iglesia, así que
 * se apoya en la (a): consentimiento explícito, y además el encargo de
 * tratamiento firmado con cada congregación.
 *
 * Y el art. 7.1 obliga a poder DEMOSTRARLO. De ahí que se guarde una fila por
 * consentimiento con su fecha, su versión de texto y la evidencia técnica, en
 * vez de un booleano que no probaría nada.
 */

/**
 * Versión del texto de privacidad vigente.
 *
 * Se guarda con CADA consentimiento. Es el campo que casi siempre se olvida y
 * el que más cara sale su ausencia: sin él, el día que cambie la política no
 * hay forma de saber a qué redacción dijo que sí cada persona, y un cambio de
 * texto invalidaría en silencio todo lo aceptado antes.
 *
 * Al cambiar la política: subir esta constante Y pedir el consentimiento otra
 * vez a quien tenga una versión anterior. Cambiarla a solas es peor que no
 * cambiarla, porque deja la base diciendo que aceptaron algo que no leyeron.
 */
export const VERSION_POLITICA_PRIVACIDAD = 'privacidad-2026-08';

/**
 * Texto exacto que se muestra junto a la casilla del registro.
 *
 * Vive en el código y no en la base de datos porque tiene que estar versionado
 * junto a la constante de arriba: si el texto pudiera cambiar sin que cambie la
 * versión, el registro de consentimientos mentiría.
 *
 * Redactado para que se entienda de qué se está dando permiso —«tu iglesia» y
 * «datos religiosos», no «tratamiento de categorías especiales»—, porque el
 * art. 7.2 exige lenguaje claro y sencillo, y porque un consentimiento que el
 * interesado no ha entendido no es válido aunque esté marcado.
 */
export const TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS =
  'Autorizo a que Hatril guarde mis datos y mi vínculo con esta iglesia para ' +
  'que la congregación pueda organizarse. Sé que estos son datos protegidos y ' +
  'que puedo retirar este permiso cuando quiera.';

export const TEXTO_CONSENTIMIENTO_COMUNICACIONES =
  'Quiero recibir avisos de mi iglesia sobre eventos y actividades.';

export const TEXTO_CONSENTIMIENTO_IMAGEN =
  'Autorizo que mi foto aparezca en el directorio interno de la congregación.';
