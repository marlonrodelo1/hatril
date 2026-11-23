import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { AdminSidebar } from './_components/sidebar';
import { MarcoAdmin } from './_components/marco-contexto';
import { contarPendientes } from './_components/marco-pendientes';

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
 *
 * Lo que sí hace este layout es una consulta propia, el número de pendientes
 * junto a «Inicio» (zona 4), y por eso va DESPUÉS de la guarda: quien no es
 * super admin sale redirigido antes de que se cuente nada. Va aquí y no en la
 * cabecera porque el layout no se vuelve a pintar al navegar entre secciones;
 * el porqué entero, en `marco-contexto.tsx`.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSuperAdmin();
  const pendientes = await contarPendientes();

  return (
    <MarcoAdmin pendientes={pendientes}>
      <div className="flex min-h-dvh bg-background">
        <AdminSidebar />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </MarcoAdmin>
  );
}
