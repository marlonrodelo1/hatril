import Link from 'next/link';
import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import {
  FILTROS_SITUACION,
  listarIglesias,
  type FiltroSituacion,
} from '@/lib/admin/consultas';
import { Aviso } from '@/components/aviso';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../_components/cabecera';
import { FilaEnlace, Insignia, fecha, plural } from '../_components/piezas';

export const metadata: Metadata = { title: 'Iglesias' };

/*
 * Los parámetros de la URL, con Zod. Sin esto, basura en `?ver=` cae en un
 * índice que no existe; `ESTADO.md` lista tres pantallas del panel que dan 500
 * por lo mismo, y no hace falta una cuarta.
 */
const Params = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  ver: z
    .enum(Object.keys(FILTROS_SITUACION) as [FiltroSituacion, ...FiltroSituacion[]])
    .optional()
    .catch(undefined),
  error: z.string().max(300).optional().catch(undefined),
});

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function AdminIglesiasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const { q, ver, error } = Params.parse({
    q: primero(sp.q) || undefined,
    ver: primero(sp.ver) || undefined,
    error: primero(sp.error) || undefined,
  });

  const todas = await listarIglesias();

  const porGrupo = Object.fromEntries(
    (Object.keys(FILTROS_SITUACION) as FiltroSituacion[]).map((g) => [
      g,
      todas.filter((i) => i.situacion.grupo === g).length,
    ]),
  ) as Record<FiltroSituacion, number>;

  const texto = q?.toLowerCase();
  const filas = todas.filter(
    (i) =>
      (!ver || i.situacion.grupo === ver) &&
      (!texto ||
        i.nombre.toLowerCase().includes(texto) ||
        i.slug.includes(texto) ||
        (i.ciudad ?? '').toLowerCase().includes(texto)),
  );

  const enlace = (nuevoVer?: FiltroSituacion) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (nuevoVer) p.set('ver', nuevoVer);
    const s = p.toString();
    return s ? `/admin/iglesias?${s}` : '/admin/iglesias';
  };

  return (
    <>
      <CabeceraAdmin
        titulo="Iglesias"
        subtitulo={plural(todas.length, 'congregación en Hatril', 'congregaciones en Hatril')}
      />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {/* En una fila solo a partir de `xl`: con el menú lateral, a 800 px
            los cinco filtros y el buscador no caben juntos y el buscador se
            quedaba en un campo de tres letras. */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Segmentado de la guía visual: pista con borde, la elegida en
              `bg-accent`. Con desplazamiento lateral en el móvil, sin barra
              (como el carrusel de la web pública): cinco opciones no caben en
              375 px y partirlas en dos filas las desordena. */}
          <nav
            aria-label="Filtrar por situación"
            className="-mx-1 flex overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex flex-none gap-1 rounded-xl border border-border bg-surface p-1">
              <Filtro href={enlace()} activo={!ver}>
                Todas <span className="tabular-nums">{todas.length}</span>
              </Filtro>
              {(Object.keys(FILTROS_SITUACION) as FiltroSituacion[]).map((g) => (
                <Filtro key={g} href={enlace(g)} activo={ver === g}>
                  {FILTROS_SITUACION[g]}{' '}
                  <span className="tabular-nums">{porGrupo[g]}</span>
                </Filtro>
              ))}
            </div>
          </nav>

          <form method="get" className="flex gap-2 sm:w-[400px]" role="search">
            {ver && <input type="hidden" name="ver" value={ver} />}
            <Input
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Nombre, ciudad o slug"
              aria-label="Buscar iglesia"
              className="h-9"
            />
            <Button type="submit" variant="outline" size="sm">
              <Search strokeWidth={1.8} /> Buscar
            </Button>
          </form>
        </div>

        {filas.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
            {q
              ? `Ninguna iglesia coincide con «${q}».`
              : 'No hay ninguna iglesia en esta situación.'}
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {filas.map((i) => (
              <li key={i.id} className="border-b border-border last:border-b-0">
                <FilaEnlace
                  href={`/admin/iglesias/${i.id}`}
                  titulo={i.nombre}
                  datos={[
                    [i.ciudad, i.pais].filter(Boolean).join(', '),
                    plural(i.personas, 'persona', 'personas'),
                    plural(i.cuentas, 'cuenta', 'cuentas'),
                    `alta el ${fecha(i.createdAt)}`,
                  ].join(' · ')}
                >
                  <Insignia tono={i.situacion.tono}>{i.situacion.etiqueta}</Insignia>
                </FilaEnlace>
              </li>
            ))}
          </ul>
        )}
      </Contenedor>
    </>
  );
}

function Filtro({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={
        'flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-label font-semibold no-underline transition-colors hover:no-underline ' +
        (activo
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground')
      }
    >
      {children}
    </Link>
  );
}
