import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';

import { requireFinanzas } from '@/lib/auth/guard-panel';
import { opciones } from '@/lib/finanzas/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { crearArqueo } from '../actions';

export const metadata: Metadata = { title: 'Contar la ofrenda' };

/**
 * Contar al acabar el culto, de pie, con el móvil en una mano.
 *
 * Tres campos y el botón. El fondo y la caja tienen un defecto que acierta casi
 * siempre —General y la caja de efectivo— y van plegados en un `<details>`, que
 * funciona sin JavaScript y sin componente de cliente.
 *
 * NI DESGLOSE POR BILLETE NI OBSERVACIONES
 * ----------------------------------------
 * Dos totales y ya. Un campo libre aquí es donde acabaría «sobre de Fulano», y
 * eso es el diezmo con nombre que Hatril no guarda (`finanzas.ts`).
 */
export default async function NuevoArqueoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireFinanzas();
  const { error } = await searchParams;

  const { fondos, cajas } = await opciones(ctx);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  const fondoDefecto = fondos.find((f) => f.esGeneral) ?? fondos[0];
  const cajaDefecto = cajas.find((c) => c.tipo === 'efectivo') ?? cajas[0];

  return (
    <>
      <CabeceraPanel
        titulo="Contar la ofrenda"
        volver={{ href: '/panel/finanzas/arqueos', texto: 'Arqueo del culto' }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        {!ctx.miembroId ? (
          <Aviso>
            Para contar un arqueo necesitas tener ficha en la iglesia: queda
            apuntado quién lo contó. Pídele al pastor que te la cree.
          </Aviso>
        ) : !fondoDefecto || !cajaDefecto ? (
          // Sin fondo ni caja la base no tiene a dónde llevar el dinero. Es la
          // misma situación que la pantalla «Empezar» de Finanzas.
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">Antes, pon en marcha la caja</h2>
            <p className="max-w-[56ch] text-body leading-relaxed text-muted-foreground">
              Hace falta al menos un fondo y una caja para saber a dónde va lo
              contado. Se crean al empezar con Finanzas.
            </p>
            <Link href="/panel/finanzas" className={buttonVariants({ variant: 'outline' })}>
              Ir a Finanzas
            </Link>
          </div>
        ) : (
          <form action={crearArqueo} className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-col gap-1.5">
                <h2 className="t-subtitulo">Lo que se contó en efectivo</h2>
                <p className="text-pretty t-label text-muted-foreground">
                  Solo los totales. Lo que llegó por transferencia se apunta
                  aparte en el libro.
                </p>
              </div>

              <Campo etiqueta="Día del culto" nombre="fecha">
                <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
              </Campo>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo etiqueta="Diezmos" nombre="totalDiezmos" ayuda="Déjalo en blanco si no hubo.">
                  <Input
                    id="totalDiezmos"
                    name="totalDiezmos"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    className="tabular-nums"
                  />
                </Campo>
                <Campo etiqueta="Ofrendas" nombre="totalOfrendas" ayuda="Déjalo en blanco si no hubo.">
                  <Input
                    id="totalOfrendas"
                    name="totalOfrendas"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    className="tabular-nums"
                  />
                </Campo>
              </div>

              <details className="group rounded-lg border border-border">
                <summary className="flex h-[42px] cursor-pointer list-none items-center justify-between gap-2 px-3 text-label font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                  {/* Lo que viene por defecto, y dicho así: el resumen lo pinta
                      el servidor y no se entera si dentro se elige otro fondo.
                      «Va a General» sería falso en cuanto se cambiara. */}
                  <span className="truncate">
                    Fondo y caja · por defecto, {fondoDefecto.nombre} ·{' '}
                    {cajaDefecto.nombre}
                  </span>
                  <ChevronDown
                    className="size-4 flex-none transition-transform group-open:rotate-180"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                </summary>
                <div className="grid grid-cols-1 gap-4 px-3 pb-4 pt-1 sm:grid-cols-2">
                  <Campo etiqueta="Fondo" nombre="fondoId">
                    <select
                      id="fondoId"
                      name="fondoId"
                      defaultValue={fondoDefecto.id}
                      className="h-[42px] w-full rounded-lg border border-input bg-surface-alt px-3 text-foreground"
                    >
                      {fondos.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Caja" nombre="cajaId">
                    <select
                      id="cajaId"
                      name="cajaId"
                      defaultValue={cajaDefecto.id}
                      className="h-[42px] w-full rounded-lg border border-input bg-surface-alt px-3 text-foreground"
                    >
                      {cajas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
              </details>
            </section>

            <p className="px-1 text-pretty text-label text-muted-foreground">
              Se guarda sin sumar. Otra persona que lleve la caja, o el pastor,
              tiene que confirmarlo desde su cuenta.
            </p>

            {/* En columna en el móvil: el botón va a lo ancho, y en fila
                empujaba «Cancelar» fuera de la pantalla (474 px a 375). */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button type="submit" className="w-full sm:w-fit">
                Guardar para confirmar
              </Button>
              <Link
                href="/panel/finanzas/arqueos"
                className={buttonVariants({ variant: 'ghost' })}
              >
                Cancelar
              </Link>
            </div>
          </form>
        )}
      </Contenedor>
    </>
  );
}

/** El `Campo` de `miembros/_components/formulario.tsx`, como pide la guía. */
function Campo({
  etiqueta,
  nombre,
  ayuda,
  children,
}: {
  etiqueta: string;
  nombre: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nombre}>{etiqueta}</Label>
      {children}
      {ayuda && <p className="t-label text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
