import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { listarCuentas, type FilaCuenta } from '@/lib/admin/consultas';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import { Aviso } from '@/components/aviso';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../_components/cabecera';
import { FilaEnlace, Insignia, plural } from '../_components/piezas';

export const metadata: Metadata = { title: 'Cuentas' };

const Params = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  error: z.string().max(300).optional().catch(undefined),
});

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Dónde está esta cuenta, en una línea: es lo que se busca al atender a alguien. */
function dondeEsta(c: FilaCuenta): string {
  if (c.membresias.length === 0) return 'Sin iglesia';
  return c.membresias
    .map((m) => {
      const papel =
        m.estado === 'activo'
          ? ETIQUETAS_ROLES[m.rol].titulo
          : m.estado === 'pendiente'
            ? 'solicitud pendiente'
            : m.estado;
      return `${m.iglesiaNombre} (${papel})`;
    })
    .join(', ');
}

export default async function AdminCuentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const { q, error } = Params.parse({
    q: primero(sp.q) || undefined,
    error: primero(sp.error) || undefined,
  });

  const { filas, total, incompleta } = await listarCuentas(q);

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

        <form method="get" className="flex gap-2 md:w-[400px]" role="search">
          <Input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Correo o nombre"
            aria-label="Buscar cuenta"
            className="h-9"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search strokeWidth={1.8} /> Buscar
          </Button>
        </form>

        {filas.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
            {q ? `Ninguna cuenta coincide con «${q}».` : 'Todavía no hay cuentas.'}
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {filas.map((c) => (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <FilaEnlace
                  href={`/admin/cuentas/${c.id}`}
                  titulo={c.email ?? c.nombre}
                  datos={[
                    dondeEsta(c),
                    c.ultimoAcceso
                      ? `entró ${haceCuanto(c.ultimoAcceso)}`
                      : 'nunca ha entrado',
                  ].join(' · ')}
                >
                  {c.esSuperAdmin && <Insignia tono="marca">Super admin</Insignia>}
                </FilaEnlace>
              </li>
            ))}
          </ul>
        )}
      </Contenedor>
    </>
  );
}
