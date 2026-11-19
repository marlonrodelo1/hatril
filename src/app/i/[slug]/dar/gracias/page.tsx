import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Check, CircleAlert, Clock, Info, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { z } from 'zod';

import { NOMBRE_TIPO, formatearEuros } from '@/lib/donativos/calculo';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import {
  diaDelMes,
  graciasDe,
  type DonativoGracias,
  type LineaVista,
} from '../_lib/consultas';
import { OlvidarBorrador } from './_components/olvidar-borrador';
import { RefrescoPendiente } from './_components/refresco';

export const metadata: Metadata = {
  title: { absolute: 'Gracias' },
  // La pantalla de una persona concreta. Que no la indexe nadie.
  robots: { index: false, follow: false },
};

/**
 * Lo que se ve al volver de Stripe: `/i/[slug]/dar/gracias?d=<donativoId>`.
 *
 * LO QUE PUEDE ENSEÑAR UN ID EN UNA URL
 * -------------------------------------
 * Esta dirección acaba en el historial, en un ordenador compartido o en una
 * captura reenviada por WhatsApp, y quien la abre puede no ser quien pagó. Que
 * alguien da a una iglesia es dato protegido (art. 9 RGPD), así que se enseña
 * lo mínimo para que quien acaba de pagar se fíe, y nada que sirva a otro:
 *
 *   - el nombre de pila, no el completo;
 *   - el correo enmascarado (`a***@ejemplo.es`), solo para reconocer el suyo;
 *   - las líneas y el total, que es lo que acaba de elegir;
 *   - y solo durante 24 horas desde que abrió el pago.
 *
 * El donativo tiene que ser de la iglesia del slug. Si no existe, es de otra o
 * ha caducado, la pantalla dice LO MISMO en los tres casos: si dijera «este
 * pago no es de esta iglesia», la dirección serviría para averiguar ids.
 *
 * PUEDE LLEGAR ANTES QUE EL WEBHOOK
 * ---------------------------------
 * Stripe manda a la persona aquí y avisa al webhook a la vez, y suele ganar la
 * persona. Mientras siga `pendiente` no se dice «gracias, ya ha llegado»: se
 * dice que se está confirmando y la pantalla se refresca sola un minuto.
 *
 * `force-dynamic`: el estado cambia en segundos y la respuesta es de una
 * persona; una versión guardada se la daría a otra.
 */
export const dynamic = 'force-dynamic';

const idDonativo = z.uuid();

