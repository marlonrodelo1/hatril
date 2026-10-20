import Link from 'next/link';
import type { Metadata } from 'next';
import { Calculator, CircleCheck, Trash2 } from 'lucide-react';

import { requireFinanzas } from '@/lib/auth/guard-panel';
import { listarArqueos, type ArqueoListado } from '@/lib/finanzas/arqueos';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import { confirmarArqueo, descartarArqueo } from './actions';

export const metadata: Metadata = { title: 'Arqueo del culto' };

const CONFIRMACIONES: Record<string, string> = {
  contado: 'Guardado. Ahora tiene que confirmarlo otra persona que lleve la caja, o el pastor.',
  confirmado: 'Confirmado. Los ingresos ya están en el libro.',
  descartado: 'Descartado. No se había apuntado nada en el libro.',
};

/**
 * El arqueo del culto: quien cuenta no es quien confirma.
 *
 * Arriba lo que espera, porque es a lo que se viene: el tesorero, a ver si ya
 * se lo han confirmado; quien confirma, a confirmarlo. Debajo, los últimos
 * confirmados, para saber que el del domingo pasado está.
 *
 * Cada arqueo que espera es una tarjeta, no una fila: trae estado que pide
 * algo (guía visual, «Lista»). Su botón es carbón: la acción de la pantalla es
 * contar, y solo hay un naranja.
 */
export default async function ArqueosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireFinanzas();
  const { error, guardado } = await searchParams;
  const moneda = ctx.iglesia.moneda as Moneda;

  const { pendientes, confirmados } = await listarArqueos(ctx);
  const vacio = pendientes.length === 0 && confirmados.length === 0;

  return (
    <>
      <CabeceraPanel
        titulo="Arqueo del culto"
        subtitulo="Quien cuenta no es quien confirma"
        volver={{ href: '/panel/finanzas', texto: 'Finanzas' }}
      >
        <Link href="/panel/finanzas/arqueos/nuevo" className={buttonVariants()}>
          <Calculator strokeWidth={1.8} />
          Contar la ofrenda
        </Link>
      </CabeceraPanel>

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {!ctx.miembroId && (
          <Aviso>
            Para contar o confirmar un arqueo necesitas tener ficha en la
            iglesia: queda apuntado quién lo hizo.
          </Aviso>
        )}

        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-pretty text-label text-muted-foreground">
          Al acabar el culto, una persona cuenta el efectivo y apunta los totales
          de diezmos y de ofrendas. Otra que lleve la caja, o el pastor, lo
          confirma desde su cuenta, y entonces se apuntan los ingresos en el
          libro. Hasta entonces no suman. Es opcional: también puedes apuntar
          la ofrenda directamente en el libro.
        </p>

        {vacio ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">Todavía no hay ningún arqueo</h2>
            <p className="max-w-[56ch] text-body leading-relaxed text-muted-foreground">
              Cuando termine el próximo culto, cuenta el efectivo y apunta los
              dos totales. Se guardan sin sumar hasta que otra persona los
              confirme.
            </p>
            <Link
              href="/panel/finanzas/arqueos/nuevo"
              className={buttonVariants({ variant: 'outline' })}
            >
              <Calculator strokeWidth={1.8} />
              Contar la ofrenda
            </Link>
          </div>
        ) : (
          <>
            {pendientes.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="t-micro px-1">Esperan confirmación</h2>
                <ul className="flex flex-col gap-3">
                  {pendientes.map((a) => (
                    <li key={a.id}>
                      <TarjetaPendiente
                        arqueo={a}
                        moneda={moneda}
                        esMio={a.contadoPorId === ctx.miembroId}
                        puedeConfirmar={ctx.miembroId !== null}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {confirmados.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="t-micro px-1">Confirmados</h2>
                <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  {confirmados.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-body font-semibold first-letter:uppercase">
                          {formatearFechaLarga(a.fecha)}
                        </span>
                        <span className="text-pretty text-label text-muted-foreground">
                          Contó {a.contadoPor ?? 'alguien que ya no está'} ·
                          confirmó {a.confirmadoPor ?? 'alguien que ya no está'}
                        </span>
                      </span>
                      <span className="flex-none text-body font-semibold tabular-nums">
                        {formatearDinero(a.total, moneda)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Contenedor>
    </>
  );
}

function TarjetaPendiente({
  arqueo: a,
  moneda,
  esMio,
  puedeConfirmar,
}: {
  arqueo: ArqueoListado;
  moneda: Moneda;
  esMio: boolean;
  puedeConfirmar: boolean;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="t-subtitulo first-letter:uppercase">
            {formatearFechaLarga(a.fecha)}
          </h3>
          <span className="inline-flex h-[22px] items-center rounded-full bg-badge-warning-bg px-2.5 text-[12px] font-semibold text-badge-warning-fg">
            Sin confirmar
          </span>
        </div>
        <p className="text-label text-muted-foreground">
          {esMio ? 'Lo contaste tú' : `Lo contó ${a.contadoPor ?? 'alguien que ya no está'}`}
          {' · '}
          {a.fondoNombre} · {a.cajaNombre}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <Cifra rotulo="Diezmos" valor={formatearDinero(a.totalDiezmos, moneda)} />
        <Cifra rotulo="Ofrendas" valor={formatearDinero(a.totalOfrendas, moneda)} />
        <Cifra rotulo="Total" valor={formatearDinero(a.total, moneda)} />
      </dl>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {esMio ? (
          <p className="text-pretty text-label text-muted-foreground">
            Tiene que confirmarlo otra persona que lleve la caja, o el pastor,
            desde su cuenta. Si te has equivocado, descártalo y vuelve a contar.
          </p>
        ) : (
          <p className="text-pretty text-label text-muted-foreground">
            Confírmalo solo si has visto el dinero y te sale lo mismo. Al
            confirmar se apuntan los ingresos en el libro, y ya no se cambia.
          </p>
        )}

        <div className="flex flex-col items-start gap-2">
          {!esMio && puedeConfirmar && (
            <form action={confirmarArqueo}>
              <input type="hidden" name="id" value={a.id} />
              <Button type="submit" variant="secondary">
                <CircleCheck strokeWidth={1.8} />
                Confirmar el arqueo
              </Button>
            </form>
          )}

          {/*
           * Descartar borra, y en el móvil está a un dedo de «Confirmar». Un
           * paso más, sin JavaScript: el `<details>` abre la zona de borrar con
           * lo que pasa y el botón de verdad, en rojo. Lo contado se pierde y
           * habría que volver a contar un efectivo que quizá ya está en el
           * sobre del banco.
           */}
          <details className="group w-full">
            <summary
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-fit list-none text-muted-foreground [&::-webkit-details-marker]:hidden',
              )}
            >
              <Trash2 strokeWidth={1.8} />
              Descartar…
            </summary>
            <div className="mt-2 flex flex-col items-start gap-3 rounded-lg border border-danger-border bg-danger-soft p-4">
              <p className="text-pretty text-label">
                Se borra lo contado. El libro no cambia, porque aún no se había
                apuntado nada, pero habrá que volver a contar el efectivo.
              </p>
              <form action={descartarArqueo}>
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" variant="destructive">
                  <Trash2 strokeWidth={1.8} />
                  Sí, descartarlo
                </Button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function Cifra({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="t-micro truncate">{rotulo}</dt>
      <dd className="truncate text-body font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
