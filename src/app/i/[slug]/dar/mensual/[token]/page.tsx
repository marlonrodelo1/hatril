import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Info } from 'lucide-react';

import { NOMBRE_TIPO, formatearEuros } from '@/lib/donativos/calculo';
import { estadoDeDar } from '@/lib/donativos/consultas';
import { Aviso } from '@/components/aviso';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Insignia, type TonoInsignia } from '@/components/ui/insignia';
import { CabeceraDar } from '../../_components/cabecera-dar';
import { diaDelMes, mensualPorToken, type MensualVista } from '../../_lib/consultas';
import { dejarMensual } from './actions';
import { VentanaDejar } from './_components/ventana-dejar';

export const metadata: Metadata = {
  title: { absolute: 'Tu ofrenda de cada mes' },
  robots: { index: false, follow: false },
  // El token de la dirección ES la llave. Que no viaje en el `Referer` a
  // ninguna parte, tampoco al pulsar un enlace de esta misma página.
  referrer: 'no-referrer',
};

/**
 * El enlace del recibo para cambiar o dejar lo de cada mes, sin cuenta:
 * `/i/[slug]/dar/mensual/[token]`.
 *
 * El token es un HMAC del id del donativo mensual (`recibo.ts`); la base solo
 * guarda su sha-256. Se busca por ese hash Y por la iglesia del slug: un token
 * bueno con el slug de otra iglesia no enseña nada. Y un enlace que no sirve
 * —cortado al copiarlo, de otra iglesia, inventado— dice siempre lo mismo.
 *
 * Lo que se enseña es lo de quien recibió el recibo: lo que da, a qué, y su
 * estado. Ni el correo ni el apellido: el enlace se puede reenviar.
 *
 * CAMBIAR LA CANTIDAD ES DEJARLA Y EMPEZAR OTRA
 * ---------------------------------------------
 * Las líneas y sus fondos son de Hatril, no de Stripe; cambiar la suscripción
 * en Stripe sin cambiar las líneas descuadraría lo que se apunta en Finanzas.
 * Así que se explica cómo hacerlo con lo que ya hay: dejar esta y crear otra.
 */
export const dynamic = 'force-dynamic';

const ESTADOS: Record<MensualVista['estado'], { texto: string; tono: TonoInsignia }> = {
  activo: { texto: 'Activa', tono: 'exito' },
  impagado: { texto: 'Último cobro sin pasar', tono: 'aviso' },
  cancelado: { texto: 'Dejada', tono: 'neutro' },
};

export default async function MensualPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ hecho?: string | string[]; error?: string | string[] }>;
}) {
  const { slug, token } = await params;
  const consulta = await searchParams;
  const hecho = consulta.hecho === '1';
  const error = typeof consulta.error === 'string' ? consulta.error : null;

  const datos = await mensualPorToken(slug, token);
  if (!datos) notFound();
  const { iglesia, mensual } = datos;

  const cabecera = <CabeceraDar titulo={`Cada mes a ${iglesia.nombre}`} iglesia={iglesia} />;

  if (!mensual) {
    return (
      <Marco>
        {cabecera}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <span className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-alt text-support">
            <Info className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <h2 className="t-subtitulo">Este enlace no sirve</h2>
          <p className="text-body text-pretty text-muted-foreground">
            Puede que se haya cortado al copiarlo. Usa el enlace del último
            recibo que te llegó por correo, o escribe a la iglesia.
          </p>
        </div>
      </Marco>
    );
  }

  const { conTarjeta } = await estadoDeDar(iglesia.id);
  const dejada = mensual.estado === 'cancelado';
  const estado = ESTADOS[mensual.estado];
  const comision = Number(mensual.comisionCubierta);
  const total = formatearEuros(Number(mensual.total));
  const dia = diaDelMes(mensual.createdAt, iglesia.timezone);

  return (
    <Marco>
      {cabecera}

      {hecho && dejada && (
        <Aviso tipo="ok">Hecho. No se te cobrará nada más.</Aviso>
      )}
      {error && <Aviso>{error}</Aviso>}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-micro">
            {mensual.nombre ? `Lo que das cada mes, ${mensual.nombre}` : 'Lo que das cada mes'}
          </h2>
          <Insignia tono={estado.tono} punto>
            {estado.texto}
          </Insignia>
        </div>

        <div className="flex flex-col rounded-lg border border-border px-4">
          {mensual.lineas.map((l, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-label"
            >
              <span className="min-w-0 text-pretty">
                {NOMBRE_TIPO[l.tipo]} · {l.fondo}
              </span>
              <span className="tabular-nums whitespace-nowrap">
                {formatearEuros(Number(l.importe))}
              </span>
            </div>
          ))}
          {comision > 0 && (
            <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-label">
              <span>Comisión de la tarjeta, cubierta</span>
              <span className="tabular-nums whitespace-nowrap">{formatearEuros(comision)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 py-3 text-body font-bold">
            <span>Total, cada mes</span>
            <span className="tabular-nums whitespace-nowrap">{total}</span>
          </div>
        </div>

        <p className="text-label text-pretty text-muted-foreground">
          {mensual.estado === 'activo'
            ? `Se cobra en tu tarjeta ${dia <= 28 ? `el día ${dia} de cada mes` : `cada mes el día ${dia}, o el último si el mes es más corto`}, y te llega un recibo cada vez.`
            : mensual.estado === 'impagado'
              ? 'El último cobro no ha pasado. Stripe lo volverá a intentar en los próximos días; si la tarjeta ya no vale, deja esta y empieza otra con la nueva.'
              : 'Ya no se cobra nada. Lo que diste se queda como estaba.'}
        </p>
      </section>

      {/* Sin tarjeta no hay página de dar con formulario a la que mandar: se
          dice, en vez de enseñar un enlace que lleva a otra cosa. */}
      {(conTarjeta || !dejada) && (
        <section className="flex flex-col gap-2">
          <h2 className="t-subtitulo">
            {dejada ? 'Volver a dar cada mes' : 'Cambiar la cantidad'}
          </h2>
          <p className="text-body text-pretty text-muted-foreground">
            {dejada
              ? `Puedes empezar otra cuando quieras desde la página de dar de ${iglesia.nombre}.`
              : conTarjeta
                ? 'Para cambiar la cantidad, el destino o la tarjeta, deja esta y empieza otra desde la página de dar. Así no se cobran las dos.'
                : `Ahora mismo ${iglesia.nombre} no recibe ofrendas nuevas con tarjeta. Para cambiar esta, déjala y pregunta a la iglesia cómo dar.`}
          </p>
          {conTarjeta && (
            <BotonEnlace href={`/i/${iglesia.slug}/dar`} variant="outline" className="mt-1 self-start">
              Ir a la página de dar
            </BotonEnlace>
          )}
        </section>
      )}

      {!dejada && (
        <section className="flex flex-col gap-2">
          <h2 className="t-subtitulo">Dejarlo</h2>
          <p className="text-body text-pretty text-muted-foreground">
            No se te cobra nada más desde hoy. No hace falta cuenta ni hablar con
            nadie.
          </p>
          <div className="mt-1 flex">
            <VentanaDejar
              accion={dejarMensual.bind(null, iglesia.slug, token)}
              iglesiaNombre={iglesia.nombre}
              total={total}
            />
          </div>
        </section>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 pt-5 pb-10 sm:px-5 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
