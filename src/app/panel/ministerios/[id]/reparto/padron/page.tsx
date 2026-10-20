import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight, Search, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { listarPadron, sinVenirDesde, type EnElPadron } from '@/lib/reparto/consultas';
import { haceUnAnio } from '@/lib/reparto/plazo';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { SeccionesReparto } from '../_components/secciones';
import { CONFIRMACIONES } from '../constantes';
import { borrarSinVenir } from '../actions';

export const metadata: Metadata = { title: 'Padrón del reparto' };

/**
 * El padrón: los hogares que reciben, por número.
 *
 * El aviso de borrar a quien lleva un año sin venir va ARRIBA y con la cifra
 * delante, no escondido en un menú: es el plazo que se le prometió a cada
 * persona en la puerta, y no hay ninguna tarea automática que lo cumpla. Si el
 * botón no se ve, la promesa no se cumple.
 */
export default async function PadronPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; bajas?: string; error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { q, bajas, error, guardado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const busqueda = q?.trim().slice(0, 60) || undefined;
  const verBajas = bajas === '1';
  const corte = haceUnAnio(hoyEnLaIglesia(ctx.iglesia.timezone));

  const [lista, sinVenir] = await Promise.all([
    listarPadron(ctx, id, { busqueda, bajas: verBajas }),
    sinVenirDesde(ctx, id, corte),
  ]);

  const base = `/panel/ministerios/${id}/reparto/padron`;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Padrón del reparto: quién recibe, por número"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="reparto" />
        <SeccionesReparto ministerioId={id} activa="padron" />

        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {sinVenir.length > 0 && (
          <section className="flex flex-col gap-3 rounded-xl border border-danger-border bg-surface p-4 md:p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-[15.5px] font-semibold">
                {sinVenir.length === 1
                  ? '1 persona lleva más de un año sin venir'
                  : `${sinVenir.length} personas llevan más de un año sin venir`}
              </h2>
              <p className="text-[13.5px] leading-snug text-muted-foreground">
                Al apuntarlas se les dijo que se borrarían pasado un año. Se
                borran su nombre, su teléfono y su número; lo que se les entregó
                se queda contado en el historial, sin nombre.
              </p>
            </div>
            <form action={borrarSinVenir.bind(null, id)} className="flex flex-col gap-3">
              <input type="hidden" name="cuantos" value={sinVenir.length} />
              <label className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                <input type="checkbox" name="confirmar" required className="mt-1 flex-none" />
                <span>Entiendo que no se puede deshacer.</span>
              </label>
              <Button type="submit" variant="destructive" className="self-start">
                <Trash2 strokeWidth={1.9} />
                Borrar {sinVenir.length === 1 ? 'a esa persona' : `a esas ${sinVenir.length}`}
              </Button>
            </form>
          </section>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <form action={base} className="flex w-full max-w-[420px] items-center gap-2">
            {verBajas && <input type="hidden" name="bajas" value="1" />}
            <Input
              // Con `key`: tras una action la página no se remonta, y Base UI avisa
              // si el `defaultValue` de un campo cambia debajo de él.
              key={busqueda ?? ''}
              name="q"
              type="search"
              autoComplete="off"
              defaultValue={busqueda ?? ''}
              placeholder="Número o nombre"
              aria-label="Buscar en el padrón"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
              <Search strokeWidth={1.8} />
            </Button>
          </form>

          <Link
            href={verBajas ? base : `${base}?bajas=1`}
            className="px-1 text-[13.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {verBajas ? 'Volver al padrón' : 'Ver las bajas'}
          </Link>
        </div>

        {lista.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            {busqueda ? (
              <p className="text-[14.5px] text-muted-foreground">
                Nadie {verBajas ? 'de baja ' : ''}con «{busqueda}».
              </p>
            ) : verBajas ? (
              <p className="text-[14.5px] text-muted-foreground">No hay nadie de baja.</p>
            ) : (
              <>
                <h2 className="t-subtitulo">El padrón está vacío</h2>
                <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
                  Se llena en la puerta: el día del reparto, en «Hoy», cada
                  persona que viene por primera vez se apunta en un momento y
                  recibe su número.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {lista.map((p) => (
              <li key={p.id} className="border-b border-border last:border-b-0">
                <FilaPadron persona={p} href={`${base}/${p.id}`} />
              </li>
            ))}
          </ul>
        )}

        {lista.length > 0 && (
          <p className="px-1 text-[13px] text-muted-foreground">
            {lista.length === 1 ? '1 hogar' : `${lista.length} hogares`}
            {verBajas ? ' de baja' : ''}
            {busqueda ? ` con «${busqueda}»` : ''}, con{' '}
            {lista.reduce((s, p) => s + p.personasHogar, 0)} personas en total.
          </p>
        )}
      </Contenedor>
    </>
  );
}

function FilaPadron({ persona: p, href }: { persona: EnElPadron; href: string }) {
  const personas = p.personasHogar === 1 ? '1 persona' : `${p.personasHogar} personas`;
  const cuando = p.ultimaVez
    ? `última vez el ${formatearFechaLarga(p.ultimaVez)}`
    : 'todavía no ha venido';

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
    >
      <span className="min-w-[3ch] flex-none text-[18px] font-bold tabular-nums">
        {p.numero}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{p.nombre}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {personas} · {cuando}
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-disabled-text" strokeWidth={1.9} aria-hidden />
    </Link>
  );
}
