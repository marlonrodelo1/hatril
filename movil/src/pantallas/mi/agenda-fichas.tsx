import { useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { VistaTurno } from '@/app/mi/agenda/turno/[id]/_components/vista-turno';
import { VistaReunion } from '@/app/mi/agenda/reunion/[id]/_components/vista-reunion';
import type { RespuestaReunion, RespuestaTurno } from '@/lib/app-api/miembro';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { ErrorApi, pedir } from '@movil/lib/api';
import { NoExiste } from '../en-obras';
import { Cargando, ErrorDePantalla } from './comun';

/** La ficha de un turno: la vista de la web con `/api/v1/app/mi/agenda/turno/[id]`. */
export function Turno() {
  const { id = '' } = useParams();
  const [parametros] = useSearchParams();
  const datos = useQuery({
    queryKey: ['agenda', 'turno', id],
    queryFn: () => pedir<RespuestaTurno>(`/mi/agenda/turno/${encodeURIComponent(id)}`),
  });

  const cabecera = (
    <CabeceraApp titulo="Turno" subtitulo={datos.data?.turno.ministerio.nombre} volver="/mi/agenda" />
  );
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) {
    if (datos.error instanceof ErrorApi && datos.error.status === 404) return <NoExiste />;
    return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  }
  return (
    <VistaTurno
      cabecera={cabecera}
      {...datos.data}
      error={parametros.get('error') ?? undefined}
      guardado={parametros.get('guardado') ?? undefined}
    />
  );
}

/** La ficha de un ensayo: la vista de la web con `/api/v1/app/mi/agenda/reunion/[id]`. */
export function Reunion() {
  const { id = '' } = useParams();
  const datos = useQuery({
    queryKey: ['agenda', 'reunion', id],
    queryFn: () => pedir<RespuestaReunion>(`/mi/agenda/reunion/${encodeURIComponent(id)}`),
  });

  const cabecera = (
    <CabeceraApp
      titulo="Agenda del equipo"
      subtitulo={datos.data?.reunion.ministerio.nombre}
      volver="/mi/agenda"
    />
  );
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) {
    if (datos.error instanceof ErrorApi && datos.error.status === 404) return <NoExiste />;
    return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  }
  return <VistaReunion cabecera={cabecera} reunion={datos.data.reunion} />;
}
