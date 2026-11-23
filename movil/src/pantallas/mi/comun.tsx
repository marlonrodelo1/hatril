import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { ErrorApi } from '@movil/lib/api';

/**
 * Lo que comparten las pantallas del miembro mientras llegan los datos, o si
 * no llegan.
 */

/**
 * Mientras llegan: la cabecera de verdad y unos bloques que respiran, como el
 * `loading.tsx` de `/mi` en la web. La primera vez que se abre una pantalla;
 * las siguientes pinta lo último al instante (la caché).
 */
export function Cargando({ cabecera }: { cabecera: ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex min-h-dvh flex-col bg-background">
      {cabecera}
      <span className="sr-only">Cargando…</span>
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 pt-4 sm:px-5">
        <Bloque className="h-24 rounded-xl" />
        <Bloque className="h-40 rounded-xl" />
        <Bloque className="h-28 rounded-xl" />
      </div>
    </div>
  );
}

function Bloque({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={'block animate-pulse rounded-md bg-surface-active motion-reduce:animate-none ' + className}
    />
  );
}

const SOLO_EN_LA_WEB = /^\/(suscripcion|panel|admin|registro)(\/|$)/;

/**
 * Si la API dice que no. Un corte de una guarda trae a dónde ir (`ir`): la
 * política sin aceptar, la sesión caducada, sin iglesia. Se va ahí, como la
 * redirección de la web. Lo demás —sin red, un fallo— se dice, con
 * «Reintentar».
 */
export function ErrorDePantalla({
  cabecera,
  error,
  reintentar,
}: {
  cabecera: ReactNode;
  error: Error;
  reintentar: () => void;
}) {
  // Lo que solo vive en la web (la suscripción, el panel) no tiene pantalla en
  // la app: se dice el porqué aquí mismo, sin llevar a un «no existe».
  if (error instanceof ErrorApi && error.ir && !SOLO_EN_LA_WEB.test(error.ir)) {
    const destino = error.ir === '/mi' ? '/' : error.ir;
    return <Navigate to={destino} replace />;
  }
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}
      <main className="mx-auto flex w-full max-w-[620px] flex-col items-start gap-4 px-4 py-8 sm:px-5">
        <Aviso>{error.message}</Aviso>
        <Button type="button" variant="outline" onClick={reintentar}>
          Reintentar
        </Button>
      </main>
    </div>
  );
}
