import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { VistaFicha } from '@/app/iglesia/[slug]/_components/vista-ficha';
import { PasosSolicitud } from '@/app/solicitar/[slug]/_components/pasos-solicitud';
import { Permisos } from '@/app/solicitar/[slug]/_components/permisos';
import type { RespuestaFicha } from '@/lib/app-api/iglesias';
import {
  EsquemaCuentaYSolicitud,
  EsquemaSolicitud,
  MENSAJE_CORREO_CON_CUENTA,
  leerSolicitud,
  type RespuestaSolicitud,
} from '@/lib/app-api/solicitud';
import { traducirErrorAuth, validarPassword } from '@/lib/auth/password';
import { ErrorApi, pedir } from '@movil/lib/api';
import { WEB_URL } from '@movil/lib/entorno';
import { useSesion } from '@movil/lib/sesion';
import { supabase } from '@movil/lib/supabase';
import { AccesoNativo } from './acceso/acceso-nativo';
import { NoExiste } from './en-obras';
import { SinConexion } from './arranque';

/**
 * La ficha de una iglesia y «Pedir unirme». Las vistas son las de la web
 * (`VistaFicha`, `PasosSolicitud`), con los datos de
 * `/api/v1/app/iglesias/[slug]`, que dice además qué tiene que ver con ella
 * quien mira.
 */
function useFicha(slug: string) {
  const { session } = useSesion();
  return useQuery({
    // Con la cuenta en la clave: la relación con la iglesia cambia al entrar.
    queryKey: ['iglesia', slug, session?.user.id ?? null],
    queryFn: () => pedir<RespuestaFicha>(`/iglesias/${encodeURIComponent(slug)}`),
    staleTime: 60_000,
  });
}

export function FichaIglesia() {
  const { slug = '' } = useParams();
  const ficha = useFicha(slug);

  if (ficha.isPending) return null;
  if (ficha.error) {
    if (ficha.error instanceof ErrorApi && ficha.error.status === 404) return <NoExiste />;
    return <SinConexion mensaje={ficha.error.message} reintentar={() => void ficha.refetch()} />;
  }

  const { iglesia, relacion, pendienteEn, miIglesia } = ficha.data;
  return (
    <VistaFicha
      iglesia={iglesia}
      miIglesia={miIglesia}
      esDeEsta={relacion === 'de_esta'}
      pendiente={pendienteEn}
      urlWeb={`${WEB_URL}/i/${iglesia.slug}`}
    />
  );
}

/**
 * «Pedir unirme». El formulario es `PasosSolicitud` de la web, que acepta
 * cualquier función como `accion`: aquí, una que valida con el mismo esquema,
 * crea la cuenta si hace falta, abre la sesión en el teléfono y manda la
 * solicitud a la API.
 *
 * El orden de `crearCuentaYSolicitar` se mantiene: primero se valida todo, y
 * solo entonces se crea la cuenta. Un teléfono vacío no deja una cuenta
 * creada sin solicitud.
 *
 * Los errores vuelven como en la web, en `?error=`: `PasosSolicitud` lleva
 * `key` con el error y empieza de cero, igual que tras una action.
 */
export function Solicitar() {
  const { slug = '' } = useParams();
  const [parametros] = useSearchParams();
  const error = parametros.get('error') ?? undefined;
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const { session } = useSesion();
  const ficha = useFicha(slug);
  const [errorNativo, setErrorNativo] = useState<string | null>(null);

  if (ficha.isPending) return null;
  if (ficha.error) {
    if (ficha.error instanceof ErrorApi && ficha.error.status === 404) return <NoExiste />;
    return <SinConexion mensaje={ficha.error.message} reintentar={() => void ficha.refetch()} />;
  }

  const { iglesia, relacion, nombreSugerido } = ficha.data;

  // Con iglesia o con una solicitud pendiente no hay nada que pedir: a su
  // sitio. Y si esta iglesia no acepta solicitudes, la ficha cuenta por qué.
  if (relacion === 'de_esta' || relacion === 'de_otra' || relacion === 'pendiente') {
    return <Navigate to="/" replace />;
  }
  if (!iglesia.aceptaSolicitudes) return <Navigate to={`/iglesia/${slug}`} replace />;

  const volverCon = (mensaje: string) =>
    navegar(`/solicitar/${slug}?error=${encodeURIComponent(mensaje)}`, { replace: true });

  async function accion(formData: FormData) {
    try {
      if (session) {
        const parsed = EsquemaSolicitud.safeParse(leerSolicitud(formData));
        if (!parsed.success) return volverCon(parsed.error.issues[0]!.message);
        await enviar(parsed.data);
        return;
      }

      const parsed = EsquemaCuentaYSolicitud.safeParse({
        ...leerSolicitud(formData),
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
      });
      if (!parsed.success) return volverCon(parsed.error.issues[0]!.message);
      const { email, password, ...solicitud } = parsed.data;

      const errorPassword = validarPassword(password);
      if (errorPassword) return volverCon(errorPassword);

      try {
        await pedir('/cuenta', { method: 'POST', datos: { nombre: solicitud.nombre, email, password } });
      } catch (e) {
        if (e instanceof ErrorApi && e.status === 409) return volverCon(MENSAJE_CORREO_CON_CUENTA);
        throw e;
      }

      const { error: errorSesion } = await supabase.auth.signInWithPassword({ email, password });
      if (errorSesion) {
        navegar(
          `/acceso?next=${encodeURIComponent(`/solicitar/${slug}`)}&error=${encodeURIComponent(
            traducirErrorAuth(errorSesion.message),
          )}`,
          { replace: true },
        );
        return;
      }

      await enviar(solicitud);
    } catch (e) {
      volverCon(e instanceof Error ? e.message : 'Algo ha fallado. Inténtalo de nuevo.');
    }
  }

  async function enviar(datos: unknown) {
    try {
      const r = await pedir<RespuestaSolicitud>('/solicitud', { method: 'POST', datos: datos as Record<string, unknown> });
      await cliente.invalidateQueries({ queryKey: ['yo'] });
      navegar(r.resultado === 'enviada' ? '/mi?enviada=1' : '/', { replace: true });
    } catch (e) {
      if (e instanceof ErrorApi && e.ir && e.ir !== `/solicitar/${slug}`) {
        navegar(`${e.ir}?error=${encodeURIComponent(e.message)}`, { replace: true });
        return;
      }
      throw e;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <PasosSolicitud
        key={error ?? ''}
        slug={slug}
        nombreIglesia={iglesia.nombre}
        paisIglesia={iglesia.pais}
        conSesion={Boolean(session)}
        nombreSugerido={nombreSugerido ?? ''}
        error={error ?? errorNativo ?? undefined}
        accion={accion}
        permisos={<Permisos />}
        accesoRapido={
          session ? undefined : <AccesoNativo next={`/solicitar/${slug}`} alFallar={setErrorNativo} />
        }
      />
    </div>
  );
}
