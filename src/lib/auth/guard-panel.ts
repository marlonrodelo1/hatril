import 'server-only';

import { redirect } from 'next/navigation';

import {
  getCurrentUserContext,
  type UserContext,
} from '@/lib/auth/user-context';
import {
  esPastor,
  puede,
  puedeGestionarMinisterio,
  type Permiso,
} from '@/lib/auth/permisos';
import { createClient } from '@/lib/supabase/server';
import { exigirPoderEscribir } from '@/lib/suscripcion/muro';

/**
 * Guardas de autorización del panel.
 *
 * DOS SABORES, Y NO ES CAPRICHO
 * -----------------------------
 * Una PÁGINA puede `redirect()` al fallar: la persona acaba en un sitio con
 * sentido. Una ACTION que redirige al fallar es indistinguible del éxito para
 * quien la invoca a pelo, así que se redirige con `?error=`, que además es la
 * convención de errores de action en todo el repo.
 *
 * DÓNDE PONERLOS
 * --------------
 * En el `layout.tsx` de la sección, no en cada página. Así queda cubierta la
 * carpeta entera incluidas las rutas dinámicas, que es justo donde se cuelan
 * los huecos: en Gonper `/panel/clientes` estaba guardado y
 * `/panel/clientes/[id]` no.
 *
 * QUÉ NO PROTEGE ESTO
 * -------------------
 * El aislamiento entre iglesias. Eso lo garantizan las policies de RLS y
 * `withUser()`, y `getCurrentUserContext` resolviendo la iglesia desde
 * `iglesia_usuarios` y nunca desde un parámetro del cliente. Aquí solo se
 * decide QUÉ puede hacer alguien dentro de SU congregación.
 *
 * Y tampoco es la única capa: que un guard falte no abre los datos de otra
 * iglesia, solo una pantalla que no le tocaba dentro de la suya. Esa diferencia
 * es la razón de haber puesto el aislamiento en la base de datos.
 */

const MENSAJE_SOLO_PASTOR =
  'Solo el pastor de la iglesia puede entrar en esta sección.';

const MENSAJE_SIN_PERMISO = 'No tienes acceso a esta sección.';

/**
 * A dónde va quien no tiene contexto de iglesia.
 *
 * SIN ESTO HABÍA UN BUCLE
 * -----------------------
 * `getCurrentUserContext()` devuelve null en DOS situaciones que no son la
 * misma: no hay sesión, o hay sesión pero sin membresía activa —quien acaba de
 * pedir entrar en una iglesia y espera aprobación—.
 *
 * Mandar los dos casos a `/acceso` funcionaba mientras la única forma de tener
 * cuenta era fundando una iglesia. En cuanto existen las solicitudes de
 * ingreso, la segunda situación es real y produce un bucle: el guard manda a
 * `/acceso`, la persona ya tiene sesión, se identifica, vuelve al panel, y el
 * guard la vuelve a echar. Sin mensaje y sin salida.
 *
 * Así que se distingue: sin sesión, a identificarse; con sesión y sin iglesia,
 * a `/mi`, que le cuenta en qué punto está su solicitud.
 */
async function rebotar(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/mi' : '/acceso');
}

// ============================================
// PÁGINAS (server components / layouts)
// ============================================

/**
 * Exige sesión con iglesia activa. El guard mínimo de todo `/panel`.
 *
 * Distingue tres situaciones que la persona vive de forma muy distinta: sin
 * sesión, con solicitud en revisión, y sin iglesia ninguna.
 */
export async function requireIglesia(): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  return ctx;
}

/**
 * Exige ser pastor. Para ajustes, equipo, facturación y bajas.
 */
export async function requirePastor(): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  if (!esPastor(ctx)) {
    redirect('/panel/hoy?error=' + encodeURIComponent(MENSAJE_SOLO_PASTOR));
  }
  return ctx;
}

/** Exige un permiso concreto. El pastor pasa siempre. */
export async function requirePermiso(permiso: Permiso): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  if (!esPastor(ctx) && !puede(ctx, permiso)) {
    redirect('/panel/hoy?error=' + encodeURIComponent(MENSAJE_SIN_PERMISO));
  }
  return ctx;
}

/**
 * Exige poder gestionar ESTE ministerio.
 *
 * A diferencia de `requirePermiso`, no basta con mirar el mapa de permisos: hay
 * que cruzarlo con qué ministerios lidera esta persona. Ver
 * `puedeGestionarMinisterio`.
 *
 * Rebota a `/panel/ministerios` y no a `/panel/hoy`: quien llega aquí venía de
 * la rejilla de ministerios, y devolverlo al inicio le hace perder el sitio.
 */
export async function requireGestionMinisterio(
  ministerioId: string,
): Promise<UserContext> {
  const ctx = await requireIglesia();
  if (!puedeGestionarMinisterio(ctx, ministerioId)) {
    redirect('/panel/ministerios?error=' + encodeURIComponent(MENSAJE_SIN_PERMISO));
  }
  return ctx;
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * El portillo del muro de suscripción.
 *
 * Las cuatro guards de action cortan por defecto cuando la iglesia ya no puede
 * escribir. `sinMuro` es la excepción, y la lista de quién la usa es corta a
 * propósito: pagar, darse de baja, aceptar la política y tocar la cuenta
 * propia. Todo lo demás pasa por el muro sin decir nada, incluido lo que se
 * escriba dentro de un año.
 */
export type OpcionesAccion = { sinMuro?: boolean };

/**
 * Exige sesión con iglesia activa desde una server action.
 *
 * No lleva `destinoError` como sus hermanas: si no hay sesión, el único destino
 * con sentido es identificarse, no volver a una pantalla del panel que también
 * va a rebotar.
 */
export async function requireIglesiaAccion(
  opciones?: OpcionesAccion,
): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  if (!opciones?.sinMuro) exigirPoderEscribir(ctx);
  return ctx;
}

export async function requirePastorAccion(
  destinoError = '/panel/hoy',
  opciones?: OpcionesAccion,
): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  // El rol primero y el muro después: a quien no es pastor se le dice que esta
  // sección no es suya, que es lo que le pasa a ella. «Tu iglesia no ha pagado»
  // es cierto pero no es su problema ni puede resolverlo.
  if (!esPastor(ctx)) {
    redirect(`${destinoError}?error=` + encodeURIComponent(MENSAJE_SOLO_PASTOR));
  }
  if (!opciones?.sinMuro) exigirPoderEscribir(ctx, destinoError);
  return ctx;
}

export async function requirePermisoAccion(
  permiso: Permiso,
  destinoError = '/panel/hoy',
  opciones?: OpcionesAccion,
): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  if (!opciones?.sinMuro) exigirPoderEscribir(ctx, destinoError);
  if (!esPastor(ctx) && !puede(ctx, permiso)) {
    redirect(
      `${destinoError}?error=` +
        encodeURIComponent('No tienes permiso para hacer eso.'),
    );
  }
  return ctx;
}

/** La versión para actions de `requireGestionMinisterio`. */
export async function requireGestionMinisterioAccion(
  ministerioId: string,
  destinoError = '/panel/ministerios',
): Promise<UserContext> {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  exigirPoderEscribir(ctx, destinoError);
  if (!puedeGestionarMinisterio(ctx, ministerioId)) {
    redirect(
      `${destinoError}?error=` +
        encodeURIComponent('No tienes permiso para hacer eso.'),
    );
  }
  return ctx;
}
