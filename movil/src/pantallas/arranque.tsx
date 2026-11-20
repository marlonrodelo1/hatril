import { Navigate, useSearchParams } from 'react-router';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { ErrorApi } from '@movil/lib/api';
import { bienvenidaVista } from '@movil/lib/bienvenida';
import { useSesion, useYo } from '@movil/lib/sesion';
import { salir } from '@movil/lib/salir';
import { SalaDeEspera } from './sala-de-espera';

/**
 * `/` y `/mi`: a dónde va cada quien al abrir la app.
 *
 * Es el desvío de `src/app/mi/page.tsx`, que era la ruta con la que arrancaba
 * el WebView (`appStartPath`):
 *
 *   - sin sesión                → la bienvenida, y la presentación solo la
 *                                 primera vez (`/empezar` después);
 *   - con iglesia               → su muro;
 *   - pidió borrar la cuenta    → a tiempo de arrepentirse;
 *   - sin iglesia               → la sala de espera, aquí mismo.
 *
 * Quien lleva algo en la iglesia NO va al panel, a diferencia de la web: el
 * panel no está en el binario. Ve su área de miembro, y el panel lo abre desde
 * el menú de su cuenta (`plan-spa.md` §1).
 */
export function Arranque() {
  const { cargando, session } = useSesion();
  const yo = useYo();
  // Una action que falla vuelve a `/mi?error=`. La web lo pierde al desviar
  // al muro; aquí el mensaje viaja con el desvío y se ve.
  const error = useSearchParams()[0].get('error');
  const conError = error ? `?error=${encodeURIComponent(error)}` : '';

  if (cargando) return null;
  if (!session) return <Navigate to={bienvenidaVista() ? '/empezar' : '/bienvenida'} replace />;

  if (yo.isPending) return null;

  if (yo.error) {
    // Una sesión que el servidor ya no reconoce: que entre otra vez.
    if (yo.error instanceof ErrorApi && yo.error.status === 401) {
      void salir();
      return null;
    }
    return <SinConexion mensaje={yo.error.message} reintentar={() => void yo.refetch()} />;
  }

  const datos = yo.data;
  if (datos.situacion === 'iglesia') {
    if (!datos.consentimientoAlDia) return <Navigate to="/acepta" replace />;
    return <Navigate to={`/mi/comunidad${conError}`} replace />;
  }
  if (datos.situacion === 'baja') return <Navigate to="/cuenta-en-baja" replace />;
  return <SalaDeEspera yo={datos} />;
}

/**
 * Lo que ve quien abre la app sin red. Hacía de `sin-conexion.html` del
 * WebView; ahora la app ya está en el teléfono y solo faltan los datos.
 */
export function SinConexion({ mensaje, reintentar }: { mensaje: string; reintentar: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-[400px]">
        <Aviso>{mensaje}</Aviso>
      </div>
      <Button type="button" size="lg" onClick={reintentar}>
        Reintentar
      </Button>
    </div>
  );
}
