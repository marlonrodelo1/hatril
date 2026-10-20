import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';

import { formatearFechaLarga, hoyEnLaIglesia, mesEnLaIglesia } from '@/lib/fecha/hoy';
import { historialDelMes } from '@/lib/reparto/consultas';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { SeccionesReparto } from '../_components/secciones';
import { mesValido, moverMes } from './mes';

import { requireReparto } from '../guarda';

export const metadata: Metadata = { title: 'Historial del reparto' };

/**
 * Lo que se repartió, mes a mes: el total arriba y una fila por día.
 *
 * El total es lo que piden el pastor y el banco de alimentos —cuántas
 * entregas, a cuántos hogares, cuántas personas, cuántos nuevos—, así que va
 * primero. Sin nombres: el historial dice cuánto, no a quién. Para llevarlo en
 * papel está el informe del mes, con las mismas cifras de `historialDelMes`.
 *
 * Los hogares y las personas solo cuentan a quien está en el padrón. Quien se
 * llevó la bolsa sin inscribirse cuenta como entrega y no como hogar: sin saber
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
  // La puerta en la página y no solo en el layout: ver `guarda.ts`.
  const { ctx, ministerio } = await requireReparto(id);
  const { mes } = await searchParams;


  const esteMes = hoyEnLaIglesia(ctx.iglesia.timezone).slice(0, 7);
  const elegido = mesValido(mes) ?? esteMes;
  const periodo = mesEnLaIglesia(ctx.iglesia.timezone, elegido);
  const historial = await historialDelMes(ctx, id, periodo.desde, periodo.hasta);

  const base = `/panel/ministerios/${id}/reparto`;
  const t = historial.total;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Lo que se ha repartido, mes a mes"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <div className="flex flex-col gap-3">
          <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="reparto" />
          <SeccionesReparto ministerioId={id} activa="historial" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Mes" className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mes anterior"
              render={<Link href={`${base}/historial?mes=${moverMes(elegido, -1)}`} />}
            >
              <ChevronLeft strokeWidth={1.9} />
            </Button>
            <h2 className="t-subtitulo min-w-[11ch] text-center first-letter:uppercase">
              {periodo.etiqueta}
            </h2>
            {elegido < esteMes ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Mes siguiente"
                render={<Link href={`${base}/historial?mes=${moverMes(elegido, 1)}`} />}
              >
                <ChevronRight strokeWidth={1.9} />
              </Button>
            ) : (
              <Button variant="outline" size="icon" disabled aria-label="Mes siguiente">
                <ChevronRight strokeWidth={1.9} />
              </Button>
            )}
          </nav>

          {historial.dias.length > 0 && (
            <Button
              variant="outline"
              render={<Link href={`${base}/informe?mes=${elegido}`} />}
            >
              <Printer strokeWidth={1.8} />
              Informe del mes
            </Button>
          )}
        </div>

        {historial.dias.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">
              {elegido === esteMes
                ? 'Este mes todavía no hay ningún reparto'
                : 'Ese mes no hubo reparto'}
            </h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Cada reparto aparece aquí con sus cifras en cuanto se empieza en
              «Hoy».
            </p>
            <Button variant="outline" render={<Link href={base} />}>
              Ir a Hoy
            </Button>
          </div>
        ) : (
          <>
            <section aria-label="Total del mes" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Cifra etiqueta="Repartos" valor={t.repartos} />
              <Cifra
                etiqueta="Entregas"
                valor={t.entregas}
                nota={t.sinInscribir > 0 ? `${t.sinInscribir} sin inscribir` : undefined}
              />
              <Cifra
                etiqueta="Hogares atendidos"
                valor={t.hogares}
                nota={t.nuevos > 0 ? `${t.nuevos} ${t.nuevos === 1 ? 'nuevo' : 'nuevos'}` : undefined}
              />
              <Cifra etiqueta="Personas alcanzadas" valor={t.personas} />
            </section>

            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {historial.dias.map((d) => (
                <li
                  key={d.jornadaId}
                  className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
                >
                  <span className="text-[15px] font-semibold first-letter:uppercase">
                    {formatearFechaLarga(d.fecha)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {d.vinieron === 1 ? '1 vino' : `${d.vinieron} vinieron`} ·{' '}
                    {d.entregados === 1 ? '1 entrega' : `${d.entregados} entregas`}
                    {d.sinInscribir > 0 ? ` (${d.sinInscribir} sin inscribir)` : ''}
                    {d.nuevos > 0 ? ` · ${d.nuevos} ${d.nuevos === 1 ? 'nuevo' : 'nuevos'}` : ''} ·{' '}
                    {d.personas === 1 ? '1 persona' : `${d.personas} personas`}
                  </span>
                </li>
              ))}
            </ul>

            <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
              «Hogares atendidos» cuenta cada hogar una vez al mes aunque venga
              varias; «nuevos» son los que recibieron por primera vez. Quien se lo
              lleva sin inscribirse, o a quien se borró, cuenta como entrega y no
              como hogar.
            </p>
          </>
        )}
      </Contenedor>
    </>
  );
}

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 md:px-5">
      <span className="t-micro">{etiqueta}</span>
      <span className="text-[24px] font-bold leading-none tracking-[-0.025em] tabular-nums">
        {valor}
      </span>
      {nota && <span className="text-[13px] text-muted-foreground">{nota}</span>}
    </div>
  );
}
