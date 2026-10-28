import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { AdminSidebar } from './_components/sidebar';

export const metadata: Metadata = {
  title: { template: '%s · Admin Hatril', default: 'Admin Hatril' },
  robots: { index: false, follow: false },
};

/**
 * Marco de `/admin`, el panel de la plataforma.
 *
 * La guarda se repite aquí solo para que la navegación redirija antes de pintar
 * el marco. NO protege nada: cada página y cada action llevan su propio
 * `requireSuperAdmin()`, porque un layout no impide que la página se ejecute
 * (CLAUDE.md). Y aquí más que en ningún sitio: todo `/admin` consulta con
 * `dbAdmin`, sin RLS debajo.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSuperAdmin();

  return (
    <div className="flex min-h-dvh bg-background">
      <AdminSidebar />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
