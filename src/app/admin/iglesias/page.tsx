import Link from 'next/link';
import type { Metadata } from 'next';
import { Church } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { FILTROS_SITUACION, type FiltroSituacion } from '@/lib/admin/consultas';
import { listarIglesiasDetalle } from '@/lib/admin/iglesias-detalle';
import { Aviso } from '@/components/aviso';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../_components/cabecera';
import { plural } from '../_components/piezas';
import { BuscadorIglesias } from '../_components/iglesias-buscador';
import { FiltrosIglesias } from '../_components/iglesias-filtros';
import { TablaIglesias, TarjetasIglesias } from '../_components/iglesias-tabla';
import {
  DIRECCION_INICIAL,
  ORDENES,
  ORDEN_POR_DEFECTO,
  coincide,
  ordenarIglesias,
  type Direccion,
  type Orden,
} from '../_components/iglesias-orden';

export const metadata: Metadata = { title: 'Iglesias' };

/*
 * Los parámetros de la URL, con Zod. Sin esto, basura en `?ver=` cae en un
 * índice que no existe; `ESTADO.md` lista tres pantallas del panel que dan 500
 * por lo mismo, y no hace falta una cuarta. Cada campo lleva su `.catch`: un
 * `?orden=` raro no debe tirar también el filtro y la búsqueda que venían
 * bien, se queda en el orden de siempre y ya está.
 */
const Params = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  ver: z
    .enum(Object.keys(FILTROS_SITUACION) as [FiltroSituacion, ...FiltroSituacion[]])
    .optional()
    .catch(undefined),
  orden: z.enum(ORDENES).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  error: z.string().max(300).optional().catch(undefined),
});

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const BASE = '/admin/iglesias';

/**
 * Iglesias del super admin: todas las congregaciones, filtradas por situación,
 * buscadas por nombre, ciudad o dirección y ordenadas por cualquier columna.
 *
 * Rediseño de la zona 4 (18-nov), aprobado tal cual. Con tres iglesias cabe en
 * cualquier sitio; con trescientas es la pantalla que más se va a usar, y por
 * eso es una tabla que se ordena y no una lista con todo en una línea gris.
 *
 * Todo el estado vive en la URL (`?ver=&q=&orden=&dir=`): la página es de
 * servidor, funciona sin JavaScript y un enlace a «las vencidas, de la más
 * grande a la más pequeña» se puede guardar.
 */
export default async function AdminIglesiasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const leidos = Params.safeParse({
    q: primero(sp.q) || undefined,
    ver: primero(sp.ver) || undefined,
    orden: primero(sp.orden) || undefined,
    dir: primero(sp.dir) || undefined,
    error: primero(sp.error) || undefined,
  });
  // Con un `.catch` en cada campo no debería fallar nunca; si lo hace, la
  // página entera sin filtros antes que un 500.
  const { q, ver, error, ...p } = leidos.success ? leidos.data : {};
  const orden: Orden = p.orden ?? ORDEN_POR_DEFECTO;
  const dir: Direccion = p.dir ?? DIRECCION_INICIAL[orden];

  const todas = await listarIglesiasDetalle();

  const porGrupo = Object.fromEntries(
    (Object.keys(FILTROS_SITUACION) as FiltroSituacion[]).map((g) => [
      g,
      todas.filter((i) => i.situacion.grupo === g).length,
    ]),
  ) as Record<FiltroSituacion, number>;

  const filas = ordenarIglesias(
    todas.filter((i) => (!ver || i.situacion.grupo === ver) && (!q || coincide(i, q))),
    orden,
    dir,
  );

  /*
   * Los enlaces, todos desde el mismo sitio para que ninguno pierda nada por el
   * camino: cambiar de filtro conserva la búsqueda y el orden; ordenar
   * conserva el filtro y la búsqueda. Lo que vale por defecto no se escribe en
   * la URL, para que «Todas, por alta» sea `/admin/iglesias` a secas.
   */
  const enlace = (cambios: {
    ver?: FiltroSituacion | null;
    orden?: Orden;
    dir?: Direccion;
  }) => {
    const v = cambios.ver === undefined ? ver : (cambios.ver ?? undefined);
    const o = cambios.orden ?? orden;
    const d = cambios.dir ?? (cambios.orden ? DIRECCION_INICIAL[o] : dir);
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (v) u.set('ver', v);
    if (o !== ORDEN_POR_DEFECTO || d !== DIRECCION_INICIAL[o]) {
      u.set('orden', o);
      u.set('dir', d);
    }
    const s = u.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  const enlacesOrden = Object.fromEntries(
    ORDENES.map((o) => [
      o,
      // La misma columna le da la vuelta; otra empieza por su sentido natural.
      o === orden
        ? enlace({ orden: o, dir: dir === 'asc' ? 'desc' : 'asc' })
        : enlace({ orden: o }),
    ]),
  ) as Record<Orden, string>;

  const filtros = [
    { id: 'todas', etiqueta: 'Todas', n: todas.length, href: enlace({ ver: null }) },
    ...(Object.keys(FILTROS_SITUACION) as FiltroSituacion[]).map((g) => ({
      id: g,
      etiqueta: FILTROS_SITUACION[g],
      n: porGrupo[g],
      href: enlace({ ver: g }),
    })),
  ];

  // Lo que el buscador tiene que conservar al buscar, en sus campos ocultos.
  const ocultos: Record<string, string> = {};
  if (ver) ocultos.ver = ver;
  if (orden !== ORDEN_POR_DEFECTO || dir !== DIRECCION_INICIAL[orden]) {
    ocultos.orden = orden;
    ocultos.dir = dir;
  }

  const filtrado = Boolean(ver || q);
  const subtitulo = filtrado
    ? `${plural(filas.length, 'congregación', 'congregaciones')} de ${todas.length} con este filtro`
    : plural(todas.length, 'congregación en Hatril', 'congregaciones en Hatril');

  return (
    <>
      <CabeceraAdmin titulo="Iglesias" subtitulo={subtitulo} />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {todas.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EstadoVacio Icono={Church} titulo="Todavía no hay ninguna iglesia">
              Se dan de alta solas, desde hatril.com. La primera que se registre
              aparecerá aquí, con su prueba en marcha.
            </EstadoVacio>
          </div>
        ) : (
          <>
            {/* En una fila desde `xl`: con el menú lateral, a 1024 los cinco
                filtros y el buscador no caben juntos y el buscador se quedaba
                en un campo de tres letras. */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <FiltrosIglesias items={filtros} activo={ver ?? 'todas'} />
              <BuscadorIglesias q={q ?? ''} ocultos={ocultos} base={BASE} />
            </div>

            {filas.length === 0 ? (
              // Un vacío de búsqueda es una línea (guía, «Estado vacío»), con
              // la salida al lado.
              <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
                {q
                  ? `Ninguna iglesia coincide con «${q}»${ver ? ' en este filtro' : ''}. `
                  : 'No hay ninguna iglesia en esta situación. '}
                <Link href={BASE} className="font-semibold">
                  Ver todas
                </Link>
              </p>
            ) : (
              <>
                <TablaIglesias filas={filas} orden={orden} dir={dir} enlaces={enlacesOrden} />
                <TarjetasIglesias filas={filas} />
              </>
            )}
          </>
        )}
      </Contenedor>
    </>
  );
}
