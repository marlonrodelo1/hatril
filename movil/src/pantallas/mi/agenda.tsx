import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { VistaAgenda } from '@/app/mi/agenda/_components/vista-agenda';
import type { RespuestaAgenda } from '@/lib/app-api/miembro';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { pedir } from '@movil/lib/api';
import { useYo } from '@movil/lib/sesion';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * La agenda: la vista de la web con los datos de `/api/v1/app/mi/agenda`.
 * Cambiar de mes, de semana o de día es cambiar la dirección (`?v=&d=`), como
 * en la web, y cada periodo visto se queda en la caché.
 */
export function Agenda() {
  const [parametros] = useSearchParams();
  const v = parametros.get('v') ?? undefined;
  const d = parametros.get('d') ?? undefined;
  const { data: yo } = useYo();

  const datos = useQuery({
    queryKey: ['agenda', v ?? 'mes', d ?? 'hoy'],
    queryFn: () => pedir<RespuestaAgenda>('/mi/agenda', { datos: { v, d } }),
    placeholderData: (anterior) => anterior,
  });

  const cabecera = (
    <CabeceraApp titulo="Agenda" subtitulo={yo?.iglesia?.nombre} logoUrl={yo?.iglesia?.logoUrl} />
  );

  if (datos.isPending || !yo?.iglesia) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;

  return (
    <VistaAgenda
      cabecera={cabecera}
      iglesiaNombre={yo.iglesia.nombre}
      vista={datos.data.vista}
      ancla={datos.data.ancla}
      hoy={datos.data.hoy}
      lista={datos.data.lista}
      porContestar={datos.data.porContestar}
      error={parametros.get('error') ?? undefined}
      guardado={parametros.get('guardado') ?? undefined}
    />
  );
}
