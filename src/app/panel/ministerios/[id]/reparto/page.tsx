import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check, Minus, Plus, Search, X } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import {
  buscarEnElPadron,
  contarInscritos,
  jornadaDelDia,
  quienHaVenido,
  type EnLaPuerta,
  type Encontrado,
} from '@/lib/reparto/consultas';
import { TEXTO_AVISO_REPARTO } from '@/lib/rgpd/consentimiento';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { SeccionesReparto } from './_components/secciones';
import { CONFIRMACIONES } from './constantes';
import {
  apuntarEnLaPuerta,
  contarSinApuntar,
  deshacerEntrega,
  empezarReparto,
  entregarA,
  entregarFila,
  marcarLlegada,
  quitarDeLaCola,
} from './actions';

export const metadata: Metadata = { title: 'Reparto' };

/**
 * La puerta del reparto, el domingo, en el móvil de quien la lleva.
 *
 * PENSADA PARA 375 PX Y UNA FILA ESPERANDO
 * ----------------------------------------
 * De arriba abajo, en el orden en que se usa: cuántos van, buscar a quien
 * tienes delante, la cola de quien espera, y el alta para quien viene por
 * primera vez. Botones de 44 px, una columna, y sin nada que haya que arrastrar.
 *
 * Se busca y se llama POR NÚMERO. La pantalla no está hecha para proyectarse ni
 * para dejarla a la vista: enseña nombres de gente que está pasando necesidad,
 * y quien espera en la fila no tiene por qué saber cómo se llama el de al lado.
 *
 * Un solo botón naranja, como pide el sistema: «Empezar» antes de abrir el
 * reparto, y «Apuntar» después. «Entregado» va en carbón y «Ha llegado» en
 * contorno, porque salen en cada fila.
 *
 * El buscador va por `?q=`, sin JavaScript: funciona en cualquier móvil y con
 * mala cobertura, que es lo normal en el salón de una iglesia.
 */
