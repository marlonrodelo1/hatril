import { useQuery } from '@tanstack/react-query';

import { MarcarTodo, VistaAvisos } from '@/app/mi/avisos/_components/vista-avisos';
import type { RespuestaAvisos } from '@/lib/app-api/miembro';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { pedir } from '@movil/lib/api';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * Los avisos: la vista de la web con `/api/v1/app/mi/avisos`. Abrir uno y
 * «Marcar todo» son las actions de la web (`abrirAviso`, `marcarTodoLeido`),
 * llamadas por la API.
 */
export function Avisos() {
  const datos = useQuery({
    queryKey: ['avisos', 'bandeja'],
    queryFn: () => pedir<RespuestaAvisos>('/mi/avisos'),
  });

  const sinLeer = datos.data?.avisos.filter((a) => !a.leida).length ?? 0;
  const cabecera = (
    <CabeceraApp titulo="Avisos" volver="/mi/comunidad" campana={false}>
      {sinLeer > 0 && <MarcarTodo />}
    </CabeceraApp>
  );

  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return <VistaAvisos cabecera={cabecera} avisos={datos.data.avisos} zona={datos.data.zona} />;
}
