import Link from 'next/link';
import type { Metadata } from 'next';

import { formatearFechaLarga, hoyEnLaIglesia, mesEnLaIglesia } from '@/lib/fecha/hoy';
import { historialDelMes } from '@/lib/reparto/consultas';
import { BotonImprimir } from '@/components/boton-imprimir';
import { mesValido } from '../historial/mes';

import { requireReparto } from '../guarda';

export const metadata: Metadata = {
  title: 'Informe del reparto',
  // Cifras de la ayuda que reparte una congregación: no lo indexa nadie,
  // aunque el guard ya lo proteja.
  robots: { index: false, follow: false },
};

/**
 * El informe del mes para el banco de alimentos o la asamblea, imprimible.
 *
 * El del libro de caja (`/panel/finanzas/informe`) hecho para el reparto: sin
 * PDF en el servidor —«Imprimir → Guardar como PDF» está en todos los
 * navegadores— y con las mismas cifras que el historial, porque salen de la
 * misma función. Lo abren el pastor y quien lidera este equipo: `requireReparto`,
 * en la propia página y no solo en el layout (`guarda.ts` cuenta por qué).
 *
 * SIN NOMBRES, Y TAMPOCO HACE FALTA
 * ---------------------------------
 * Lo que pide un banco de alimentos es cuánto: repartos, entregas, hogares,
 * personas, nuevos. Quién recibió no sale de la iglesia, y si un programa lo
 * exige con documento, se queda en papel en la iglesia: el padrón de Hatril
 * no tiene base jurídica para eso.
 *
 * Una cifra agregada no es inocua del todo en un reparto pequeño —«dos
 * entregas el miércoles» puede señalar a alguien—, así que el informe va con
 * el mismo guard que el padrón y no se comparte por enlace.
 *
 * Sin CSV de momento: un route handler no pasa por el `layout.tsx`, y hacerlo
 * bien pide una guarda de API por ministerio que no existe y decidir si una
 * iglesia con el pago caído o el consentimiento pendiente puede descargarlo
 * (ESTADO.md, «Qué falta»).
 */
export default async function InformeRepartoPage({
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


  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const elegido = mesValido(mes) ?? hoy.slice(0, 7);
  const periodo = mesEnLaIglesia(ctx.iglesia.timezone, elegido);
  const { dias, total: t } = await historialDelMes(ctx, id, periodo.desde, periodo.hasta);

  // En el papel, de primero a último, que es como se lee un mes.
  const enOrden = [...dias].reverse();

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-5 py-8 md:px-8 print:max-w-none print:px-0 print:py-0">
      {/* `print:hidden`: ni la vuelta ni el botón salen en el papel. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/panel/ministerios/${id}/reparto/historial?mes=${elegido}`}
          className="text-[13.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Volver al historial
        </Link>
        <BotonImprimir />
        <p className="basis-full text-[13px] text-muted-foreground">
          Usa «Imprimir» y elige «Guardar como PDF» si lo quieres en fichero.
        </p>
      </div>

      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-[24px] font-bold tracking-[-0.025em]">{ctx.iglesia.nombre}</h1>
        <p className="text-[15px] text-muted-foreground">
          {ministerio.nombre} · Reparto de {periodo.etiqueta}
        </p>
      </header>

      {dias.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No hay ningún reparto en este mes.</p>
      ) : (
        <>
          {/* Dos columnas en el móvil y tres en el papel, sin depender de que la
              hoja mida más que el punto de corte `sm`: lo mismo que finanzas. */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
            <Cifra titulo="Repartos" valor={t.repartos} />
            <Cifra titulo="Entregas" valor={t.entregas} />
            <Cifra titulo="Hogares atendidos" valor={t.hogares} />
            <Cifra titulo="Personas alcanzadas" valor={t.personas} />
            <Cifra titulo="Hogares nuevos" valor={t.nuevos} />
            <Cifra titulo="Sin inscribir" valor={t.sinInscribir} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold tracking-[-0.015em]">Cada reparto</h2>
            {/* El scroll va dentro de su caja en la pantalla y desaparece en el
                papel, donde no hay scroll que valga. */}
            <div className="overflow-x-auto print:overflow-x-visible">
              <table className="w-full min-w-[560px] border-collapse print:min-w-0">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={TH}>Fecha</th>
                    <th className={`${TH} text-right`}>Vinieron</th>
                    <th className={`${TH} text-right`}>Entregas</th>
                    <th className={`${TH} text-right`}>Sin inscribir</th>
                    <th className={`${TH} text-right`}>Nuevos</th>
                    <th className={`${TH} text-right`}>Personas</th>
                  </tr>
                </thead>
                <tbody>
                  {enOrden.map((d) => (
                    <tr
                      key={d.jornadaId}
                      className="break-inside-avoid border-b border-border last:border-b-0"
                    >
                      <td className="py-2 text-[13px] first-letter:uppercase">
                        {formatearFechaLarga(d.fecha)}
                      </td>
                      <td className={TD}>{d.vinieron}</td>
                      <td className={TD}>{d.entregados}</td>
                      <td className={TD}>{d.sinInscribir}</td>
                      <td className={TD}>{d.nuevos}</td>
                      <td className={TD}>{d.personas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sin fila de «Total» debajo de los días, a propósito: las personas
              del mes cuentan cada hogar una vez, y no son la suma de las de
              cada día. El total es la rejilla de arriba. */}
          <section className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <h2 className="text-[13px] font-semibold text-foreground">Cómo se cuenta</h2>
            <p>
              «Entregas» suma las de los hogares del padrón y las que se hicieron
              sin inscribir a nadie. «Hogares atendidos» cuenta cada hogar una vez
              en el mes aunque viniera varias veces, y «personas alcanzadas» suma
              cuántas viven en esos hogares. «Nuevos» son los hogares que
              recibieron por primera vez. Quien se lo llevó sin inscribirse, o a
              quien se borró después del padrón, cuenta como entrega y en las
              personas de su día, pero no como hogar: sin nombre no se sabe si ya
              se había contado.
            </p>
          </section>
        </>
      )}

      <footer className="border-t border-border pt-4 text-[12px] text-muted-foreground">
        Sin nombres: este informe dice cuánto se repartió, no a quién. Hecho con
        Hatril el {formatearFechaLarga(hoy)}.
      </footer>
    </div>
  );
}

const TH = 'py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'py-2 text-right text-[13px] tabular-nums';

function Cifra({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-[20px] font-bold tracking-[-0.02em] tabular-nums">{valor}</span>
    </div>
  );
}
