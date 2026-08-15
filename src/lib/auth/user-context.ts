import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolverPermisos, type MapaPermisos } from '@/lib/auth/permisos';

export type RolUsuario = 'dueno' | 'admin' | 'empleado';

export interface UserContext {
  user: { id: string; email: string | null };
  salon: { id: string; slug: string; nombre: string } & Record<string, unknown>;
  rol: RolUsuario;
  /**
   * Ficha de profesional vinculada a esta cuenta, si la hay. Se resuelve para
   * TODOS los roles: un dueño que también atiende tiene la suya y la necesita
   * para filtrar su propia agenda. Antes solo se buscaba para empleados.
   */
  profesionalId: string | null;
  /** Nombre de esa ficha, para dirigirse a la persona por su nombre. */
  profesionalNombre: string | null;
  /** Permisos efectivos ya resueltos (rol + excepciones guardadas). */
  permisos: MapaPermisos;
}

/**
 * Devuelve usuario + salón + rol + profesional vinculado, o null si no
 * hay sesión o no tiene salón. Se usa en server components/actions para
 * decidir qué puede hacer el usuario.
 *
 * El rol del user dentro del salón se lee de `usuarios_salon`. Si tiene
 * vínculos con varios salones, se prefiere uno donde sea "dueno".
 * Para empleados, se busca también el `profesional_id` correspondiente
 * en `profesionales.auth_user_id`.
 */
export async function getCurrentUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: vinculos } = await admin
    .from('usuarios_salon')
    .select('rol, permisos, salones(*)')
    .eq('auth_user_id', user.id)
    .limit(10);

  if (!vinculos || vinculos.length === 0) return null;

  // Preferir dueño si tiene varios salones.
  const preferido =
    vinculos.find((v: { rol: string }) => v.rol === 'dueno') ?? vinculos[0];
  const rol = (preferido.rol as RolUsuario) ?? 'empleado';
  const salonRaw = (preferido as unknown as { salones: unknown }).salones as
    | Record<string, unknown>
    | null;
  if (!salonRaw) return null;

  const salonId = (salonRaw.id ?? '') as string;
  const salonSlug = (salonRaw.slug ?? '') as string;
  const salonNombre = (salonRaw.nombre ?? '') as string;
  if (!salonId || !salonSlug) return null;

  // Sin filtrar por rol: el dueño que también atiende tiene ficha y la
  // necesita. Espeja `getSalonFromBearer`, para que web y app no diverjan.
  const { data: prof } = await admin
    .from('profesionales')
    .select('id, nombre')
    .eq('salon_id', salonId)
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? null },
    salon: { ...salonRaw, id: salonId, slug: salonSlug, nombre: salonNombre },
    rol,
    profesionalId: (prof?.id as string) ?? null,
    profesionalNombre: (prof?.nombre as string) ?? null,
    permisos: resolverPermisos(
      rol,
      (preferido as unknown as { permisos?: unknown }).permisos,
    ),
  };
}

/**
 * Exige que el user actual tenga rol "dueno" (o "admin") sobre su salón.
 * Si no, redirige a /panel/hoy con mensaje "no autorizado" — el empleado
 * sigue dentro del panel pero no en la sección restringida.
 */
export async function requireDueno(): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');
  if (ctx.rol !== 'dueno' && ctx.rol !== 'admin') {
    redirect(
      '/panel/hoy?error=' +
        encodeURIComponent(
          'Solo el dueño del salón puede acceder a esta sección.',
        ),
    );
  }
  return ctx;
}

/**
 * Atajo para saber si el user es empleado (no dueño/admin). Útil para
 * ramas condicionales en queries (filtrar por su profesional).
 */
export function isEmpleado(ctx: UserContext | null): boolean {
  return ctx?.rol === 'empleado';
}
