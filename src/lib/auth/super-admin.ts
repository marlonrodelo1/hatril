import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

// `dbAdmin` y no `withUser`: `admin_users` es una tabla de plataforma, con RLS
// activada y sin ninguna policy. Justo por eso no se llega a ella desde el rol
// de la aplicación, y comprobar si alguien es super admin no puede depender de
// una policy que ese mismo super admin todavía no ha demostrado cumplir.
import { dbAdmin } from '@/lib/db';
import { adminUsers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

export type SuperAdminContext = {
  authUserId: string;
  email: string;
};

/**
 * Devuelve el contexto de super admin si la sesión actual lo es, o null.
 * No redirige — usa esto cuando quieras renderizar UI condicionalmente, o
 * decidir a dónde mandar a alguien al entrar.
 *
 * Con `cache()`, como `getCurrentUserContext`: el layout de `/admin`, la
 * cabecera y la página la piden en el mismo render, y sin esto eran tres
 * viajes a `auth` y tres a la base para la misma respuesta.
 */
export const getCurrentSuperAdmin = cache(
  async (): Promise<SuperAdminContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) return null;

    const rows = await dbAdmin
      .select({ authUserId: adminUsers.authUserId })
      .from(adminUsers)
      .where(eq(adminUsers.authUserId, user.id))
      .limit(1);

    if (rows.length === 0) return null;
    return { authUserId: user.id, email: user.email };
  },
);

/**
 * Devuelve la sesión de super admin o redirige.
 * - Sin sesión           → /acceso, volviendo a /admin
 * - Sesión sin permisos  → /
 *
 * Va en CADA página de `/admin` y en cada server action, no solo en el layout:
 * un layout no impide que la página se ejecute (CLAUDE.md, «La guarda va en
 * CADA página»). Y aquí importa más que en ningún otro sitio, porque todo
 * `/admin` consulta con `dbAdmin`: sin la guarda no hay RLS debajo que frene
 * nada.
 *
 * Aquí redirigía a `/login`, heredado de Gonper. En Hatril esa ruta no existe:
 * quien llegaba sin sesión se encontraba un 404.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const admin = await getCurrentSuperAdmin();
  if (admin) return admin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/' : '/acceso?next=/admin');
}
