import type { ComponentType } from 'react';
import { useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { VistaEquipos } from '@/app/mi/equipo/vista';
import { VistaPortada } from '@/app/mi/equipo/[id]/vista';
import { VistaFondo } from '@/app/mi/equipo/[id]/fondo/vista';
import { VistaTurnos } from '@/app/mi/equipo/[id]/turnos/vista';
import { VistaPlanificar } from '@/app/mi/equipo/[id]/turnos/planificar/vista';
import { VistaTurnoEquipo } from '@/app/mi/equipo/[id]/turnos/[turnoId]/vista';
import { VistaAgendaEquipo } from '@/app/mi/equipo/[id]/agenda/vista';
import { VistaReunionNueva } from '@/app/mi/equipo/[id]/agenda/nueva/vista';
import { VistaReunionEquipo } from '@/app/mi/equipo/[id]/agenda/[reunionId]/vista';
import { VistaReunionEditar } from '@/app/mi/equipo/[id]/agenda/[reunionId]/editar/vista';
import { VistaRepertorio } from '@/app/mi/equipo/[id]/repertorio/vista';
import { VistaCancionNueva } from '@/app/mi/equipo/[id]/repertorio/nueva/vista';
import { VistaCancion } from '@/app/mi/equipo/[id]/repertorio/[cancionId]/vista';
import { VistaSeguimiento } from '@/app/mi/equipo/[id]/seguimiento/vista';
import { VistaSeguimientoPersona } from '@/app/mi/equipo/[id]/seguimiento/[miembroId]/vista';
import { VistaNinos } from '@/app/mi/equipo/[id]/ninos/vista';
import { VistaCronograma } from '@/app/mi/equipo/[id]/ninos/cronograma/vista';
import { VistaFamilias } from '@/app/mi/equipo/[id]/ninos/familias/vista';
import { VistaPublicacion } from '@/app/mi/equipo/[id]/ninos/publicacion/[publicacionId]/vista';
import { emparejarPantalla, type NombrePantallaEquipo } from '@/lib/app-api/equipo';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { ErrorApi, pedir } from '@movil/lib/api';
import { NoExiste } from '../en-obras';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * Las diecinueve pantallas de `/mi/equipo`, con sus vistas de la web.
 *
 * La dirección decide la pantalla con la misma tabla que la API
 * (`PANTALLAS_EQUIPO`), y la API devuelve sus datos con su guarda. Las vistas
 * llevan dentro su marco (`MarcoEquipo`), cuya cabecera la app sustituye por
 * la suya al compilar. Las actions —planificar turnos, pasar lista, registrar
 * un contacto— son las de la web (`enLaApp`), llamadas por la API.
 */
const VISTAS: Record<NombrePantallaEquipo, ComponentType<never>> = {
  equipos: VistaEquipos,
  portada: VistaPortada,
  fondo: VistaFondo,
  turnos: VistaTurnos,
  planificar: VistaPlanificar,
  turno: VistaTurnoEquipo,
  agenda: VistaAgendaEquipo,
  reunionNueva: VistaReunionNueva,
  reunion: VistaReunionEquipo,
  reunionEditar: VistaReunionEditar,
  repertorio: VistaRepertorio,
  cancionNueva: VistaCancionNueva,
  cancion: VistaCancion,
  seguimiento: VistaSeguimiento,
  persona: VistaSeguimientoPersona,
  ninos: VistaNinos,
  ninosCronograma: VistaCronograma,
  ninosFamilias: VistaFamilias,
  ninosPublicacion: VistaPublicacion,
} as Record<NombrePantallaEquipo, ComponentType<never>>;

type RespuestaEquipo = { pantalla: NombrePantallaEquipo; datos: Record<string, unknown> };

export function Equipo() {
  const { '*': resto = '' } = useParams();
  const { search } = useLocation();
  const segmentos = resto.split('/').filter(Boolean);
  const pantalla = emparejarPantalla(segmentos);

  const datos = useQuery({
    queryKey: ['equipo', resto, search],
    queryFn: () => pedir<RespuestaEquipo>(`/mi/equipo${resto ? `/${resto}` : ''}${search}`),
    enabled: pantalla !== null,
  });

  const cabecera = <CabeceraApp titulo="Equipo" />;
  if (!pantalla) return <NoExiste />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) {
    if (datos.error instanceof ErrorApi && datos.error.status === 404) return <NoExiste />;
    return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  }

  const Vista = VISTAS[datos.data.pantalla] as ComponentType<Record<string, unknown>>;
  return <Vista {...datos.data.datos} />;
}
