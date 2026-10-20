import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga, hoyEnLaIglesia, mesEnLaIglesia } from '@/lib/fecha/hoy';
import { historialDelMes } from '@/lib/reparto/consultas';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { SeccionesReparto } from '../_components/secciones';

export const metadata: Metadata = { title: 'Historial del reparto' };

/**
 * Lo que se repartió, mes a mes: una fila por día y el total arriba.
 *
 * El total es lo que piden el pastor y el banco de alimentos —cuántas
 * entregas, a cuántos hogares, cuántas personas—, así que va primero y en
 * grande. Sin nombres: el historial dice cuánto, no a quién.
 *
 * Los hogares y las personas solo cuentan a quien está en el padrón. Quien se
 * llevó la bolsa sin apuntarse cuenta como entrega y no como hogar: sin saber
 * quién es, no se sabe si ya vino el domingo anterior.
 */
export default async function HistorialRepartoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { mes } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const esteMes = hoyEnLaIglesia(ctx.iglesia.timezone).slice(0, 7);
  const elegido = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : esteMes;
  const periodo = mesEnLaIglesia(ctx.iglesia.timezone, elegido);
  const historial = await historialDelMes(ctx, id, periodo.desde, periodo.hasta);

  const base = `/panel/ministerios/${id}/reparto/historial`;
  const anterior = moverMes(elegido, -1);
  const siguiente = moverMes(elegido, 1);
  const t = historial.total;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Historial del reparto"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="reparto" />
        <SeccionesReparto ministerioId={id} activa="historial" />

        <nav aria-label="Mes" className="flex items-center justify-between gap-2 sm:justify-start">
          <Link
            href={`${base}?mes=${anterior}`}
            aria-label="Mes anterior"
            className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground no-underline hover:bg-surface-alt"
          >
            <ChevronLeft className="size-4" strokeWidth={1.9} aria-hidden />
          </Link>
          <span className="min-w-[11ch] text-center text-[16px] font-semibold first-letter:uppercase">
            {periodo.etiqueta}
          </span>
          {elegido < esteMes ? (
            <Link
              href={`${base}?mes=${siguiente}`}
              aria-label="Mes siguiente"
              className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground no-underline hover:bg-surface-alt"
            >
              <ChevronRight className="size-4" strokeWidth={1.9} aria-hidden />
            </Link>
          ) : (
            <span className="size-10" aria-hidden />
          )}
        </nav>

        <section aria-label="Total del mes" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cifra etiqueta="Repartos" valor={t.repartos} />
          <Cifra
            etiqueta="Entregas"
            valor={t.entregas}
            nota={t.sinInscribir > 0 ? `${t.sinInscribir} sin apuntar` : undefined}
          />
          <Cifra etiqueta="Hogares distintos" valor={t.hogares} />
          <Cifra etiqueta="Personas en ellos" valor={t.personas} />
        </section>

        {historial.dias.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-4 text-[14.5px] text-muted-foreground">
            Este mes no hay ningún reparto apuntado. Cada reparto aparece aquí
            cuando se empieza en «Hoy».
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {historial.dias.map((d) => (
              <li key={d.jornadaId} className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 md:px-5">
                <span className="text-[15px] font-semibold first-letter:uppercase">
                  {formatearFechaLarga(d.fecha)}
                </span>
                <span className="text-[13.5px] leading-snug text-muted-foreground">
                  {d.vinieron === 1 ? '1 vino' : `${d.vinieron} vinieron`} ·{' '}
                  {d.entregados === 1 ? '1 entrega' : `${d.entregados} entregas`}
                  {d.sinInscribir > 0 ? ` (${d.sinInscribir} sin apuntar)` : ''} ·{' '}
                  {d.personas === 1 ? '1 persona' : `${d.personas} personas`} en los hogares
                  apuntados
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
          «Hogares distintos» cuenta una vez a cada hogar del padrón aunque
          viniera varias veces en el mes, y «personas en ellos» suma cuántos
          viven en esos hogares. Quien se la llevó sin apuntarse, o a quien se
          borró después del padrón, cuenta como entrega y no como hogar: sin
          nombre no se sabe si ya se había contado.
        </p>
      </Contenedor>
    </>
  );
}

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="t-micro">{etiqueta}</span>
      <span className="text-[28px] font-bold leading-none tracking-[-0.025em] tabular-nums">
        {valor}
      </span>
      {nota && <span className="text-[12.5px] text-muted-foreground">{nota}</span>}
    </div>
  );
}

/** `2026-10` más o menos un mes, sin `Date` para no pelearse con husos. */
function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const total = a! * 12 + (m! - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
