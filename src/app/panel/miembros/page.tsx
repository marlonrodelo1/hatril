import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Plus, SearchX, UserPlus } from 'lucide-react';

import { requirePanel } from '@/lib/auth/guard-panel';
import { puede, esPastor } from '@/lib/auth/permisos';
import {
  listarMiembros,
  listarMinisterios,
  resumenMiembros,
  POR_PAGINA,
  type FiltrosMiembros as Filtros,
} from '@/lib/miembros/consultas';
import { ESTADOS, type EstadoMiembro } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { EstadoVacio as Vacio } from '@/components/ui/estado-vacio';
import { Insignia } from '@/components/ui/insignia';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { FiltrosMiembros, BuscadorMiembros } from './_components/filtros';
import { FichaMiembroPanel } from './_components/ficha';
import { Paginacion } from '../_components/paginacion';

export const metadata: Metadata = { title: 'Miembros' };

function esEstadoValido(v: string | undefined): v is EstadoMiembro {
  return !!v && v in ESTADOS;
}

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // La puerta del panel aquí y no solo en el layout, que no protege la página
  // (CLAUDE.md, «La guarda va en CADA página»).
  const ctx = await requirePanel();
  const sp = await searchParams;

  const primer = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const estado = primer(sp.estado);
  const filtros: Filtros = {
    busqueda: primer(sp.q) || undefined,
    estado: esEstadoValido(estado) ? estado : undefined,
    ministerioId: primer(sp.ministerio) || undefined,
    pagina: Number(primer(sp.pagina)) || 1,
  };

  const fichaId = primer(sp.ficha);

  const [{ filas, total, pagina }, ministerios, resumen] = await Promise.all([
    listarMiembros(ctx, filtros),
    listarMinisterios(ctx),
    resumenMiembros(ctx),
  ]);

  const hayFiltros = Boolean(
    filtros.busqueda || filtros.estado || filtros.ministerioId,
  );
  const puedeCrear = esPastor(ctx) || puede(ctx, 'editar_miembros');

  // El recuento va como una sola cadena y no como JSX: la cabecera lo trunca
  // con puntos suspensivos cuando no cabe, y para eso tiene que ser texto.
  const subtitulo =
    (resumen.total === 0
      ? 'Todavía no hay nadie en el fichero'
      : `${resumen.total} ${resumen.total === 1 ? 'persona' : 'personas'} en la iglesia`) +
    (resumen.nuevosDelMes > 0
      ? ` · ${resumen.nuevosDelMes} se ${resumen.nuevosDelMes === 1 ? 'ha' : 'han'} sumado este mes`
      : '');

  return (
    <>
      <CabeceraPanel titulo="Miembros" subtitulo={subtitulo}>
        {/* El buscador solo se ve a partir de `md`. En móvil el que hay es el
            de la barra de filtros, que es donde queda a mano. */}
        <BuscadorMiembros />

        {puedeCrear && (
          <BotonEnlace href="/panel/miembros/nuevo" className="flex-none">
            <Plus strokeWidth={1.9} />
            Añadir miembro
          </BotonEnlace>
        )}
      </CabeceraPanel>

      {/* `gap-4` en vez de los 24 px que trae el contenedor: aquí lo que se
          separa son los filtros de SU tabla, y con más aire parecen dos bloques
          que no se hablan. */}
      <Contenedor className="gap-4">
        <FiltrosMiembros ministerios={ministerios} />

        <div className="overflow-hidden rounded-xl border border-border bg-surface-alt">
          {/* Cabecera de la tabla. Se oculta en móvil: siete columnas en 375px
              no caben, y ahí cada fila se apila como una tarjeta. */}
          <div className="hidden grid-cols-[2.1fr_1fr_1.5fr_1.1fr_.9fr] items-center gap-3.5 border-b border-border bg-surface px-5 py-3 md:grid">
            {['Persona', 'Estado', 'Ministerios', 'Teléfono', 'Alta'].map((c) => (
              <span key={c} className="t-micro">
                {c}
              </span>
            ))}
          </div>

          {filas.length === 0 ? (
            <EstadoVacio hayFiltros={hayFiltros} puedeCrear={puedeCrear} />
          ) : (
            filas.map((m) => {
              const estilo = ESTADOS[m.estado];
              const nombreCompleto = [m.nombre, m.apellidos]
                .filter(Boolean)
                .join(' ');

              return (
                /*
                 * EN EL MÓVIL, UNA FILA Y NO UNA TABLA APILADA (base común, 17-nov)
                 *
                 * Antes cada columna caía debajo de la anterior sin su etiqueta:
                 * un guion, otro guion, un teléfono y una fecha sueltos, y cada
                 * persona ocupaba media pantalla (inventario, M4). Ahora en el
                 * móvil la fila es la de todas las listas: cara, nombre, sus
                 * ministerios debajo y el estado a la derecha. El teléfono y el
                 * alta se quitan en vez de apilarse; están en la ficha, a un
                 * toque.
                 */
                <Link
                  key={m.id}
                  href={`?${new URLSearchParams({ ...limpiar(sp), ficha: m.id })}`}
                  scroll={false}
                  className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-4 py-3 text-foreground no-underline transition-colors duration-150 last:border-b-0 hover:bg-surface hover:text-foreground hover:no-underline md:grid-cols-[2.1fr_1fr_1.5fr_1.1fr_.9fr] md:gap-3.5 md:px-5 md:py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-[11px]">
                    <span
                      className={`flex size-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold ${estilo.avatar}`}
                    >
                      {iniciales(nombreCompleto)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-px">
                      <span className="truncate text-[15px] font-semibold">
                        {nombreCompleto}
                      </span>
                      <span className="hidden truncate text-[12.5px] text-muted-foreground md:block">
                        {m.email ?? 'Sin correo'}
                      </span>
                      <span className="truncate text-[12.5px] text-muted-foreground md:hidden">
                        {m.ministerios.length > 0
                          ? m.ministerios.map((min) => min.nombre).join(' · ')
                          : (m.telefono ?? m.email ?? 'Sin ministerio')}
                      </span>
                    </div>
                  </div>

                  <span className="flex">
                    <Insignia tono={estilo.tono}>{estilo.etiqueta}</Insignia>
                  </span>

                  <ChevronRight
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform duration-240 ease-hatril group-hover:translate-x-[3px] motion-reduce:transition-none md:hidden"
                    strokeWidth={1.8}
                  />

                  <div className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex">
                    {m.ministerios.length === 0 ? (
                      <span className="text-[14px] text-muted-foreground">—</span>
                    ) : (
                      <>
                        {m.ministerios.slice(0, 2).map((min) => (
                          <span
                            key={min.id}
                            className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground"
                          >
                            {min.nombre}
                          </span>
                        ))}
                        {m.ministerios.length > 2 && (
                          <span className="whitespace-nowrap rounded-full border border-border px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                            +{m.ministerios.length - 2}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <span className="hidden whitespace-nowrap text-[14px] md:block">
                    {m.telefono ?? '—'}
                  </span>

                  <span className="hidden whitespace-nowrap text-[14px] text-muted-foreground md:block">
                    {formatearFecha(m.fechaIngreso)}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        {total > POR_PAGINA && (
          <Paginacion total={total} pagina={pagina} porPagina={POR_PAGINA} />
        )}
      </Contenedor>

      {/* La ficha va fuera del contenedor a propósito: es una capa fija sobre
          toda la pantalla (`z-40` el fondo, `z-50` el panel), por encima de la
          cabecera pegajosa, que se queda en `z-30`. */}
      {fichaId && <FichaMiembroPanel ctx={ctx} miembroId={fichaId} params={sp} />}
    </>
  );
}

/** Quita `ficha` de los parámetros para poder recomponerlos sin duplicar. */
function limpiar(sp: Record<string, string | string[] | undefined>) {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'ficha') continue;
    const valor = Array.isArray(v) ? v[0] : v;
    if (valor) salida[k] = valor;
  }
  return salida;
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  // `T00:00` para que una fecha sin hora no se interprete en UTC y salga el día
  // anterior en husos al oeste de Greenwich, que es donde está Colombia.
  return new Date(`${fecha}T00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EstadoVacio({
  hayFiltros,
  puedeCrear,
}: {
  hayFiltros: boolean;
  puedeCrear: boolean;
}) {
  // Dos vacíos distintos. «No hay resultados» cuando el fichero está vacío deja
  // al pastor sin saber qué hacer justo el primer día, que es cuando más
  // ayuda necesita.
  return (
    <Vacio
      Icono={hayFiltros ? SearchX : UserPlus}
      titulo={hayFiltros ? 'Aquí no aparece nadie' : 'Empieza por tu congregación'}
      accion={
        hayFiltros ? (
          <BotonEnlace href="?" variant="outline">
            Quitar los filtros
          </BotonEnlace>
        ) : (
          puedeCrear && (
            // `outline` porque «Añadir miembro» ya está en la cabecera, en
            // naranja y llevando al mismo sitio. Dos botones idénticos
            // apuntando al mismo formulario hacen dudar de si son lo mismo.
            <BotonEnlace href="/panel/miembros/nuevo" variant="outline">
              <Plus strokeWidth={1.9} />
              Añadir la primera persona
            </BotonEnlace>
          )
        )
      }
    >
      {hayFiltros
        ? 'Con esos filtros no hay ninguna persona. Prueba a quitar alguno o a buscar por otro nombre.'
        : 'Añade a las personas que ya vienen a la iglesia. Puedes empezar por unas pocas e ir completando con el tiempo.'}
    </Vacio>
  );
}
