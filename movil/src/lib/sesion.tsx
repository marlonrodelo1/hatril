import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { RespuestaYo } from '@/lib/app-api/yo';
import { pedir } from './api';
import { supabase } from './supabase';

/**
 * La sesión de la app y lo que la API dice de ella (`/yo`).
 *
 * `cargando` mientras supabase-js lee la sesión guardada: en ese rato la app
 * no sabe si mandar a la bienvenida o al muro, y no debe pintar ninguna de
 * las dos.
 *
 * AL CERRAR SESIÓN, LA CACHÉ SE VACÍA ENTERA
 * ------------------------------------------
 * Lo que guarda React Query son datos del art. 9: el muro de una
 * congregación, quién sirve dónde. Si en el mismo teléfono entra otra persona,
 * no puede ver ni un fotograma de lo de la anterior. Por eso nada se guarda en
 * disco (`../main.tsx`) y al salir se borra todo lo que hay en memoria.
 */
type EstadoSesion = {
  cargando: boolean;
  session: Session | null;
};

const Contexto = createContext<EstadoSesion>({ cargando: true, session: null });

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ cargando: true, session: null });
  const cliente = useQueryClient();

  useEffect(() => {
    let vivo = true;
    // De quién es lo que hay en la caché. Se vacía solo cuando cambia la
    // persona (entra otra, o nadie): Supabase avisa con `SIGNED_IN` también
    // al volver a la app con la misma sesión, y vaciar ahí tiraría la caché
    // que hace rápido cambiar de pestaña.
    let duenoDeLaCache: string | null | undefined;
    const cambiarA = (session: Session | null) => {
      const quien = session?.user.id ?? null;
      if (duenoDeLaCache !== undefined && duenoDeLaCache !== quien) cliente.clear();
      duenoDeLaCache = quien;
      setEstado({ cargando: false, session });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (vivo) cambiarA(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (vivo) cambiarA(session);
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [cliente]);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useSesion(): EstadoSesion {
  return useContext(Contexto);
}

/** `/yo`: quién soy, mi iglesia, mis pestañas. Solo con sesión. */
export function useYo() {
  const { session } = useSesion();
  return useQuery({
    queryKey: ['yo', session?.user.id],
    queryFn: () => pedir<RespuestaYo>('/yo'),
    enabled: !!session,
    // Cambia poco: la iglesia, las pestañas, la radio. Se refresca al volver
    // a la app y cuando algo lo invalida a propósito (pedir entrar, aceptar).
    staleTime: 5 * 60_000,
  });
}
