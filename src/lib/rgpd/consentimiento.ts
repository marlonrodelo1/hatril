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
 *
 * LA DEUDA QUE HABÍA AQUÍ ESTÁ CERRADA, Y CONVIENE SABER CÓMO
 * -----------------------------------------------------------
 * Durante meses esta constante se quedó en `privacidad-2026-08` mientras el
 * texto cambiaba debajo: finanzas y eventos reescribieron §3, §4 y §6 y nadie
 * la subió. No fue descuido — estaba razonado aquí mismo: subirla deja a toda
 * la congregación en estado caducado, y no existía forma de resolverlo. Sin
 * pantalla de «vuelve a aceptar», subirla solo habría creado un incumplimiento
 * visible en la base a cambio de nada.
 *
 * La asistencia y el seguimiento forzaron cerrarla, porque son el dato más
 * sensible del producto y no podían entrar bajo una etiqueta que ya designaba
 * dos textos distintos. Se hizo en el orden que este comentario pedía:
 *
 *   1. La pantalla de re-consentimiento — `/acepta`, más el corte en
 *      `requireIglesia()`. Sin correo, que sigue sin montarse: se la encuentra
 *      quien entra. Es peor que un aviso por correo y es infinitamente mejor
 *      que nada, porque a quien no entra tampoco le estamos tratando nada nuevo.
 *   2. Esta subida, UNA sola vez y con todo dentro: los cambios de finanzas y
 *      eventos que venían pendientes, más asistencia y seguimiento.
 *
 * Lo que sigue pendiente y NO bloquea esto: rellenar `ALOJAMIENTO` en
 * `datos-responsable.ts`, que es lo que mantiene el aviso rojo sobre los dos
 * textos legales.
 */
export const VERSION_POLITICA_PRIVACIDAD = 'privacidad-2026-09';

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

/**
 * La casilla de la asistencia y el seguimiento.
 *
 * SE DICE LO QUE SE GUARDA, NO LA CATEGORÍA JURÍDICA
 * --------------------------------------------------
 * «Tratamiento de datos de participación en actos de culto» es correcto y no
 * significa nada para quien lo lee. Aquí se nombra la cosa: si vine o no el
 * domingo, y lo que se apunta cuando alguien me llama porque llevo tiempo sin
 * aparecer. Un consentimiento que el interesado no ha entendido no es válido
 * aunque esté marcado (art. 7.2).
 *
 * Y se dice lo que NO se guarda, que es la mitad que tranquiliza: la lista de
 * resultados es cerrada, así que nadie va a escribir ahí por qué se separó.
 */
export const TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO =
  'Autorizo a que mi iglesia apunte si vengo o no a sus reuniones, y lo que se ' +
  'hable conmigo si alguien del equipo me contacta porque llevo tiempo sin ' +
  'aparecer. Sé que se elige de una lista y que nadie escribe ahí nada sobre ' +
  'mi salud ni mi vida privada. Puedo retirar este permiso cuando quiera, y si ' +
  'lo retiro dejo de aparecer en esas listas.';

export const TEXTO_CONSENTIMIENTO_COMUNICACIONES =
  'Quiero recibir avisos de mi iglesia sobre eventos y actividades.';

/**
 * Para quien se apunta a un evento SIN ser de la congregación.
 *
 * Es un consentimiento distinto del de arriba y por eso tiene texto propio: allí
 * la persona autoriza un vínculo con la iglesia, y aquí no hay vínculo ninguno
 * —el vecino que va a un concierto no se hace miembro de nada—. Prometer menos
 * es lo que lo hace válido: se dice para qué son los datos, se dice que no la
 * dan de alta en el fichero, y se dice cómo se van.
 *
 * Se guarda en `evento_inscripciones.consentimiento_version` y NO en la tabla
 * `consentimientos`, que exige `miembro_id`. La consecuencia buena es que este
 * consentimiento es independiente del de la congregación: el día que suba
 * `VERSION_POLITICA_PRIVACIDAD` no habrá que re-preguntar a toda la iglesia por
 * culpa de un evento.
 */
export const TEXTO_CONSENTIMIENTO_EVENTO = (iglesia: string): string =>
  `Autorizo expresamente a ${iglesia} a tratar mis datos —nombre, correo, ` +
  'teléfono y lo que escriba en la nota— para organizar este evento y ponerse ' +
  'en contacto conmigo si cambia o se cancela. Sé que se guarda también la ' +
  'conexión desde la que me apunto, como prueba de que fui yo. Entiendo que ' +
  'apuntarme a un acto de una iglesia revela mis convicciones religiosas, que ' +
  'son un dato especialmente protegido, y que doy este permiso libremente. ' +
  'Puedo retirarlo cuando quiera, sin dar explicaciones y sin que eso afecte a ' +
  'lo ya hecho antes. Apuntarme no me hace miembro de esta iglesia.';

/**
 * Versión del texto de la casilla del EVENTO, aparte de la de la política.
 *
 * POR QUÉ NO VALE `VERSION_POLITICA_PRIVACIDAD`
 * ---------------------------------------------
 * Porque son dos cosas con ritmos distintos. La versión de la política solo
 * puede subir cuando exista forma de re-preguntar a toda la congregación —ver
 * la deuda de arriba—, y mientras tanto se queda quieta aunque el texto cambie.
 * Guardar ESA etiqueta con la inscripción de alguien hacía que la fila apuntara
 * a un texto que ya no es el que leyó.
 *
 * Esta sube cada vez que cambie `TEXTO_CONSENTIMIENTO_EVENTO` o la información
 * que se enseña junto al formulario, y subirla no cuesta nada: el consentimiento
 * de un inscrito se agota con el evento y no hay a quién volver a preguntar.
 */
export const VERSION_CONSENTIMIENTO_EVENTO = 'evento-2026-08';

export const TEXTO_CONSENTIMIENTO_IMAGEN =
  'Autorizo que mi foto aparezca en el directorio interno de la congregación.';
