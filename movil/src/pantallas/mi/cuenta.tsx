import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { TamanoLetra } from '@/app/mi/_components/tamano-letra';
import { VistaBiblia } from '@/app/mi/biblia/_components/vista-biblia';
import { VistaBloqueados } from '@/app/mi/cuenta/_components/vista-bloqueados';
import { VistaBorrar } from '@/app/mi/cuenta/_components/vista-borrar';
import { VistaCuenta } from '@/app/mi/cuenta/_components/vista-cuenta';
import { VistaDonativos } from '@/app/mi/cuenta/_components/vista-donativos';
import { libroPorSlug } from '@/lib/biblia/libros';
import type { RespuestaHijos } from '@/lib/app-api/hijos';
import type {
  RespuestaBiblia,
  RespuestaBloqueados,
  RespuestaBorrar,
  RespuestaCuenta,
  RespuestaDonativos,
} from '@/lib/app-api/miembro';
import { CabeceraApp } from '@movil/componentes/cabecera-app';
import { pedir } from '@movil/lib/api';
import { WEB_URL } from '@movil/lib/entorno';
import { useYo } from '@movil/lib/sesion';
import { Cargando, ErrorDePantalla } from './comun';

/**
 * Mi cuenta y lo que cuelga de ella, y la Biblia, con las vistas de la web.
 * Cambiar la foto, el permiso de asistencia, desbloquear, dejar un donativo
 * mensual y pedir la baja son las actions de la web, llamadas por la API.
 */

/**
 * El enlace a la página de dar en la app: SIEMPRE fuera, en el navegador del
 * teléfono (norma 3.2.2 de Apple). En la web lo decide `EnlaceADar` mirando el
 * User-Agent.
 */
function EnlaceDarApp({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={`${WEB_URL}${href}`} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  );
}

export function Cuenta() {
  const [parametros] = useSearchParams();
  const { data: yo } = useYo();
  const datos = useQuery({ queryKey: ['cuenta'], queryFn: () => pedir<RespuestaCuenta>('/mi/cuenta') });
  // «Mis hijos» solo sale si la iglesia tiene el tablón de familias. Aparte y
  // sin bloquear: si tarda o falla, Mi cuenta se pinta igual, sin esa fila.
  const hijos = useQuery({ queryKey: ['hijos'], queryFn: () => pedir<RespuestaHijos>('/mi/hijos') });
  const misHijos = hijos.data && hijos.data.ministerios.length > 0 ? { detalle: detalleDeMisHijos(hijos.data) } : null;

  const cabecera = <CabeceraApp titulo="Mi cuenta" subtitulo={yo?.iglesia?.nombre} logoUrl={yo?.iglesia?.logoUrl} />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;

  // «Cambiar la contraseña» lleva al panel a quien es del equipo: en la app,
  // ese panel se abre fuera, con la dirección entera.
  const contrasena = datos.data.contrasena.href.startsWith('/panel')
    ? { ...datos.data.contrasena, href: `${WEB_URL}${datos.data.contrasena.href}` }
    : datos.data.contrasena;

  return (
    <VistaCuenta
      cabecera={cabecera}
      EnlaceDar={EnlaceDarApp}
      urlWebIglesia={`${WEB_URL}/i/${datos.data.iglesia.slug}`}
      error={parametros.get('error') ?? undefined}
      guardado={parametros.get('guardado') ?? undefined}
      {...datos.data}
      contrasena={contrasena}
      misHijos={misHijos}
    />
  );
}

function detalleDeMisHijos(d: RespuestaHijos): string {
  if (d.hijos.length === 1) return `${d.hijos[0]!.nombre}: ver el tablón y los permisos`;
  if (d.hijos.length > 1) return `${d.hijos.length} hijos: ver el tablón y los permisos`;
  if (d.solicitudes.length > 0) return 'Esperando a que la responsable lo acepte';
  return 'Ver lo que hacen en el ministerio, con sus fotos';
}

