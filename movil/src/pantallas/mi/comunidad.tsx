import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { VistaComunidad } from '@/app/mi/comunidad/_components/vista-comunidad';
import { VistaDenuncias } from '@/app/mi/comunidad/_components/vista-denuncias';
import { VistaDenunciaEnviada } from '@/app/mi/comunidad/_components/vista-denuncia-enviada';
import type {
  RespuestaComunidad,
  RespuestaDenunciaEnviada,
  RespuestaDenuncias,
} from '@/lib/app-api/miembro';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { pedir } from '@movil/lib/api';
import { useYo } from '@movil/lib/sesion';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * El muro y lo que cuelga de él, con las vistas de la web. Publicar, dar me
 * gusta, comentar, denunciar y bloquear son las actions de la web
 * (`src/app/mi/comunidad/actions.ts`), llamadas por la API; al terminar, la
 * caché se invalida y el muro se vuelve a pedir, como el `revalidatePath`.
 */
export function Comunidad() {
  const [parametros] = useSearchParams();
  const { data: yo } = useYo();
  const datos = useQuery({
    queryKey: ['comunidad'],
    queryFn: () => pedir<RespuestaComunidad>('/mi/comunidad'),
  });

  const cabecera = (
    <CabeceraApp titulo="Comunidad" subtitulo={yo?.iglesia?.nombre} logoUrl={yo?.iglesia?.logoUrl} />
  );
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return (
    <VistaComunidad
      cabecera={cabecera}
      {...datos.data}
      error={parametros.get('error') ?? undefined}
      bloqueado={parametros.get('bloqueado') ?? undefined}
    />
  );
}

export function Denuncias() {
  const [parametros] = useSearchParams();
  const { data: yo } = useYo();
  const datos = useQuery({
    queryKey: ['comunidad', 'denuncias'],
    queryFn: () => pedir<RespuestaDenuncias>('/mi/comunidad/denuncias'),
  });

  const cabecera = (
    <CabeceraApp titulo="Denuncias" subtitulo={yo?.iglesia?.nombre} volver="/mi/comunidad" />
  );
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return (
    <VistaDenuncias
      cabecera={cabecera}
      cola={datos.data.cola}
      error={parametros.get('error') ?? undefined}
      hecho={parametros.get('hecho') ?? undefined}
    />
  );
}

export function DenunciaEnviada() {
  const [parametros] = useSearchParams();
  const autor = parametros.get('autor') ?? undefined;
  const { data: yo } = useYo();
  const datos = useQuery({
    queryKey: ['comunidad', 'denuncia-enviada', autor ?? ''],
    queryFn: () => pedir<RespuestaDenunciaEnviada>('/mi/comunidad/denuncia-enviada', { datos: { autor } }),
  });

  const cabecera = (
    <CabeceraApp titulo="Comunidad" subtitulo={yo?.iglesia?.nombre} volver="/mi/comunidad" />
  );
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return <VistaDenunciaEnviada cabecera={cabecera} {...datos.data} />;
}
