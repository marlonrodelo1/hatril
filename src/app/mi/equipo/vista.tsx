import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import type { ModoEnElEquipo } from '@/lib/ministerios/en-la-app/contrato';
import { Fila, FilaEnlace, Lista, MarcoEquipo, Seccion } from './_components/marco';
import { Insignia } from './_components/insignia';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosEquipos = Awaited<ReturnType<typeof cargar>>;

export function VistaEquipos({ error, ctx, llevo, sirvo }: DatosEquipos) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Equipo"
      subtitulo={ctx.iglesia.nombre}
      conLogo
      error={error}
    >
      {llevo.length > 0 && (
        <Seccion rotulo="Lo que llevas">
          <Lista>
            {llevo.map((f) => f && <FilaEquipo key={f.id} fila={f} />)}
          </Lista>
        </Seccion>
      )}
      {sirvo.length > 0 && (
        <Seccion rotulo="Donde sirves">
          <Lista>
            {sirvo.map((f) => f && <FilaEquipo key={f.id} fila={f} />)}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}
export type ResumenDeEquipo = {
  id: string;
  nombre: string;
  colorHex: string;
  modo: ModoEnElEquipo;
  total: number;
  lineas: string[];
};

function FilaEquipo({ fila: f }: { fila: ResumenDeEquipo }) {
  const color = colorDeMinisterio(f.colorHex);
  return (
    <Fila>
      <FilaEnlace
        href={rutaApp(f.id)}
        derecha={
          f.total > 0 ? (
            <Insignia tono="aviso">
              {f.total === 1 ? '1 pendiente' : `${f.total} pendientes`}
            </Insignia>
          ) : undefined
        }
      >
        <span className="flex items-center gap-2 text-body font-semibold">
          {/* El color del ministerio, de `colorDeMinisterio()`: el único
              color que no sale de un token, y por eso en línea. */}
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ backgroundColor: color.hex }}
            aria-hidden
          />
          <span className="truncate">{f.nombre}</span>
        </span>
        {f.lineas.map((l, i) => (
          <span key={i} className="truncate text-label text-muted-foreground">
            {l}
          </span>
        ))}
      </FilaEnlace>
    </Fila>
  );
}
