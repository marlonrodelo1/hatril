import { requireIglesia } from '@/lib/auth/guard-panel';
import { PanelSidebar } from './_components/sidebar';

/**
 * Marco del panel.
 *
 * `requireIglesia()` va aquí y no en cada página: puesto en el layout cubre la
 * sección entera, incluidas las rutas dinámicas. Gonper lo hacía página a
 * página y ahí es donde se le quedaron los huecos — `/panel/clientes` guardado
 * y `/panel/clientes/[id]` sin guardar.
 *
 * Ojo: esto NO es lo que aísla una iglesia de otra. Eso lo hacen las policies
 * de RLS y `withUser()`. Si este guard faltara, lo peor que pasa es que se vea
 * una pantalla vacía; sin la RLS, se verían los datos de otra congregación.
 */
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireIglesia();

  return (
    <div className="flex min-h-dvh bg-background">
      <PanelSidebar
        iglesiaNombre={ctx.iglesia.nombre}
        iglesiaCiudad={ctx.iglesia.ciudad}
        personaNombre={
          // El nombre que se puso al registrarse. Si por lo que sea no está,
          // el correo antes de la arroba es mejor que un hueco en blanco.
          (ctx.user.user_metadata?.nombre as string | undefined) ??
          ctx.user.email?.split('@')[0] ??
          'Tu cuenta'
        }
        rol={ctx.rol}
      />

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
