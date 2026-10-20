import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, Minus, PackageCheck, Search, TriangleAlert } from 'lucide-react';

import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import {
  buscarEnElPadron,
  contarInscritos,
  jornadaDelDia,
  quienHaVenido,
  recibieronEntre,
  type EnLaPuerta,
  type Encontrado,
} from '@/lib/reparto/consultas';
import { haceCuanto, ventanaDeLaSemana } from '@/lib/reparto/plazo';
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
  contarSinInscribir,
  deshacerEntrega,
  empezarReparto,
  entregarA,
  entregarFila,
  marcarLlegada,
  quitarDeLaCola,
} from './actions';

import { requireReparto } from './guarda';

export const metadata: Metadata = { title: 'Reparto' };

/**
 * La puerta del reparto, el domingo, en el móvil de quien la lleva.
 *
 * PENSADA PARA 375 PX Y UNA FILA ESPERANDO
 * ----------------------------------------
 * De arriba abajo, en el orden en que se usa: cuántos esperan, entregar a quien
 * no quiere dar sus datos, buscar a quien tienes delante, la cola, y el alta
 * para quien viene por primera vez. Botones de 44 px y una sola columna.
 *
 * Se busca y se llama POR NÚMERO. La pantalla no está hecha para proyectarse ni
 * para dejarla a la vista: enseña nombres de gente que está pasando necesidad,
 * y quien espera en la fila no tiene por qué saber cómo se llama el de al lado.
 *
 * El naranja es solo la acción principal, y hay una: «Empezar» antes de abrir
 * el reparto, y «Apuntar» después. «Entregado» va en carbón y «Ha llegado» en
 * contorno, porque salen en cada fila. Las cifras van en UNA tarjeta, la de
 * Inicio (`t-cifra`, `p-5`): cuatro cajas sueltas obligaban a sumar de cabeza, y
 * la que se pintaba de naranja cuando había gente esperando era un segundo
 * naranja sin acción.
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
    ya?: string;
  }>;
}) {
  const { id } = await params;
  // La puerta en la página y no solo en el layout: ver `guarda.ts`.
  const { ctx, ministerio } = await requireReparto(id);
  const { q, error, guardado, apuntado, ya } = await searchParams;


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

  const sinInscribir = jornada?.sinInscribir ?? 0;
  const esperando = cola.filter((c) => !c.entregado);
  const yaEntregados = cola.filter((c) => c.entregado);
  const estadoDe = new Map(
    cola
      .filter((c) => c.beneficiarioId)
      .map((c) => [c.beneficiarioId!, c] as const),
  );

  // El aviso de la semana, para quien espera y para quien sale en el buscador:
  // es lo que ve quien está en la puerta JUSTO antes de pulsar.
  const ventana = ventanaDeLaSemana(hoy);
  const recientes = await recibieronEntre(ctx, id, ventana.desde, ventana.hasta, [
    ...new Set([
      ...esperando.map((c) => c.beneficiarioId).filter((b): b is string => b !== null),
      ...encontrados.map((p) => p.id),
    ]),
  ]);

  const hora = new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ctx.iglesia.timezone,
  });

  const numeroApuntado = apuntado && /^\d{1,6}$/.test(apuntado) ? apuntado : null;
  // Solo si cae en la ventana de la semana: es lo único que una action de HOY
  // puede haber mandado. Una pestaña vieja recargada días después traería un
  // `?ya=` de otra semana y avisaría de algo que no acaba de pasar.
  const yaRecibio =
    ya && /^\d{4}-\d{2}-\d{2}$/.test(ya) && ya >= ventana.desde && ya <= ventana.hasta
      ? ya
      : null;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo={`La puerta de hoy, ${formatearFechaLarga(hoy)}`}
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <div className="flex flex-col gap-3">
          <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="reparto" />
          <SeccionesReparto ministerioId={id} activa="hoy" />
        </div>

        {error && <Aviso>{error}</Aviso>}
        {numeroApuntado && (
          <Aviso tipo="ok">
            Apuntado con el número <strong>{numeroApuntado}</strong>. Díselo: es
            por el que se le llamará.
            {jornada ? ' Ya está esperando en la cola.' : ''}
          </Aviso>
        )}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {!jornada ? (
          <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">Hoy todavía no ha empezado el reparto</h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Empezarlo apunta que hoy se reparte. Así, un día sin reparto no se
              confunde con uno al que no vino nadie, y el total del mes sale
              solo.{' '}
              {inscritos === 1
                ? 'Hay 1 hogar en el padrón.'
                : `Hay ${inscritos} hogares en el padrón.`}
            </p>
            <form action={empezarReparto.bind(null, id)} className="w-full sm:w-auto">
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Empezar el reparto de hoy
              </Button>
            </form>
          </section>
        ) : (
          <>
            <section
              aria-label="Cómo va"
              className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5"
            >
              <span className="t-micro">Esperando</span>
              <span className="t-cifra tabular-nums">{esperando.length}</span>
              <span className="text-[13px] leading-relaxed text-muted-foreground">
                <Cifra n={cola.length + sinInscribir} />{' '}
                {cola.length + sinInscribir === 1 ? 'ha venido' : 'han venido'} ·{' '}
                <Cifra n={yaEntregados.length + sinInscribir} />{' '}
                {yaEntregados.length + sinInscribir === 1 ? 'entregado' : 'entregados'}
                {sinInscribir > 0 && (
                  <>
                    {' '}(<Cifra n={sinInscribir} /> sin inscribir)
                  </>
                )}{' '}
                · <Cifra n={inscritos} /> en el padrón
              </span>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 md:px-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  Sin inscribir: {sinInscribir}
                </span>
                <span className="text-pretty text-[13px] leading-snug text-muted-foreground">
                  Para quien no quiere dar sus datos. Se cuenta la entrega y no se
                  guarda a nadie.
                </span>
              </div>
              <form action={contarSinInscribir.bind(null, id)} className="flex gap-2">
                <Button
                  type="submit"
                  name="cambio"
                  value="mas"
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-none"
                >
                  <PackageCheck strokeWidth={1.8} />
                  Entregar sin inscribir
                </Button>
                <Button
                  type="submit"
                  name="cambio"
                  value="menos"
                  variant="outline"
                  size="lg"
                  className="w-11 px-0"
                  aria-label="Corregir: uno menos sin inscribir"
                  title="Corregir: uno menos"
                  disabled={sinInscribir === 0}
                >
                  <Minus strokeWidth={1.8} />
                </Button>
              </form>
            </section>

            <section className="flex flex-col gap-3">
              <form action={base} className="flex w-full max-w-[420px] items-center gap-2">
                <Input
                  // Con `key`: tras una action la página no se remonta, y Base UI
                  // avisa si el `defaultValue` de un campo cambia debajo de él.
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
                    <span className="text-[13px] text-muted-foreground">
                      {encontrados.length === 0
                        ? `Nadie con «${busqueda}».`
                        : `${encontrados.length === 1 ? '1 hogar' : `${encontrados.length} hogares`} con «${busqueda}»`}
                    </span>
                    <Link
                      href={base}
                      className="px-1 text-[13.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Limpiar
                    </Link>
                  </div>

                  {encontrados.length === 0 ? (
                    <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[14.5px] text-muted-foreground md:px-5">
                      Si viene por primera vez,{' '}
                      <a href="#alta" className="underline">
                        apúntale abajo
                      </a>
                      . Si no quiere dar sus datos, pulsa «Entregar sin inscribir».
                    </p>
                  ) : (
                    <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                      {encontrados.map((p) => (
                        <li key={p.id} className="border-b border-border last:border-b-0">
                          <FilaEncontrada
                            persona={p}
                            enLaPuerta={estadoDe.get(p.id)}
                            hora={hora}
                            reciente={recientes.get(p.id)}
                            hoy={hoy}
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

            <section id="cola" className="flex scroll-mt-24 flex-col gap-2.5">
              <h2 className="t-micro px-1">Esperando</h2>
              {/* Aquí y no arriba con las confirmaciones: la vuelta de marcar
                  salta a `#cola`, y arriba quedaba fuera de la pantalla justo
                  cuando importa. */}
              {yaRecibio && <AvisoYaRecibio fecha={yaRecibio} hoy={hoy} />}
              {esperando.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[14.5px] text-muted-foreground md:px-5">
                  Nadie esperando. Busca a quien llegue por su número o su nombre
                  y pulsa «Ha llegado».
                </p>
              ) : (
                <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  {esperando.map((c) => (
                    <li
                      key={c.entregaId}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
                    >
                      {/* Sin la hora: a 375 px, con «Entregado» al lado, se cortaba
                          a medias. La cola ya va por orden de llegada, y la hora
                          sale en el buscador para quien la necesite. */}
                      <Persona
                        fila={c}
                        detalle=""
                        reciente={c.beneficiarioId ? recientes.get(c.beneficiarioId) : undefined}
                        hoy={hoy}
                      />
                      <div className="flex flex-none flex-col items-end gap-1">
                        <form action={entregarFila.bind(null, id, c.entregaId)}>
                          <Button type="submit" variant="secondary" size="lg">
                            <Check strokeWidth={1.8} />
                            Entregado
                          </Button>
                        </form>
                        <form action={quitarDeLaCola.bind(null, id, c.entregaId)}>
                          <Button type="submit" variant="ghost" size="sm" className={GRIS}>
                            Quitar
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {yaEntregados.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="t-micro px-1">Ya entregado</h2>
                <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  {yaEntregados
                    .slice()
                    .reverse()
                    .map((c) => (
                      <li
                        key={c.entregaId}
                        className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
                      >
                        <Persona
                          fila={c}
                          detalle={c.entregadoAt ? hora.format(c.entregadoAt) : ''}
                          hoy={hoy}
                        />
                        <form action={deshacerEntrega.bind(null, id, c.entregaId)} className="flex-none">
                          <Button type="submit" variant="ghost" size="sm" className={GRIS}>
                            Deshacer
                          </Button>
                        </form>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            <section
              id="alta"
              className="flex scroll-mt-24 flex-col gap-4 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="t-subtitulo">Viene por primera vez</h2>
                <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
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
                    className="w-fit text-[13px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Si pide más detalle: la política de privacidad
                  </Link>
                </div>

                {/* Casilla NATIVA y SIN premarcar: considerando 32. */}
                <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-relaxed">
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

/**
 * El `ghost` del sistema es texto naranja. Repetido en cada fila competía con
 * el único botón naranja de la pantalla, así que se lleva a gris, como los
 * botones de fila de los turnos.
 */
const GRIS = 'text-muted-foreground hover:bg-muted hover:text-foreground';

function Cifra({ n }: { n: number }) {
  return <strong className="font-semibold text-foreground tabular-nums">{n}</strong>;
}

/**
 * «Ya recibió hace 3 días»: la insignia de aviso de los turnos, con icono
 * porque el fondo apenas se separa de la tarjeta blanca. Avisa y no impide: los
 * botones de la fila siguen igual.
 *
 * Se parte en dos líneas si no cabe, como la de turnos. Con `whitespace-nowrap`
 * se salía de su columna en la cola: a 375 px, al lado de «Entregado», la
 * columna del nombre mide unos 97 px y el texto entero, 145.
 */
function YaRecibio({ fecha, hoy }: { fecha: string; hoy: string }) {
  return (
    <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-md bg-badge-warning-bg px-1.5 py-px text-[11.5px] font-semibold text-badge-warning-fg">
      <TriangleAlert className="size-3 shrink-0" strokeWidth={2.2} aria-hidden />
      Ya recibió {haceCuanto(fecha, hoy)}
    </span>
  );
}

/**
 * Después de marcar: «a quien acabas de marcar ya se le entregó…».
 *
 * La caja de `eleccion-ficha.tsx`, aviso que no bloquea, sin `role="alert"`,
 * que es para errores. Lo hecho, hecho está; esto es para saberlo.
 */
function AvisoYaRecibio({ fecha, hoy }: { fecha: string; hoy: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg bg-badge-warning-bg px-3.5 py-3 text-[13px] leading-snug text-badge-warning-fg"
    >
      <TriangleAlert className="mt-px size-4 shrink-0" strokeWidth={1.9} aria-hidden />
      <span className="text-pretty">
        A quien acabas de marcar ya se le entregó {haceCuanto(fecha, hoy)}, el{' '}
        {formatearFechaLarga(fecha)}. Se ha marcado igual: es un aviso, no una
        prohibición.
      </span>
    </div>
  );
}

/** El número grande delante, que es por lo que se llama. */
function Persona({
  fila,
  detalle,
  reciente,
  hoy,
}: {
  fila: EnLaPuerta;
  detalle: string;
  reciente?: string;
  hoy: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="min-w-[3ch] flex-none text-[20px] font-bold leading-none tracking-[-0.02em] tabular-nums">
        {fila.numero !== null ? fila.numero : '—'}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">
          {fila.nombre ?? 'Borrado del padrón'}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {fila.personasHogar === 1 ? '1 persona' : `${fila.personasHogar} personas`}
          {detalle ? ` · ${detalle}` : ''}
        </span>
        {reciente && <YaRecibio fecha={reciente} hoy={hoy} />}
      </span>
    </span>
  );
}

function FilaEncontrada({
  persona: p,
  enLaPuerta,
  hora,
  reciente,
  hoy,
  llegar,
  entregar,
}: {
  persona: Encontrado;
  enLaPuerta: EnLaPuerta | undefined;
  hora: Intl.DateTimeFormat;
  reciente: string | undefined;
  hoy: string;
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
    <div className="flex flex-col gap-2.5 px-4 py-3 md:px-5">
      <span className="flex min-w-0 items-center gap-3">
        <span className="min-w-[3ch] flex-none text-[20px] font-bold leading-none tracking-[-0.02em] tabular-nums">
          {p.numero}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">{p.nombre}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {p.personasHogar === 1 ? '1 persona' : `${p.personasHogar} personas`} · {estado}
          </span>
          {reciente && !enLaPuerta?.entregado && <YaRecibio fecha={reciente} hoy={hoy} />}
        </span>
      </span>

      {!enLaPuerta?.entregado && (
        <div className={enLaPuerta ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-2'}>
          {!enLaPuerta && (
            <form action={llegar}>
              <Button type="submit" variant="outline" size="lg" className="w-full">
                Ha llegado
              </Button>
            </form>
          )}
          <form action={entregar}>
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              <Check strokeWidth={1.8} />
              Entregado
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