export function Bloqueados() {
  const [parametros] = useSearchParams();
  const { data: yo } = useYo();
  const datos = useQuery({
    queryKey: ['cuenta', 'bloqueados'],
    queryFn: () => pedir<RespuestaBloqueados>('/mi/cuenta/bloqueados'),
  });

  const cabecera = <CabeceraApp titulo="Personas bloqueadas" subtitulo={yo?.iglesia?.nombre} volver="/mi/cuenta" />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return (
    <VistaBloqueados
      cabecera={cabecera}
      {...datos.data}
      desbloqueado={parametros.get('desbloqueado') ?? undefined}
      error={parametros.get('error') ?? undefined}
    />
  );
}

export function Borrar() {
  const [parametros] = useSearchParams();
  const datos = useQuery({ queryKey: ['cuenta', 'borrar'], queryFn: () => pedir<RespuestaBorrar>('/mi/cuenta/borrar') });

  const cabecera = <CabeceraApp titulo="Borrar mi cuenta" volver="/mi/cuenta" />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return <VistaBorrar cabecera={cabecera} {...datos.data} error={parametros.get('error') ?? undefined} />;
}

export function Donativos() {
  const [parametros] = useSearchParams();
  const anio = parametros.get('anio') ?? undefined;
  const { data: yo } = useYo();
  const datos = useQuery({
    queryKey: ['cuenta', 'donativos', anio ?? 'este'],
    queryFn: () => pedir<RespuestaDonativos>('/mi/cuenta/donativos', { datos: { anio } }),
  });

  const cabecera = <CabeceraApp titulo="Lo que he dado" subtitulo={yo?.iglesia?.nombre} volver="/mi/cuenta" />;
  if (datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return (
    <VistaDonativos
      cabecera={cabecera}
      EnlaceDar={EnlaceDarApp}
      {...datos.data}
      error={parametros.get('error') ?? undefined}
      dejado={parametros.get('dejado') ?? undefined}
    />
  );
}

/**
 * La Biblia. El índice y los libros salen del código; el texto, de la API, y
 * cada capítulo leído se queda en la caché para volver a él sin esperar.
 */
export function Biblia() {
  const [parametros] = useSearchParams();
  const slug = parametros.get('libro') ?? undefined;
  const cap = parametros.get('cap') ?? undefined;
  const q = parametros.get('q') ?? undefined;
  const libro = libroPorSlug(slug);
  const { data: yo } = useYo();

  const datos = useQuery({
    queryKey: ['biblia', slug ?? '', cap ?? ''],
    queryFn: () => pedir<RespuestaBiblia>('/mi/biblia', { datos: { libro: slug, cap } }),
    enabled: Boolean(libro && cap),
    staleTime: Infinity,
  });
  const capitulo = datos.data?.capitulo ?? null;

  // La misma cabecera que la web: con flecha y sin logo dentro de un libro.
  const cabecera = (
    <CabeceraApp
      logoUrl={libro ? undefined : yo?.iglesia?.logoUrl}
      titulo={libro && !capitulo ? libro.nombre : 'Biblia'}
      subtitulo={
        libro
          ? capitulo
            ? undefined
            : cap
              ? `Capítulo ${cap} · Reina-Valera 1909`
              : 'Reina-Valera 1909'
          : yo?.iglesia?.nombre
      }
      volver={libro ? (cap ? `/mi/biblia?libro=${libro.slug}` : '/mi/biblia') : undefined}
    >
      {capitulo && <TamanoLetra para="biblia" />}
    </CabeceraApp>
  );

  if (libro && cap && datos.isPending) return <Cargando cabecera={cabecera} />;
  if (datos.error) return <ErrorDePantalla cabecera={cabecera} error={datos.error} reintentar={() => void datos.refetch()} />;
  return <VistaBiblia cabecera={cabecera} slug={slug} cap={cap} q={q} capitulo={capitulo} />;
}
