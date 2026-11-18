import Link from 'next/link';
import type { Metadata } from 'next';
import { Search, X } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { listarCuentas, type FilaCuenta, type Tono } from '@/lib/admin/consultas';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import { Aviso } from '@/components/aviso';
import { AvatarPersona } from '@/components/avatar-persona';
import { Input } from '@/components/ui/input';
import { Insignia } from '@/components/ui/insignia';
import { Lista, Fila } from '@/components/ui/fila';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../_components/cabecera';
import { ZONA_ADMIN, plural } from '../_components/piezas';
import { Filtros } from '../_components/cuentas-filtros';

export const metadata: Metadata = { title: 'Cuentas' };

/*
 * Los filtros, cada uno con la pregunta que contesta al atender a alguien:
 * quién más administra esto, quién se registró y no está en ninguna iglesia,
 * y quién está esperando a que su iglesia le abra la puerta.
 */
const FILTROS = {
  admin: 'Super admin',
  sin: 'Sin iglesia',
  pendiente: 'Solicitud pendiente',
} as const;

type Filtro = keyof typeof FILTROS;

/*
 * Los parámetros de la URL, con Zod. Basura en `?ver=` cae en «Todas» en vez
 * de en un índice que no existe (`ESTADO.md` cuenta tres pantallas que daban
 * 500 por eso). `q` es también lo que manda el buscador Ctrl K del admin.
 */
const Params = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  ver: z
    .enum(Object.keys(FILTROS) as [Filtro, ...Filtro[]])
    .optional()
    .catch(undefined),
  error: z.string().max(300).optional().catch(undefined),
});

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Las membresías que cuentan: las activas y las solicitudes sin contestar,
 * por ese orden. Una rechazada o una baja no es «estar» en una iglesia, y
 * quien solo tiene esas sale en «Sin iglesia»: es a quien hay que explicarle
 * por qué no puede entrar.
 */
function vigentes(c: FilaCuenta) {
  return [
    ...c.membresias.filter((m) => m.estado === 'activo'),
    ...c.membresias.filter((m) => m.estado === 'pendiente'),
  ];
}

function cumple(c: FilaCuenta, filtro: Filtro): boolean {
  switch (filtro) {
    case 'admin':
      return c.esSuperAdmin;
    case 'sin':
      return vigentes(c).length === 0;
    case 'pendiente':
      return c.membresias.some((m) => m.estado === 'pendiente');
  }
}

/**
 * Su papel, en la insignia. El super admin va por delante de todo.
 *
 * `corto` es lo que cabe en el móvil: «Solicitud pendiente» se comía medio
 * correo a 375 px, y el correo es lo que se busca en esta lista.
 */
function papel(c: FilaCuenta): { texto: string; corto?: string; tono: Tono } | null {
  if (c.esSuperAdmin) return { texto: 'Super admin', tono: 'marca' };
  const [m] = vigentes(c);
  if (!m) return null;
  return m.estado === 'activo'
    ? { texto: ETIQUETAS_ROLES[m.rol].titulo, tono: 'neutro' }
    : { texto: 'Solicitud pendiente', corto: 'Pendiente', tono: 'aviso' };
}

/**
 * «entró hace 18 h», «entró ayer», «entró el 30 de octubre».
 *
 * `haceCuanto` pasa a la fecha a partir de una semana, sin «el» delante y en
 * la hora del servidor (UTC). Esa fecha se escribe aquí, en la zona de la
 * administración, como el resto de fechas de `/admin`.
 */
function ultimaVez(d: Date | null, ahora: Date): string {
  if (!d) return 'nunca ha entrado';
  const relativa = haceCuanto(d);
  if (!/^\d/.test(relativa)) return `entró ${relativa}`;

  const anio = (x: Date) =>
    x.toLocaleDateString('es-ES', { year: 'numeric', timeZone: ZONA_ADMIN });
  return `entró el ${d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    ...(anio(d) !== anio(ahora) && { year: 'numeric' }),
    timeZone: ZONA_ADMIN,
  })}`;
}

/** La misma pantalla con otro filtro, sin perder lo que se está buscando. */
function enlace(ver: Filtro | undefined, q: string | undefined): string {
  const p = new URLSearchParams();
  if (ver) p.set('ver', ver);
  if (q) p.set('q', q);
  const s = p.toString();
  return s ? `/admin/cuentas?${s}` : '/admin/cuentas';
}

