import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';

import { Presentacion } from '@/app/bienvenida/_components/presentacion';
import { VistaEmpezar } from '@/app/empezar/_components/vista-empezar';
import { VistaBuscar } from '@/app/buscar/_components/vista-buscar';
import { VistaCiudad } from '@/app/buscar/_components/vista-ciudad';
import { CercaDeMi } from '@/app/buscar/cerca/_components/cerca-de-mi';
import type {
  RespuestaBuscar,
  RespuestaCerca,
  RespuestaCiudades,
} from '@/lib/app-api/iglesias';
import { pedir } from '@movil/lib/api';
import { marcarBienvenidaVista } from '@movil/lib/bienvenida';
import { API_URL } from '@movil/lib/entorno';
import { useSesion } from '@movil/lib/sesion';

/**
 * La bienvenida de la app: la presentación, la pregunta y los tres caminos
 * para encontrar iglesia. Son las vistas de la web (`src/app/bienvenida`,
 * `empezar`, `buscar`), las mismas piezas, con los datos pedidos a la API.
 *
 * Quien ya tiene sesión no pasa por aquí: al arranque, que sabe a dónde va.
 * Se mira solo en la presentación y en la pregunta, como en la web; buscar
 * iglesia lo puede hacer cualquiera.
 */
export function Bienvenida() {
  const { cargando, session } = useSesion();
  if (cargando) return null;
  if (session) return <Navigate to="/" replace />;
  return <Presentacion />;
}

export function Empezar() {
  const { cargando, session } = useSesion();
  useEffect(() => marcarBienvenidaVista(), []);
  if (cargando) return null;
  if (session) return <Navigate to="/" replace />;
  return <VistaEmpezar />;
}

export function Buscar() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const q = (parametros.get('q') ?? '').trim().slice(0, 80);

  const resultados = useQuery({
    queryKey: ['iglesias', 'q', q],
    queryFn: () => pedir<RespuestaBuscar>('/iglesias', { datos: { q } }),
    enabled: q.length >= 2,
    // Lo que hay en el directorio cambia poco, y volver atrás a una búsqueda
    // tiene que pintarla al instante.
    staleTime: 5 * 60_000,
  });

  return (
    <VistaBuscar
      q={q}
      resultados={resultados.data?.iglesias ?? []}
      cargando={q.length >= 2 && resultados.isPending}
      buscador={{
        sugerenciasDesde: `${API_URL}/api/v1/app/iglesias/sugerencias`,
        alBuscar: (texto) => navegar(`/buscar?q=${encodeURIComponent(texto)}`),
      }}
    />
  );
}

export function BuscarCiudad() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const ciudad = (parametros.get('ciudad') ?? '').trim().slice(0, 80);

  const ciudades = useQuery({
    queryKey: ['iglesias', 'ciudades'],
    queryFn: () => pedir<RespuestaCiudades>('/iglesias/ciudades'),
    staleTime: 10 * 60_000,
  });
  const iglesias = useQuery({
    queryKey: ['iglesias', 'ciudad', ciudad],
    queryFn: () => pedir<RespuestaBuscar>('/iglesias', { datos: { ciudad } }),
    enabled: ciudad.length >= 2,
    staleTime: 5 * 60_000,
  });

  return (
    <VistaCiudad
      ciudad={ciudad}
      ciudades={ciudades.data?.ciudades ?? []}
      iglesias={iglesias.data?.iglesias ?? []}
      cargando={ciudad.length >= 2 && iglesias.isPending}
      alBuscar={(texto) => navegar(`/buscar/ciudad?ciudad=${encodeURIComponent(texto)}`)}
    />
  );
}

/**
 * «Cerca de mí»: el mismo `CercaDeMi` de la web. La ubicación y la dirección
 * escrita no salen del teléfono: la API solo da las iglesias con su sitio, y
 * la distancia se calcula aquí.
 */
export function BuscarCerca() {
  const iglesias = useQuery({
    queryKey: ['iglesias', 'cerca'],
    queryFn: () => pedir<RespuestaCerca>('/iglesias/cerca'),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="mx-auto flex w-full max-w-[560px] items-center px-2 pt-2">
        <Link
          to="/empezar"
          aria-label="Volver"
          className="flex size-11 items-center justify-center rounded-full text-foreground outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <ChevronLeft className="size-5" strokeWidth={1.9} />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pt-2">
        {iglesias.data ? (
          <CercaDeMi iglesias={iglesias.data.iglesias} />
        ) : (
          <p className="text-[14px] text-muted-foreground">
            {iglesias.error ? iglesias.error.message : 'Cargando…'}
          </p>
        )}
      </main>
    </div>
  );
}
