import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { adminUsers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

export type SuperAdminContext = {
  authUserId: string;
  email: string;
};

/**
 * Devuelve el contexto de super admin si la sesión actual lo es, o null.
 * No redirige — usa esto cuando quieras renderizar UI condicionalmente
 * (ej: mostrar un link al panel admin si el user es super admin).
 */
export async function getCurrentSuperAdmin(): Promise<SuperAdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const rows = await db
    .select({ authUserId: adminUsers.authUserId })
    .from(adminUsers)
    .where(eq(adminUsers.authUserId, user.id))
    .limit(1);

  if (rows.length === 0) return null;
  return { authUserId: user.id, email: user.email };
}

/**
 * Devuelve la sesión de super admin o redirige.
 * - Sin sesión           → /login
 * - Sesión sin permisos  → / (home)
 * Usar al inicio de cualquier página/server action de /admin/*.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }
  if (!user.email) {
    redirect('/login?error=' + encodeURIComponent('Sesión inválida'));
  }

  const rows = await db
    .select({ authUserId: adminUsers.authUserId })
    .from(adminUsers)
    .where(eq(adminUsers.authUserId, user.id))
    .limit(1);

  if (rows.length === 0) {
    redirect('/');
  }

  return { authUserId: user.id, email: user.email };
}