export default async function RepartoHoyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    error?: string;
    guardado?: string;
    apuntado?: string;
  }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { q, error, guardado, apuntado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const base = `/panel/ministerios/${id}/reparto`;
  const busqueda = q?.trim().slice(0, 60) || undefined;

  const [jornada, inscritos] = await Promise.all([
    jornadaDelDia(ctx, id, hoy),
    contarInscritos(ctx, id),
  ]);
  const [cola, encontrados] = jornada
    ? await Promise.all([
        quienHaVenido(ctx, jornada.id),
        busqueda ? buscarEnElPadron(ctx, id, busqueda) : Promise.resolve([]),
      ])
    : [[], []];

  const sinApuntar = jornada?.sinInscribir ?? 0;
  const esperando = cola.filter((c) => !c.entregado);
  const yaEntregados = cola.filter((c) => c.entregado);
  const estadoDe = new Map(
    cola
      .filter((c) => c.beneficiarioId)
      .map((c) => [c.beneficiarioId!, c] as const),
  );

  const hora = new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ctx.iglesia.timezone,
  });

  const numeroApuntado = apuntado && /^\d{1,6}$/.test(apuntado) ? apuntado : null;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo={`Reparto · ${formatearFechaLarga(hoy)}`}
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="reparto" />
        <SeccionesReparto ministerioId={id} activa="hoy" />

        {error && <Aviso>{error}</Aviso>}
        {numeroApuntado && (
          <Aviso tipo="ok">
            Apuntado con el número <strong>{numeroApuntado}</strong>. Díselo: es
            por el que se le llamará.
            {jornada ? ' Ya está esperando en la cola.' : ''}
          </Aviso>
        )}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {!jornada ? (
          <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="t-subtitulo">Hoy todavía no ha empezado el reparto</h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Empezarlo apunta que hoy se reparte. Así, un día sin reparto no se
              confunde con uno al que no vino nadie, y el total del mes sale
              solo.
            </p>
            <form action={empezarReparto.bind(null, id)} className="w-full sm:w-auto">
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Empezar el reparto de hoy
              </Button>
            </form>
            <p className="text-[13px] text-muted-foreground">
              {inscritos === 1
                ? '1 hogar en el padrón.'
                : `${inscritos} hogares en el padrón.`}
            </p>
          </section>
        ) : (
          <>
            <section aria-label="Cómo va" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Contador etiqueta="Han venido" valor={cola.length + sinApuntar} />
              <Contador etiqueta="Entregados" valor={yaEntregados.length + sinApuntar} />
              <Contador etiqueta="Esperando" valor={esperando.length} destacado={esperando.length > 0} />
              <Contador etiqueta="En el padrón" valor={inscritos} />
            </section>

            <section className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14.5px] font-semibold">
                  Sin apuntar: {sinApuntar}
                </span>
                <span className="text-[13px] leading-snug text-muted-foreground">
                  Se lo llevaron sin dar sus datos. Cuentan como venidos y
                  entregados.
                </span>
              </div>
              <form action={contarSinApuntar.bind(null, id)} className="flex flex-none gap-1.5">
                <Button
                  type="submit"
                  name="cambio"
                  value="menos"
                  variant="outline"
                  size="icon"
                  aria-label="Uno menos sin apuntar"
                  disabled={sinApuntar === 0}
                >
                  <Minus strokeWidth={1.9} />
                </Button>
                <Button
                  type="submit"
                  name="cambio"
                  value="mas"
                  variant="outline"
                  aria-label="Uno más sin apuntar"
                >
                  <Plus strokeWidth={1.9} />
                  Uno
                </Button>
              </form>
            </section>

            <section className="flex flex-col gap-3">
              <form action={base} className="flex w-full max-w-[520px] items-center gap-2">
                <Input
                  // Con `key`: tras una action la página no se remonta, y Base UI avisa
                  // si el `defaultValue` de un campo cambia debajo de él.
                  key={busqueda ?? ''}
                  name="q"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  defaultValue={busqueda ?? ''}
                  placeholder="Número o nombre"
                  aria-label="Buscar en el padrón por número o nombre"
                />
                <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
                  <Search strokeWidth={1.8} />
                </Button>
              </form>

              {busqueda && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-[13.5px] text-muted-foreground">
                      {encontrados.length === 0
                        ? `Nadie con «${busqueda}».`
                        : `${encontrados.length === 1 ? '1 persona' : `${encontrados.length} personas`} con «${busqueda}»`}
                    </span>
                    <Link
                      href={base}
                      className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-muted-foreground no-underline hover:text-foreground"
                    >
                      <X className="size-3.5" strokeWidth={2} aria-hidden />
                      Limpiar
                    </Link>
                  </div>

                  {encontrados.length === 0 ? (
                    <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[14px] text-muted-foreground">
                      Si viene por primera vez,{' '}
                      <a href="#alta" className="font-semibold">
                        apúntale abajo
                      </a>
                      . Si no quiere dar sus datos, súmalo en «Sin apuntar».
                    </p>
                  ) : (
                    <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                      {encontrados.map((p) => (
                        <li key={p.id} className="border-b border-border last:border-b-0">
                          <FilaEncontrada
                            persona={p}
                            enLaPuerta={estadoDe.get(p.id)}
                            hora={hora}
                            llegar={marcarLlegada.bind(null, id, p.id)}
                            entregar={entregarA.bind(null, id, p.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section id="cola" className="flex flex-col gap-2.5 scroll-mt-4">
              <h2 className="t-subtitulo px-1">
                Esperando{esperando.length > 0 ? ` (${esperando.length})` : ''}
              </h2>
              {esperando.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[14px] text-muted-foreground">
                  Nadie esperando. Busca a quien llegue por su número o su
                  nombre y pulsa «Ha llegado».
                </p>
              ) : (
                <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  {esperando.map((c) => (
                    <li
                      key={c.entregaId}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      {/* Sin la hora: a 375 px, con «Entregado» al lado, se cortaba
                          a medias. La cola ya va por orden de llegada, y la hora
                          sale en el buscador para quien la necesite. */}
                      <Persona fila={c} detalle="" />
                      <div className="flex flex-none flex-col items-end gap-1">
                        <form action={entregarFila.bind(null, id, c.entregaId)}>
                          <Button type="submit" variant="secondary" size="lg">
                            <Check strokeWidth={2} />
                            Entregado
                          </Button>
                        </form>
                        <form action={quitarDeLaCola.bind(null, id, c.entregaId)}>
                          <button
                            type="submit"
                            className="cursor-pointer px-1 text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Quitar
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {yaEntregados.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="t-subtitulo px-1">Ya entregado ({yaEntregados.length})</h2>
                <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  {yaEntregados
                    .slice()
                    .reverse()
                    .map((c) => (
                      <li
                        key={c.entregaId}
                        className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                      >
                        <Persona
                          fila={c}
                          detalle={c.entregadoAt ? hora.format(c.entregadoAt) : ''}
                        />
                        <form action={deshacerEntrega.bind(null, id, c.entregaId)} className="flex-none">
                          {/* Discreto, como «Quitar»: el `ghost` del sistema es texto
                              naranja, y repetido en cada fila competía con el único
                              botón naranja de la pantalla. */}
                          <button
                            type="submit"
                            className="cursor-pointer px-1 py-2 text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Deshacer
                          </button>
                        </form>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            <section
              id="alta"
              className="flex scroll-mt-4 flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6"
            >
              <div className="flex flex-col gap-1">
                <h2 className="t-subtitulo">Viene por primera vez</h2>
                <p className="text-[13.5px] leading-snug text-muted-foreground">
                  Se apunta en un momento y entra directo en la cola. Solo el
                  nombre es obligatorio.
                </p>
              </div>

              <form action={apuntarEnLaPuerta.bind(null, id)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nombre">Cómo quiere que le llamen</Label>
                  <Input id="nombre" name="nombre" required maxLength={80} autoComplete="off" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="personas">Personas en su casa, contándole</Label>
                    <Input
                      id="personas"
                      name="personas"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      defaultValue={1}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="telefono">
                      Teléfono{' '}
                      <span className="font-normal text-muted-foreground">(si quiere)</span>
                    </Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      inputMode="tel"
                      maxLength={32}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Lo que se lee en voz alta. Va a la vista y no detrás de un
                    enlace: el art. 13 pide informar en el momento, y quien está
                    en la puerta no va a abrir la política con la fila esperando.
                    La versión exacta se guarda con la persona
                    (`VERSION_CONSENTIMIENTO_REPARTO`). */}
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt p-4">
                  <span className="t-micro">Léeselo antes de apuntarle</span>
                  <p className="text-[14.5px] leading-relaxed">
                    {TEXTO_AVISO_REPARTO(ctx.iglesia.nombre)}
                  </p>
                  <Link
                    href="/privacidad#s3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-semibold"
                  >
                    Si pide más detalle: la política de privacidad
                  </Link>
                </div>

                {/* Casilla NATIVA y SIN premarcar: considerando 32. */}
                <label className="flex items-start gap-2.5 text-[14.5px] leading-relaxed">
                  <input type="checkbox" name="aviso" required className="mt-1 flex-none" />
                  <span>Se lo he leído y está de acuerdo en que le apuntemos.</span>
                </label>

                <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start">
                  Apuntar y poner en la cola
                </Button>
              </form>
            </section>
          </>
        )}
      </Contenedor>
    </>
  );
}

function Contador({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div
      className={
        'flex flex-col gap-1 rounded-xl border px-4 py-3 ' +
        (destacado ? 'border-primary bg-accent' : 'border-border bg-surface')
      }
    >
      <span className={'t-micro ' + (destacado ? 'text-accent-foreground' : '')}>
        {etiqueta}
      </span>
      <span
        className={
          'text-[28px] font-bold leading-none tracking-[-0.025em] tabular-nums ' +
          (destacado ? 'text-accent-foreground' : '')
        }
      >
        {valor}
      </span>
    </div>
  );
}

/** El número grande delante, que es por lo que se llama. */
function Persona({ fila, detalle }: { fila: EnLaPuerta; detalle: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="min-w-[3ch] flex-none text-[20px] font-bold tabular-nums">
        {fila.numero !== null ? fila.numero : '—'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-semibold">
          {fila.nombre ?? 'Borrado del padrón'}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {fila.personasHogar === 1 ? '1 persona' : `${fila.personasHogar} personas`}
          {detalle ? ` · ${detalle}` : ''}
        </span>
      </span>
    </span>
  );
}

function FilaEncontrada({
  persona: p,
  enLaPuerta,
  hora,
  llegar,
  entregar,
}: {
  persona: Encontrado;
  enLaPuerta: EnLaPuerta | undefined;
  hora: Intl.DateTimeFormat;
  llegar: () => Promise<void>;
  entregar: () => Promise<void>;
}) {
  const estado = !enLaPuerta
    ? p.deBaja
      ? 'De baja: al marcarle vuelve al padrón'
      : 'No ha llegado todavía'
    : enLaPuerta.entregado
      ? `Entregado${enLaPuerta.entregadoAt ? ` a las ${hora.format(enLaPuerta.entregadoAt)}` : ''}`
      : `Esperando desde las ${hora.format(enLaPuerta.llegoAt)}`;

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="min-w-[3ch] flex-none text-[20px] font-bold tabular-nums">
          {p.numero}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">{p.nombre}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {p.personasHogar === 1 ? '1 persona' : `${p.personasHogar} personas`} · {estado}
          </span>
        </span>
      </span>

      {!enLaPuerta?.entregado && (
        <div className="grid grid-cols-2 gap-2">
          {!enLaPuerta ? (
            <form action={llegar}>
              <Button type="submit" variant="outline" size="lg" className="w-full">
                Ha llegado
              </Button>
            </form>
          ) : (
            <span />
          )}
          <form action={entregar}>
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              <Check strokeWidth={2} />
              Entregado
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
