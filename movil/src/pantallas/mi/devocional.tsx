import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { TamanoLetra } from '@/app/mi/_components/tamano-letra';
import { VistaDevocional } from '@/app/mi/devocional/_components/vista-devocional';
import type { RespuestaDevocional } from '@/lib/app-api/miembro';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { pedir } from '@movil/lib/api';
import { useYo } from '@movil/lib/sesion';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * El devocional: la vista de la web con los datos de `/api/v1/app/mi/devocional`.
 */
export function Devocional() {
  const [parametros] = useSearchParams();
  const pedida = parametros.get('d') ?? undefined;
  const fecha = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : undefined;
  const { data: yo } = useYo();

  const datos = useQuery({
    queryKey: ['devocional', fecha ?? 'hoy'],
    queryFn: () => pedir<RespuestaDevocional>('/mi/devocional', { datos: { d: fecha } }),
  });

  const cabecera = (
    <CabeceraApp
      titulo="Devocional"
      subtitulo={yo?.iglesia?.nombre}
      logoUrl={fecha ? undefined : yo?.iglesia?.logoUrl}
      volver={fecha ? '/mi/devocional' : undefined}
    >
      {datos.data?.d && <TamanoLetra para="devocional" />}
    </CabeceraApp>
  );

  if (datos.isPending || !yo?.iglesia) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;

  return (
    <VistaDevocional
      cabecera={cabecera}
      iglesia={yo.iglesia}
      fecha={fecha}
      d={datos.data.d}
      video={datos.data.video}
      anteriores={datos.data.anteriores}
    />
  );
}
