import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { AppNativa } from '@/components/app-nativa';
import { registrarNavegador } from './lib/acciones';
import { escucharPush, pedirPermisoYApuntar } from './lib/push';
import { useSesion } from './lib/sesion';

/**
 * El marco de toda la app.
 *
 * `AppNativa` es el mismo componente que monta la web en su layout raíz:
 * atrás de Android, barra de estado y fin del arranque. No depende de Next y
 * se usa tal cual. Con React Router cada pantalla es una entrada del
 * historial, así que su `canGoBack` sigue diciendo la verdad.
 */
export function Raiz() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const { session } = useSesion();

  // Las actions de la web, al terminar, llevan a donde la web habría llevado
  // (`lib/acciones.ts`). No son componentes: el router se les presta aquí.
  useEffect(() => {
    registrarNavegador((ruta) => navegar(ruta));
    return () => registrarNavegador(null);
  }, [navegar]);

  // Los oyentes de las push, una vez por arranque y con o sin sesión: si la
  // app estaba cerrada y se abre tocando una push, el plugin guarda el toque
  // hasta que alguien escucha.
  useEffect(
    () =>
      escucharPush(
        (ruta) => navegar(ruta),
        () => void cliente.invalidateQueries({ queryKey: ['avisos'] }),
      ),
    [navegar, cliente],
  );

  // El permiso, la primera vez que hay sesión en este arranque.
  const usuario = session?.user.id;
  useEffect(() => {
    if (usuario) void pedirPermisoYApuntar().catch(() => {});
  }, [usuario]);

  return (
    <>
      <Outlet />
      <AppNativa />
    </>
  );
}

/**
 * Las pantallas que piden sesión. Sin ella, al acceso con la vuelta apuntada.
 *
 * No protege nada: la puerta está en el servidor, en cada endpoint. Es para
 * no pintar una pantalla que solo va a recibir 401.
 */
export function ConSesion() {
  const { cargando, session } = useSesion();
  const { pathname, search } = useLocation();
  if (cargando) return null;
  if (!session) {
    return <Navigate to={`/acceso?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <Outlet />;
}
