import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Plus,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

import { requireFinanzas } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import {
  estaActivado,
  resumen,
  saldosPorCaja,
  saldosPorFondo,
} from '@/lib/finanzas/consultas';
import { contarArqueosPendientes } from '@/lib/finanzas/arqueos';
import { mesEnLaIglesia } from '@/lib/fecha/hoy';
import { formatearDinero, formatearDineroConSigno } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { activarFinanzas } from './actions';

export const metadata: Metadata = { title: 'Finanzas' };

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mes?: string }>;
}) {
  // La guarda entera, también aquí: el layout no protege la página (CLAUDE.md).
  const ctx = await requireFinanzas();
  const { error, mes } = await searchParams;
  const moneda = ctx.iglesia.moneda as Moneda;

  if (!(await estaActivado(ctx))) {
    return <SinActivar error={error} />;
  }

  const { desde, hasta, etiqueta } = mesEnLaIglesia(ctx.iglesia.timezone, mes);

  const [delMes, porFondo, porCaja, arqueosPendientes] = await Promise.all([
    resumen(ctx, desde, hasta, etiqueta),
    saldosPorFondo(ctx),
    saldosPorCaja(ctx),
    contarArqueosPendientes(ctx),
  ]);

  return (
    <>
      <CabeceraPanel titulo="Finanzas" subtitulo={conInicialMayuscula(etiqueta)}>
        {/* Enlaces con forma de botón y no `<Button render={<Link/>}>`, que
            Base UI denuncia en consola (guía visual, «Botones»). */}
        <Link
          href="/panel/finanzas/movimientos/nuevo"
          className={buttonVariants({ className: 'flex-none' })}
        >
          <Plus strokeWidth={1.9} />
          Apuntar movimiento
        </Link>
      </CabeceraPanel>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {/* Lo que espera a otra persona, arriba: un arqueo sin confirmar no
            suma, y el saldo de abajo parecería que falta la ofrenda. */}
        {arqueosPendientes > 0 && (
          <Link
            href="/panel/finanzas/arqueos"
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-foreground no-underline transition-colors hover:bg-surface-alt hover:no-underline"
          >
            <TriangleAlert
              className="size-4 flex-none text-warning"
              strokeWidth={1.8}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-body font-semibold">
              {arqueosPendientes === 1
                ? 'Un arqueo espera confirmación'
                : `${arqueosPendientes} arqueos esperan confirmación`}
              <span className="block text-label font-normal text-muted-foreground">
                Hasta que otra persona lo confirme no suma en el saldo.
              </span>
            </span>
            <ChevronRight
              className="size-4 flex-none text-disabled-text"
              strokeWidth={1.8}
              aria-hidden
            />
          </Link>
        )}

        {/* Lo primero y sin filtros. Es el número por el que se abre esta
            pantalla, y si hay que buscarlo no se abre una segunda vez. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Tarjeta
            titulo="Entró este mes"
            valor={formatearDinero(delMes.entro, moneda)}
            Icono={ArrowDownLeft}
          />
          <Tarjeta
            titulo="Salió este mes"
            valor={formatearDinero(delMes.salio, moneda)}
            Icono={ArrowUpRight}
          />
          <Tarjeta
            titulo="Diferencia"
            valor={formatearDineroConSigno(delMes.neto, moneda)}
            Icono={Wallet}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Bloque
            titulo="Saldo por fondo"
            explicacion="De quién es el dinero. Un fondo designado no se puede gastar en otra cosa."
            filas={porFondo}
            moneda={moneda}
          />
          <Bloque
            titulo="Saldo por caja"
            explicacion="Dónde está el dinero ahora mismo."
            filas={porCaja}
            moneda={moneda}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/panel/finanzas/movimientos"
            className={buttonVariants({ variant: 'outline' })}
          >
            Ver el libro
          </Link>
          <Link
            href="/panel/finanzas/arqueos"
            className={buttonVariants({ variant: 'outline' })}
          >
            Arqueo del culto
          </Link>
          {/* `<a>` y no `Link`: es una descarga de un route handler, y
              `Link` intentaría precargarla. */}
          <a
            href={`/panel/finanzas/exportar?desde=${desde}&hasta=${hasta}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Descargar CSV del mes
          </a>
          <Link
            href={`/panel/finanzas/informe?mes=${desde.slice(0, 7)}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Informe del mes
          </Link>
          {/* Solo al pastor: crear un fondo es gobierno, y el sub-layout de
              ajustes rebota a quien no lo sea. Enseñar el enlace igualmente
              sería una sección que al pulsarla dice «no tienes acceso». */}
          {esPastor(ctx) && (
            <Link
              href="/panel/finanzas/ajustes"
              className={buttonVariants({ variant: 'ghost' })}
            >
              Fondos y cajas
            </Link>
          )}
        </div>
      </Contenedor>
    </>
  );
}

/**
 * «agosto de 2026» → «Agosto de 2026».
 *
 * Esto era un `first-letter:uppercase` en el `<p>` del subtítulo, pero el
 * subtítulo lo pinta ahora `CabeceraPanel` y no admite clases. Se hace sobre el
 * texto, y sigue sin poder ser el `capitalize` de Tailwind: capitaliza CADA
 * palabra, y `toLocaleDateString` en español devuelve «agosto de 2026», que
 * salía como «Agosto De 2026».
 */
function conInicialMayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Tarjeta({
  titulo,
  valor,
  Icono,
}: {
  titulo: string;
  valor: string;
  Icono: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icono className="size-[15px]" strokeWidth={1.8} />
        {titulo}
      </span>
      <span className="text-[24px] font-bold tracking-[-0.02em] tabular-nums">
        {valor}
      </span>
    </div>
  );
}

function Bloque({
  titulo,
  explicacion,
  filas,
  moneda,
}: {
  titulo: string;
  explicacion: string;
  filas: { id: string; nombre: string; saldo: string }[];
  moneda: Moneda;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-bold tracking-[-0.015em]">{titulo}</h2>
        <p className="text-[12.5px] text-muted-foreground">{explicacion}</p>
      </div>
      <ul className="flex flex-col">
        {filas.length === 0 ? (
          <li className="px-4 py-3 text-[13.5px] text-muted-foreground">
            Todavía no hay ninguno.
          </li>
        ) : (
          filas.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="truncate text-[14px] font-medium">{f.nombre}</span>
              <span className="flex-none text-[14px] font-semibold tabular-nums">
                {formatearDinero(f.saldo, moneda)}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

/**
 * Sin fondo ni caja, el formulario de alta no se puede enviar: los dos campos
 * son obligatorios en la base. Así que la primera pantalla es esta y no un
 * formulario que rebota sin decir por qué.
 */
function SinActivar({ error }: { error?: string }) {
  return (
    <>
      <CabeceraPanel titulo="Finanzas" />

      {/* Ancho de formulario y no de panel: aquí no hay ni tarjetas ni tabla,
          solo un párrafo y un botón. A 1600 px el texto quedaría en una línea
          de punta a punta de la pantalla. */}
      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
          <Wallet className="size-7 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">
            Lleva las cuentas de tu iglesia
          </h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Apunta la ofrenda de cada culto, los diezmos y los gastos. El saldo
            de cada fondo se calcula solo y puedes descargarlo para tu contador.
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Se guardan totales, no personas: Hatril no registra quién dio cuánto.
          </p>
          <form action={activarFinanzas}>
            <Button type="submit">Empezar</Button>
          </form>
          <p className="text-[12.5px] text-muted-foreground">
            Se crea un fondo «General» y una caja «Efectivo». Podrás añadir más.
          </p>
        </div>
      </Contenedor>
    </>
  );
}