export default async function AdminCuentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const leidos = Params.safeParse({
    q: primero(sp.q) || undefined,
    ver: primero(sp.ver) || undefined,
    error: primero(sp.error) || undefined,
  });
  const { q, ver, error } = leidos.success ? leidos.data : {};

  const { filas, total, incompleta } = await listarCuentas(q);

  // Los números cuentan dentro de la búsqueda: con «betania» escrito, «Sin
  // iglesia 0» dice algo; el total de la plataforma ya está en la cabecera.
  const cuantas = Object.fromEntries(
    (Object.keys(FILTROS) as Filtro[]).map((f) => [
      f,
      filas.filter((c) => cumple(c, f)).length,
    ]),
  ) as Record<Filtro, number>;

  const visibles = ver ? filas.filter((c) => cumple(c, ver)) : filas;
  const ahora = new Date();

  return (
    <>
      <CabeceraAdmin
        titulo="Cuentas"
        subtitulo={plural(total, 'cuenta en Hatril', 'cuentas en Hatril')}
      />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {incompleta && (
          <Aviso>
            Hay más de mil cuentas y aquí solo se leen las mil primeras. El
            buscador no encontrará a las demás hasta que esta pantalla pagine.
          </Aviso>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Filtros
            etiqueta="Filtrar las cuentas"
            opciones={[
              { href: enlace(undefined, q), texto: 'Todas', n: filas.length, activa: !ver },
              ...(Object.keys(FILTROS) as Filtro[]).map((f) => ({
                href: enlace(f, q),
                texto: FILTROS[f],
                n: cuantas[f],
                activa: ver === f,
              })),
            ]}
          />

          {/* GET a esta misma página: la búsqueda queda en la URL y el filtro
              elegido viaja oculto para no perderse al buscar. */}
          <form method="get" role="search" className="relative w-full md:w-[280px] md:flex-none">
            {ver && <input type="hidden" name="ver" value={ver} />}
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.8}
              aria-hidden
            />
            {/* `key` con la búsqueda: al ir de `/admin/cuentas` a `?q=x` (o al
                borrarla con la X) sin recargar, React conserva el campo y Base
                UI avisa por consola de que cambia el `defaultValue` de un campo
                no controlado. Con la clave cambia de campo, y además el texto
                que se ve es siempre el de la URL. */}
            <Input
              key={q ?? ''}
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Correo o nombre"
              aria-label="Buscar cuenta por correo o nombre"
              className="h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {q && (
              <Link
                href={enlace(ver, undefined)}
                aria-label="Borrar la búsqueda"
                className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground no-underline hover:bg-surface-active hover:text-foreground hover:no-underline"
              >
                <X className="size-4" strokeWidth={1.8} aria-hidden />
              </Link>
            )}
          </form>
        </div>

        {visibles.length === 0 ? (
          // Un vacío de búsqueda o de filtro es una línea (guía, «Estado
          // vacío»): la salida es el propio filtro de arriba.
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
            {q && ver
              ? `Ninguna cuenta de «${FILTROS[ver]}» coincide con «${q}».`
              : q
                ? `Ninguna cuenta coincide con «${q}».`
                : ver
                  ? `Ninguna cuenta en «${FILTROS[ver]}».`
                  : 'Todavía no hay cuentas.'}
          </p>
        ) : (
          <Lista>
            {visibles.map((c) => {
              const p = papel(c);
              const donde = vigentes(c).map((m) => m.iglesiaNombre);
              return (
                <Fila
                  key={c.id}
                  href={`/admin/cuentas/${c.id}`}
                  // En el móvil la cara sobra y el correo no: se quita la
                  // cara (guía, «Lista»: quitar en vez de apilar).
                  inicio={
                    <span className="hidden flex-none sm:block">
                      <AvatarPersona nombre={c.nombre} tamano="sm" />
                    </span>
                  }
                  titulo={c.email ?? c.nombre}
                  detalle={[
                    donde.length ? donde.join(', ') : 'Sin iglesia',
                    ultimaVez(c.ultimoAcceso, ahora),
                  ].join(' · ')}
                  fin={
                    p && (
                      <Insignia tono={p.tono}>
                        {p.corto ? (
                          <>
                            <span className="sm:hidden">{p.corto}</span>
                            <span className="hidden sm:inline">{p.texto}</span>
                          </>
                        ) : (
                          p.texto
                        )}
                      </Insignia>
                    )
                  }
                />
              );
            })}
          </Lista>
        )}
      </Contenedor>
    </>
  );
}