export default async function GraciasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ d?: string | string[] }>;
}) {
  const { slug } = await params;
  const { d } = await searchParams;

  // Un id mal formado ni llega a la base: Postgres fallaría al convertirlo.
  const parsed = idDonativo.safeParse(typeof d === 'string' ? d : undefined);
  const datos = await graciasDe(slug, parsed.success ? parsed.data : null);
  if (!datos) notFound();
  const { iglesia, donativo } = datos;

  // Sin web publicada, `/mi`: quien tiene cuenta vuelve a su iglesia, y quien
  // no, entra o se queda aquí. Es lo que pide el diseño aprobado.
  const volver = (
    <BotonEnlace
      href={iglesia.webPublica ? `/i/${iglesia.slug}` : '/mi'}
      variant="outline"
      className="w-full"
    >
      Volver a {iglesia.nombre}
    </BotonEnlace>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-4 py-10 sm:px-5">
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 sm:p-7">
          {!donativo ? (
            <Caducado iglesiaNombre={iglesia.nombre} />
          ) : donativo.estado === 'pagado' ? (
            <Pagado donativo={donativo} iglesiaNombre={iglesia.nombre} timezone={iglesia.timezone} />
          ) : donativo.estado === 'pendiente' ? (
            <Pendiente donativo={donativo} />
          ) : donativo.estado === 'fallido' ? (
            <Fallido slug={iglesia.slug} />
          ) : (
            <Devuelto iglesiaNombre={iglesia.nombre} />
          )}
          {volver}
        </div>
        {(donativo?.estado === 'pagado' || donativo?.estado === 'pendiente') && (
          <OlvidarBorrador slug={iglesia.slug} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Los estados
// ============================================================================

function Pagado({
  donativo,
  iglesiaNombre,
  timezone,
}: {
  donativo: DonativoGracias;
  iglesiaNombre: string;
  timezone: string;
}) {
  const que = queHasDado(donativo.lineas);
  const mensual = donativo.periodicidad === 'mensual';
  const dia = donativo.fecha
    ? Number(donativo.fecha.slice(8, 10))
    : diaDelMes(donativo.createdAt, timezone);

  return (
    <>
      <Encabezado
        icono={<Check className="size-[26px]" strokeWidth={1.8} aria-hidden />}
        tono="ok"
        titulo={donativo.nombre ? `Gracias, ${donativo.nombre}` : 'Gracias'}
      >
        {que.sujeto} ya {que.plural ? 'han' : 'ha'} llegado a {iglesiaNombre}
        {mensual ? `, y se ${que.plural ? 'repetirán' : 'repetirá'} ${cuandoSeRepite(dia)}.` : '.'}
      </Encabezado>

      <Resumen donativo={donativo} />

      <div className="flex flex-col gap-2 text-body text-pretty text-muted-foreground">
        <p>
          Te mandamos el recibo a{' '}
          <b className="font-semibold text-foreground">{donativo.correo}</b>.
        </p>
        {mensual && (
          <p>
            Para cambiar la cantidad o dejarlo, usa el enlace del recibo. No
            hace falta cuenta.
          </p>
        )}
      </div>
    </>
  );
}

function Pendiente({ donativo }: { donativo: DonativoGracias }) {
  return (
    <>
      <Encabezado
        icono={<Clock className="size-[26px]" strokeWidth={1.8} aria-hidden />}
        tono="neutro"
        titulo={donativo.nombre ? `Gracias, ${donativo.nombre}` : 'Gracias'}
      >
        Estamos confirmando el pago con tu banco…
      </Encabezado>

      <Resumen donativo={donativo} />

      <p className="text-body text-pretty text-muted-foreground">
        En cuanto se confirme te mandamos el recibo a{' '}
        <b className="font-semibold text-foreground">{donativo.correo}</b>. Esta
        pantalla se actualiza sola.
      </p>

      <RefrescoPendiente />
    </>
  );
}

function Fallido({ slug }: { slug: string }) {
  return (
    <>
      <Encabezado
        icono={<CircleAlert className="size-[26px]" strokeWidth={1.8} aria-hidden />}
        tono="peligro"
        titulo="No se ha cobrado nada"
      >
        El pago no se ha completado, así que no se te ha cobrado nada. Puedes
        volver a intentarlo.
      </Encabezado>
      {/* El único naranja de esta variante: lo que se viene a hacer aquí es
          volver a probar. Con `?cancelado=1`, la página de dar recupera lo que
          había rellenado (si sigue en esta pestaña) y repite que no se ha
          cobrado nada. */}
      <BotonEnlace href={`/i/${slug}/dar?cancelado=1`} className="w-full">
        Volver a intentarlo
      </BotonEnlace>
    </>
  );
}

function Devuelto({ iglesiaNombre }: { iglesiaNombre: string }) {
  return (
    <Encabezado
      icono={<Undo2 className="size-[26px]" strokeWidth={1.8} aria-hidden />}
      tono="neutro"
      titulo="Este pago se ha devuelto"
    >
      {iglesiaNombre} te ha devuelto este pago. El dinero vuelve a tu tarjeta en
      unos días.
    </Encabezado>
  );
}

/** No existe, es de otra iglesia o tiene más de un día: lo mismo para los tres. */
function Caducado({ iglesiaNombre }: { iglesiaNombre: string }) {
  return (
    <Encabezado
      icono={<Info className="size-[26px]" strokeWidth={1.8} aria-hidden />}
      tono="neutro"
      titulo="Aquí ya no hay nada que ver"
    >
      Lo que se da a {iglesiaNombre} solo se enseña en esta pantalla durante un
      día, para que no lo vea nadie más. Si has dado, el recibo está en tu
      correo.
    </Encabezado>
  );
}

// ============================================================================
// Piezas
// ============================================================================

const TONOS = {
  ok: 'bg-badge-success-bg text-badge-success-fg',
  neutro: 'border border-border bg-surface-alt text-support',
  peligro: 'border border-danger-border bg-danger-soft text-danger',
} as const;

function Encabezado({
  icono,
  tono,
  titulo,
  children,
}: {
  icono: ReactNode;
  tono: keyof typeof TONOS;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Salta una vez al llegar (`anim-salta`) y se queda quieta; con
          «reducir movimiento», ni eso. Solo el visto bueno: lo demás no es
          algo que celebrar. */}
      <span
        className={clsx(
          'flex size-14 items-center justify-center rounded-full',
          tono === 'ok' && 'anim-salta',
          TONOS[tono],
        )}
      >
        {icono}
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="t-titulo text-balance">{titulo}</h1>
        <p className="text-body text-pretty text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function Resumen({ donativo }: { donativo: DonativoGracias }) {
  const comision = Number(donativo.comisionCubierta);
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface px-4">
      {donativo.lineas.map((l, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-label"
        >
          <span className="min-w-0 text-pretty">
            {NOMBRE_TIPO[l.tipo]} · {l.fondo}
          </span>
          <span className="tabular-nums whitespace-nowrap">{formatearEuros(Number(l.importe))}</span>
        </div>
      ))}
      {comision > 0 && (
        <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-label">
          <span>Comisión de la tarjeta, cubierta</span>
          <span className="tabular-nums whitespace-nowrap">{formatearEuros(comision)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 py-3 text-body font-bold">
        <span>{donativo.periodicidad === 'mensual' ? 'Total, cada mes' : 'Total'}</span>
        <span className="tabular-nums whitespace-nowrap">{formatearEuros(Number(donativo.total))}</span>
      </div>
    </div>
  );
}

/** «Tu diezmo», «Tu ofrenda» o los dos, para que la frase concuerde. */
function queHasDado(lineas: LineaVista[]): { sujeto: string; plural: boolean } {
  const tipos = new Set(lineas.map((l) => l.tipo));
  if (tipos.size === 1 && tipos.has('diezmo')) return { sujeto: 'Tu diezmo', plural: false };
  if (tipos.size === 1 && tipos.has('ofrenda')) return { sujeto: 'Tu ofrenda', plural: false };
  return { sujeto: 'Tu diezmo y tu ofrenda', plural: true };
}

/**
 * El día en que se repite. Stripe cobra cada mes el mismo día que el primero,
 * y en los meses que no lo tienen (un 31 en abril) cobra el último: dicho así
 * para no prometer un 31 de febrero.
 */
function cuandoSeRepite(dia: number): string {
  return dia <= 28
    ? `el día ${dia} de cada mes`
    : `cada mes el día ${dia}, o el último si el mes es más corto`;
}
