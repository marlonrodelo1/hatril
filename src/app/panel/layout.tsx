import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import { contarSolicitudesPendientes } from '@/lib/solicitudes/consultas';
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

  const puedeVerSolicitudes =
    esPastor(ctx) || puede(ctx, 'aprobar_solicitudes');

  // El contador solo se pide si esta persona va a ver la sección. Para un líder
  // de alabanza sería una consulta en cada carga del panel para un número que
  // no se pinta.
  const solicitudesPendientes = puedeVerSolicitudes
    ? await contarSolicitudesPendientes(ctx)
    : 0;

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
        solicitudesPendientes={solicitudesPendientes}
        puedeVerSolicitudes={puedeVerSolicitudes}
        esPastorDeLaIglesia={esPastor(ctx)}
      />

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
