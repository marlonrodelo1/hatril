import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import type { Moneda } from '@/lib/db/schema';
import { CuentasDelFondoVista } from '@/app/panel/ministerios/[id]/fondo/_components/cuentas';
import { MarcoEquipo } from '../../_components/marco';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosFondo = Awaited<ReturnType<typeof cargar>>;

export function VistaFondo({ id, ctx, ministerio, mes, cuentas }: DatosFondo) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={`Fondo · ${ministerio.nombre}`}
      subtitulo="De solo lectura"
      volver={rutaApp(id)}
    >
      <CuentasDelFondoVista
        cuentas={cuentas}
        moneda={ctx.iglesia.moneda as Moneda}
        base={rutaApp(id, 'fondo')}
        mes={mes}
      />
    </MarcoEquipo>
  );
}
