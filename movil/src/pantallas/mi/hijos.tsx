import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { VistaHijos } from '@/app/mi/hijos/_components/vista-hijos';
import { VistaPedirHijo } from '@/app/mi/hijos/_components/vista-pedir';
import { VistaTablonHijos } from '@/app/mi/hijos/_components/vista-tablon';
import type { RespuestaHijos, RespuestaTablonHijos } from '@/lib/app-api/hijos';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { pedir } from '@movil/lib/api';
import { useYo } from '@movil/lib/sesion';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * «Mis hijos» del ministerio de Niños: solo en la app (`plan-ninos.md` §6).
 * Las vistas son las de `src/app/mi/hijos/_components`, y sus actions, las de
 * `src/app/mi/hijos/actions.ts`, llamadas por la API (`../../lib/acciones.ts`).
 */

export function MisHijos() {
  const [parametros] = useSearchParams();
  const { data: yo } = useYo();
  const datos = useQuery({ queryKey: ['hijos'], queryFn: () => pedir<RespuestaHijos>('/mi/hijos') });

  const cabecera = <CabeceraApp titulo="Mis hijos" subtitulo={yo?.iglesia?.nombre} volver="/mi/cuenta" />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return (
    <VistaHijos
      cabecera={cabecera}
      datos={datos.data}
      error={parametros.get('error') ?? undefined}
      guardado={parametros.get('guardado') ?? undefined}
    />
  );
}

export function PedirHijo() {
  const [parametros] = useSearchParams();
  const datos = useQuery({ queryKey: ['hijos'], queryFn: () => pedir<RespuestaHijos>('/mi/hijos') });

  const cabecera = <CabeceraApp titulo="Tengo un hijo en Niños" volver="/mi/hijos" />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return (
    <VistaPedirHijo
      cabecera={cabecera}
      iglesia={datos.data.iglesia}
      ministerios={datos.data.ministerios}
      error={parametros.get('error') ?? undefined}
    />
  );
}

/**
 * Las URL de las fotos caducan a los diez minutos. Por eso esta caché dura
 * menos que la de las demás pantallas: pasado ese rato se vuelven a pedir, y
 * no se pinta una foto con una firma que ya no vale.
 */
export function TablonHijos() {
  const datos = useQuery({
    queryKey: ['hijos', 'tablon'],
    queryFn: () => pedir<RespuestaTablonHijos>('/mi/hijos/tablon'),
    staleTime: 60_000,
    gcTime: 8 * 60_000,
  });

  const cabecera = <CabeceraApp titulo="El tablón" subtitulo="Ministerio de Niños" volver="/mi/hijos" />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return <VistaTablonHijos cabecera={cabecera} publicaciones={datos.data.publicaciones} />;
}
