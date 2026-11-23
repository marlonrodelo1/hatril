import { Outlet } from 'react-router';

import { BarraInferior } from '@/app/mi/_components/barra-inferior';
import { MiniReproductor } from '@/app/mi/_components/mini-reproductor';
import { useYo } from '@movil/lib/sesion';

/**
 * El marco del área del miembro: `src/app/mi/layout.tsx` en la app.
 *
 * Las mismas piezas: la barra de abajo (`BarraInferior`) y, si la iglesia
 * tiene una radio con señal, el reproductor encima (`MiniReproductor`). Los
 * dos son componentes de cliente de la web y van tal cual. Lo que el layout
 * de la web consultaba —la radio, la pestaña de equipo— viene en `/yo`.
 *
 * Como en la web, el marco no protege nada: cada pantalla pide sus datos a la
 * API, y la API pone la guarda. Y solo pinta la barra a quien tiene iglesia.
 */
export function MarcoMiembro() {
  const { data: yo } = useYo();
  const conIglesia = yo?.situacion === 'iglesia' && yo.iglesia;
  if (!conIglesia) return <Outlet />;

  const radio = yo.radio;
  return (
    <>
      <Outlet />
      {radio && (
        <MiniReproductor
          nombre={radio.nombre}
          streamUrl={radio.streamUrl}
          parrilla={radio.parrilla}
          timezone={yo.iglesia!.timezone}
          iglesiaNombre={yo.iglesia!.nombre}
          caratula={yo.iglesia!.logoUrl}
        />
      )}
      <BarraInferior equipo={yo.pestanas.equipo} />
      {/* El hueco de la barra, con las mismas medidas que el layout de la web
          (el porqué de cada número está allí). */}
      <div
        className={
          radio
            ? 'h-[calc(var(--alto-barra-mi,70px)+66px)] md:h-[148px]'
            : 'h-[calc(var(--alto-barra-mi,70px)+12px)] md:h-[88px]'
        }
        aria-hidden
      />
    </>
  );
}
