import 'server-only';

import { redirect } from 'next/navigation';

import {
  getCurrentUserContext,
  type UserContext,
} from '@/lib/auth/user-context';
import { esAdmin, puede, type Permiso } from '@/lib/auth/permisos';

/**
 * Guardas de autorización del panel web.
 *
 * POR QUÉ EXISTE
 * --------------
 * El panel web llevaba sin control de rol prácticamente desde el principio:
 * solo dos `requireDueno()` en todo `src/app/panel/`, y CERO comprobaciones en
 * los 16 ficheros de server actions. Un empleado que escribiera la URL a mano
 * entraba a Finanzas, Métricas y fichas de clientes, y podía ejecutar cualquier
 * acción — incluida la de cambiarle el plan de suscripción al dueño. El propio
 * código lo reconocía en `panel/config/equipo/actions.ts`: *"En esta fase el
 * trabajador ve TODO el panel. Las restricciones se aplican en la Fase 2"*.
 * Esa Fase 2 es esto.
 *
 * La raíz del problema era que `getCurrentSalon()` devuelve la fila del salón
 * SIN el rol: el helper que todo el mundo tenía a mano no ofrecía nada que
 * comprobar, así que nadie comprobaba. Por eso aquí no se sustituye —seguiría
 * compilando en sus 40+ usos— sino que se le pone un hermano que sí lo trae.
 *
 * DOS SABORES, Y NO ES CAPRICHO
 * -----------------------------
 * Una PÁGINA puede `redirect()` al fallar: el usuario acaba en un sitio con
 * sentido. Una ACTION que redirige al fallar es indistinguible del éxito para
 * quien la invoca a pelo, así que se redirige con `?error=` — que además es la
 * convención que el repo ya usa para los errores de action.
 *
 * QUÉ NO PROTEGE ESTO
 * -------------------
 * El aislamiento entre salones (que el salón A no vea al B) ya lo garantiza
 * `getCurrentUserContext`, que resuelve el salón desde `usuarios_salon` y nunca
 * desde un parámetro del cliente. Aquí solo se decide QUÉ puede hacer alguien
 * dentro de SU salón.
 */

const MENSAJE_SOLO_DUENO =
  'Solo el dueño del salón puede acceder a esta sección.';

/** Igual que `getCurrentUserContext`, con nombre explícito para el panel. */
export async function getCurrentSalonCtx(): Promise<UserContext | null> {
  return getCurrentUserContext();
}

// ============================================
// PÁGINAS (server components / layouts)
// ============================================

/**
 * Exige mandar en el salón. Para páginas y layouts de administración:
 * configuración, catálogo, finanzas, marketing.
 *
 * Ponerlo en un `layout.tsx` cubre la carpeta entera, incluidas las rutas
 * dinámicas — que es justo donde se colaban los huecos: `/panel/clientes`
 * estaba guardado pero `/panel/clientes/[id]` no.
 */
export async function requireAdminSalon(): Promise<UserContext> {
  const ctx = await getCurrentSalonCtx();
  if (!ctx) redirect('/login');
  if (!esAdmin(ctx)) {
    redirect('/panel/hoy?error=' + encodeURIComponent(MENSAJE_SOLO_DUENO));
  }
  return ctx;
}

/** Exige un permiso concreto. Los dueños pasan siempre. */
export async function requirePermiso(permiso: Permiso): Promise<UserContext> {
  const ctx = await getCurrentSalonCtx();
  if (!ctx) redirect('/login');
  if (!esAdmin(ctx) && !puede(ctx, permiso)) {
    redirect(
      '/panel/hoy?error=' +
        encodeURIComponent('No tienes acceso a esta sección.'),
    );
  }
  return ctx;
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Exige mandar en el salón, desde una server action.
 *
 * La mayoría de ficheros de actions ya tienen un helper local
 * (`requireSalon()` / `requireSalonId()`) por el que pasan TODAS sus actions:
 * metiendo esta llamada ahí dentro se cubre el fichero entero con una sola
 * edición, en vez de tocar sesenta funciones.
 *
 * `destinoError` permite devolver al usuario a la pantalla desde la que
 * disparó la action; por defecto va a Hoy.
 */
export async function requireAdminAccion(
  destinoError = '/panel/hoy',
): Promise<UserContext> {
  const ctx = await getCurrentSalonCtx();
  if (!ctx) redirect('/login');
  if (!esAdmin(ctx)) {
    redirect(
      `${destinoError}?error=` + encodeURIComponent(MENSAJE_SOLO_DUENO),
    );
  }
  return ctx;
}

/** Exige un permiso concreto desde una server action. */
export async function requirePermisoAccion(
  permiso: Permiso,
  destinoError = '/panel/hoy',
): Promise<UserContext> {
  const ctx = await getCurrentSalonCtx();
  if (!ctx) redirect('/login');
  if (!esAdmin(ctx) && !puede(ctx, permiso)) {
    redirect(
      `${destinoError}?error=` +
        encodeURIComponent('No tienes permiso para hacer eso.'),
    );
  }
  return ctx;
}
