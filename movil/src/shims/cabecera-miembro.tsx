import type { ReactNode } from 'react';

import { CabeceraApp } from '@movil/componentes/cabecera-app';

/**
 * `CabeceraMiembro` dentro de la app: la cabecera de la app con las mismas
 * props.
 *
 * La de la web (`src/app/mi/_components/cabecera-miembro.tsx`) consulta en el
 * servidor —la campana, la foto, «Dar»— y no puede ejecutarse en el teléfono.
 * Las vistas que la app comparte con la web la usan dentro de su marco (las
 * quince de `/mi/equipo`, a través de `MarcoEquipo`): al compilar la app, ese
 * módulo se sustituye por este (`movil/vite.config.ts`), y la cabecera pide
 * sus datos a la API como el resto de la app. `user` se ignora: la app sabe
 * quién es por su sesión.
 */
export function CabeceraMiembro({
  titulo,
  subtitulo,
  volver,
  campana = true,
  logoUrl,
  marca = false,
  children,
}: {
  user?: unknown;
  titulo: string;
  subtitulo?: string;
  volver?: string;
  campana?: boolean;
  logoUrl?: string | null;
  marca?: boolean;
  children?: ReactNode;
}) {
  return (
    <CabeceraApp
      titulo={titulo}
      subtitulo={subtitulo}
      volver={volver}
      campana={campana}
      logoUrl={logoUrl}
      marca={marca}
    >
      {children}
    </CabeceraApp>
  );
}
