import 'server-only';

import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { consentimientos } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { VERSION_POLITICA_PRIVACIDAD } from './consentimiento';

/**
 * Qué ha aceptado esta persona, y a qué versión del texto.
 *
 * POR QUÉ ESTO NO VIVE EN `user-context.ts`
 * -----------------------------------------
 * Tentaba meterlo en el contexto, que ya se consulta en cada carga. Se dejó
 * fuera porque el contexto lo pide TODO el panel y esto solo lo pregunta el
 * guard: una consulta más por render, en cada pantalla, para un dato que casi
 * siempre dice «al día».
 */

export type EstadoConsentimiento = {
  /** ¿Aceptó la versión que está vigente ahora mismo? */
  alDia: boolean;
  /**
   * Qué versión aceptó, si aceptó alguna. `null` significa que NO hay fila, que
   * no es lo mismo que haber dicho que no: la mayoría de las fichas las teclea
   * el pastor con la lista que ya tenía y esa vía nunca registró consentimiento
   * ninguno. A esas personas las cubre la base de la propia iglesia (art. 9.2.d)
   * más el encargo del art. 28, no una casilla que nadie les enseñó.
   */
  versionAceptada: string | null;
  /** ¿Aceptó además que se apunte su asistencia y su seguimiento? */
  asistenciaAceptada: boolean;
};

export async function estadoConsentimiento(
  ctx: UserContext,
): Promise<EstadoConsentimiento> {
  // Sin ficha no hay a qué colgar un consentimiento: `consentimientos.miembro_id`
  // es NOT NULL. Se devuelve «al día» para no encerrar en la pantalla de aceptar
  // a alguien que no tiene forma de salir de ella.
  if (!ctx.miembroId) {
    return { alDia: true, versionAceptada: null, asistenciaAceptada: false };
  }

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        tipo: consentimientos.tipo,
        version: consentimientos.versionTexto,
      })
      .from(consentimientos)
      .where(
        and(
          eq(consentimientos.iglesiaId, ctx.iglesia.id),
          eq(consentimientos.miembroId, ctx.miembroId!),
          isNull(consentimientos.revocadoAt),
        ),
      );

    const religiosos = filas.find((f) => f.tipo === 'datos_religiosos');
    const asistencia = filas.find(
      (f) => f.tipo === 'asistencia_y_seguimiento',
    );

    return {
      // Quien NUNCA ha aceptado nada no se considera caducado: es el caso de
      // toda ficha tecleada por el pastor, y pararle el panel a media
      // congregación por un consentimiento que nunca se le pidió sería castigar
      // a la iglesia por una decisión de diseño anterior. Se le pide a quien SÍ
      // aceptó, que es a quien la versión se le ha quedado vieja.
      alDia: !religiosos || religiosos.version === VERSION_POLITICA_PRIVACIDAD,
      versionAceptada: religiosos?.version ?? null,
      asistenciaAceptada: Boolean(asistencia),
    };
  });
}

/**
 * Las fichas que NO tienen permiso para que se apunte su asistencia.
 *
 * ESTA FUNCIÓN NACIÓ MAL Y CONVIENE QUE QUEDE ESCRITO
 * ---------------------------------------------------
 * La primera versión devolvía solo a quien había RETIRADO el permiso: fila del
 * tipo con todas revocadas. Parecía razonable y hacía falsa la frase que se
 * acababa de escribir en `/privacidad` §4 —«si no lo das, o si lo retiras,
 * dejas de aparecer»—, porque quien pasa por `/acepta` y deja la casilla sin
 * marcar no deja ninguna fila detrás. No había nada que retirar, así que no
 * salía en el conjunto y seguía apareciendo en las listas.
 *
 * Es exactamente la trampa que este repo ya documentó con los textos de
 * eventos: una redacción coherente consigo misma que el código no cumple. La
 * cazó revisar frase por frase, no releer el texto.
 *
 * CÓMO SE SABE QUE ALGUIEN DIJO QUE NO SIN HABER DEJADO FILA
 * -----------------------------------------------------------
 * Porque aceptó la política EN SU VERSIÓN ACTUAL. Eso solo puede haber pasado
 * pulsando el botón de `/acepta`, que es la única pantalla donde se ofrece la
 * casilla. Si tiene el consentimiento general al día y no tiene el de
 * asistencia, es que lo vio y no lo marcó.
 *
 * Los otros dos casos quedan fuera a propósito:
 *
 *   - Quien NUNCA aceptó nada: la ficha que tecleó el pastor. No ha visto la
 *     casilla, así que no ha dicho que no. Le cubre la base de la propia iglesia
 *     (art. 9.2.d), como al resto de su fichero.
 *   - Quien aceptó una versión ANTERIOR: todavía no ha llegado a la pantalla.
 *     Se le preguntará la próxima vez que entre.
 *
 * Tratar el silencio como negativa vaciaría la lista el primer día; tratarlo
 * como aceptación sería mentir. Esto no hace ninguna de las dos cosas.
 */
export async function miembrosSinPermisoDeAsistencia(
  ctx: UserContext,
): Promise<Set<string>> {
  const [alDia, conPermiso] = await Promise.all([
    withUser(ctx.user.id, (tx) =>
      tx
        .select({ miembroId: consentimientos.miembroId })
        .from(consentimientos)
        .where(
          and(
            eq(consentimientos.iglesiaId, ctx.iglesia.id),
            eq(consentimientos.tipo, 'datos_religiosos'),
            eq(consentimientos.versionTexto, VERSION_POLITICA_PRIVACIDAD),
            isNull(consentimientos.revocadoAt),
          ),
        ),
    ),
    withUser(ctx.user.id, (tx) =>
      tx
        .select({ miembroId: consentimientos.miembroId })
        .from(consentimientos)
        .where(
          and(
            eq(consentimientos.iglesiaId, ctx.iglesia.id),
            eq(consentimientos.tipo, 'asistencia_y_seguimiento'),
            isNull(consentimientos.revocadoAt),
          ),
        ),
    ),
  ]);

  const permitidos = new Set(conPermiso.map((f) => f.miembroId));

  const sinPermiso = new Set<string>();
  for (const f of alDia) {
    if (!permitidos.has(f.miembroId)) sinPermiso.add(f.miembroId);
  }
  return sinPermiso;
}

/**
 * Corta el paso a quien tiene el consentimiento caducado.
 *
 * Existe como función y no como tres `if` copiados porque hacen falta en tres
 * sitios —el layout del panel, la casa del miembro y el muro— y el que se
 * olvidara dejaría una puerta por la que seguir tratando datos bajo un texto que
 * esa persona no ha leído.
 *
 * Y son tres y no uno por una razón concreta: el corte NO puede vivir dentro de
 * `requireIglesia()`, que es lo que parecería natural. Ese guard lo llama también
 * `/acepta`, y la pantalla de aceptar redirigiéndose a sí misma es un bucle sin
 * salida. Así que se llama desde fuera, en cada sitio que trata datos, y `/acepta`
 * queda deliberadamente fuera de la lista.
 *
 * Ojo con dónde se pone al añadir una pantalla nueva bajo `/mi`: `/mi/avisos` no
 * lo lleva a propósito. A quien le rechazan la solicitud se le borra la membresía
 * en el mismo movimiento, y el aviso que se lo explica tiene que seguir siendo
 * alcanzable.
 */
export async function exigirConsentimientoAlDia(
  ctx: UserContext,
): Promise<void> {
  const estado = await estadoConsentimiento(ctx);
  if (!estado.alDia) redirect('/acepta');
}
