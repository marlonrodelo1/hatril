import { Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { VistaAcepta } from '@/app/acepta/_components/vista-acepta';
import { VistaCuentaEnBaja } from '@/app/cuenta-en-baja/_components/vista-cuenta-en-baja';
import type { RespuestaAcepta } from '@/lib/app-api/miembro';
import { pedir } from '@movil/lib/api';
import { WEB_URL } from '@movil/lib/entorno';
import { useYo } from '@movil/lib/sesion';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * Aceptar la política al día: la vista de la web. «Acepto y sigo» es la action
 * `aceptar` de la web; al terminar redirige, la caché se invalida y `/yo`
 * vuelve con el consentimiento al día.
 */
export function Acepta() {
  const datos = useQuery({ queryKey: ['acepta'], queryFn: () => pedir<RespuestaAcepta>('/acepta') });
  if (datos.isPending) return <Cargando cabecera={null} />;
  if (datos.error) return <ErrorDePantalla cabecera={null} error={datos.error} reintentar={() => void datos.refetch()} />;
  return <VistaAcepta {...datos.data} urlPrivacidad={`${WEB_URL}/privacidad`} />;
}

/** Quien pidió borrar su cuenta: lo dice `/yo`, sin pedir nada más. */
export function CuentaEnBaja() {
  const { data: yo, isPending } = useYo();
  if (isPending) return null;
  if (!yo?.baja) return <Navigate to="/" replace />;
  return <VistaCuentaEnBaja borrarDesde={new Date(yo.baja.borrarDesde)} />;
}
