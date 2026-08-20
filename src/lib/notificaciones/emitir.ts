import 'server-only';

import { and, eq, isNull, sql } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { iglesiaUsuarios, notificaciones } from '@/lib/db/schema';
import { resolverPermisos } from '@/lib/auth/permisos';

/**
 * Escribir avisos. Es lo único de este módulo que usa `dbAdmin`, y hace falta.
 *
 * POR QUÉ EL SERVICE ROLE Y NO `withUser`
 * ---------------------------------------
 * La tabla no tiene policy de INSERT para `hatril_app` —ni el grant— porque una
 * notificación es una afirmación sobre algo que ha pasado, y quien pueda
 * escribirla puede mentir: fabricarse un «tu solicitud ha sido aprobada» o
 * mandarle a otro un aviso con el enlace que le apetezca, que es phishing dentro
 * de la propia aplicación y con el membrete de su iglesia.
 *
 * Así que las escribe el servidor, en el mismo sitio donde ocurre el hecho, y la
 * `iglesia_id` sale siempre del contexto de servidor y nunca del formulario.
 *
 * UN AVISO QUE FALLA NO PUEDE TUMBAR LO QUE LO PROVOCÓ
 * ---------------------------------------------------
 * Todo va envuelto en `try`. Si la inserción falla, se registra y se sigue:
 * aprobar una solicitud tiene que funcionar aunque el aviso se pierda. Al revés
 * —una excepción aquí dentro— dejaría la solicitud aprobada y la pantalla en
 * error, que es la peor de las dos situaciones.
 */

export type TipoNotificacion =
  | 'solicitud_recibida'
  | 'solicitud_aprobada'
  | 'solicitud_rechazada'
  | 'comentario_en_publicacion'
  | 'me_gusta_en_publicacion'
  | 'turno_devocional';

type Aviso = {
  iglesiaId: string;
  /** A quién va. Si es `null`, no se emite: hay fichas sin cuenta. */
  destinatarioAuthUserId: string | null;
  tipo: TipoNotificacion;
  datos?: Record<string, string>;
  enlace?: string;
  /**
   * Quién ha provocado el aviso. Si coincide con el destinatario no se emite:
   * nadie necesita que le avisen de lo que acaba de hacer él.
   */
  provocadoPor?: string;
};

export async function emitirNotificacion(aviso: Aviso): Promise<void> {
  const { destinatarioAuthUserId, provocadoPor } = aviso;

  if (!destinatarioAuthUserId) return;
  if (provocadoPor && provocadoPor === destinatarioAuthUserId) return;

  try {
    await dbAdmin.insert(notificaciones).values({
      iglesiaId: aviso.iglesiaId,
      destinatarioAuthUserId,
      tipo: aviso.tipo,
      datos: aviso.datos ?? {},
      enlace: aviso.enlace ?? null,
    });
  } catch (err) {
    console.error('[notificaciones] no se pudo emitir', {
      tipo: aviso.tipo,
      iglesiaId: aviso.iglesiaId,
      err,
    });
  }
}

/** Varios avisos iguales a varias personas. Uno malo no se lleva a los demás. */
export async function emitirNotificaciones(avisos: Aviso[]): Promise<void> {
  await Promise.all(avisos.map(emitirNotificacion));
}

/**
 * La cuenta de una ficha, o `null` si esa persona no tiene acceso.
 *
 * Mucha gente de una congregación está en el fichero y no usa la aplicación:
 * tienen `miembros` pero ninguna fila en `iglesia_usuarios`. A esas no se les
 * puede avisar de nada y no es un error, es lo normal.
 *
 * Por `dbAdmin` porque quien provoca el aviso no tiene por qué poder leer la
 * tabla de accesos: un miembro raso que comenta una publicación no ve
 * `iglesia_usuarios`, y aun así hay que saber a quién avisar.
 */
export async function cuentaDeMiembro(
  iglesiaId: string,
  miembroId: string,
): Promise<string | null> {
  const [fila] = await dbAdmin
    .select({ authUserId: iglesiaUsuarios.authUserId })
    .from(iglesiaUsuarios)
    .where(
      and(
        eq(iglesiaUsuarios.iglesiaId, iglesiaId),
        eq(iglesiaUsuarios.miembroId, miembroId),
        eq(iglesiaUsuarios.estado, 'activo'),
      ),
    )
    .limit(1);

  return fila?.authUserId ?? null;
}

/**
 * Quién tiene que enterarse de que ha llegado una solicitud.
 *
 * EL PERMISO NO SE PUEDE FILTRAR EN SQL, Y ESTO ESTUVO MAL ESCRITO
 * ----------------------------------------------------------------
 * La primera versión preguntaba en el `where`:
 *
 *   rol = 'pastor' or permisos ->> 'aprobar_solicitudes' = 'true'
 *
 * y dejaba fuera justo a quien se ocupa de esto. El jsonb de `permisos` guarda
 * solo las EXCEPCIONES al defecto de cada rol, así que el de una secretaria está
 * vacío: tiene `aprobar_solicitudes` porque su rol lo trae de serie, no porque
 * lo ponga ahí. La consulta se lo llevaba por delante y las solicitudes se le
 * quedaban sin avisar a la única persona que las mira.
 *
 * Por eso se traen las filas y se resuelve con `resolverPermisos`, que es la
 * misma función que decide qué ve cada cual en el panel. Dos maneras de
 * contestar a la misma pregunta acaban discrepando siempre; esta es la buena.
 */
export async function cuentasQueAprueban(
  iglesiaId: string,
): Promise<string[]> {
  const filas = await dbAdmin
    .select({
      authUserId: iglesiaUsuarios.authUserId,
      rol: iglesiaUsuarios.rol,
      permisos: iglesiaUsuarios.permisos,
    })
    .from(iglesiaUsuarios)
    .where(
      and(
        eq(iglesiaUsuarios.iglesiaId, iglesiaId),
        eq(iglesiaUsuarios.estado, 'activo'),
      ),
    );

  return filas
    .filter((f) => resolverPermisos(f.rol, f.permisos).aprobar_solicitudes)
    .map((f) => f.authUserId);
}

/**
 * Da por leídos los «ha llegado una solicitud» de una solicitud ya resuelta.
 *
 * El aviso va a todo el equipo que puede aprobar, así que cuando una persona la
 * resuelve, a las demás les queda un punto rojo que lleva a una lista donde ya
 * no hay nada. Se apagan solos.
 */
export async function cerrarAvisosDeSolicitud(
  iglesiaId: string,
  solicitudId: string,
): Promise<void> {
  try {
    await dbAdmin
      .update(notificaciones)
      .set({ leidaAt: new Date() })
      .where(
        and(
          eq(notificaciones.iglesiaId, iglesiaId),
          eq(notificaciones.tipo, 'solicitud_recibida'),
          isNull(notificaciones.leidaAt),
          sql`${notificaciones.datos} ->> 'solicitudId' = ${solicitudId}`,
        ),
      );
  } catch (err) {
    console.error('[notificaciones] no se pudieron cerrar', { solicitudId, err });
  }
}
