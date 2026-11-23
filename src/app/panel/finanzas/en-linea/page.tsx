import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Clock,
  CreditCard,
  ExternalLink,
  EyeOff,
  Globe,
  HandCoins,
  Link as IconoEnlace,
} from 'lucide-react';
import { clsx } from 'clsx';

import { requireFinanzas } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import {
  COMISION_FIJA,
  COMISION_PORCENTAJE,
  NOMBRE_TIPO,
  formatearEuros,
} from '@/lib/donativos/calculo';
import {
  resumenEnLinea,
  type DonativoReciente,
  type ResumenEnLinea,
} from '@/lib/donativos/consultas';
import { refrescarCuenta } from '@/lib/donativos/stripe-connect';
import { captureException } from '@/lib/observability';
import { Aviso } from '@/components/aviso';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Cifra } from '@/components/ui/cifra';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Insignia } from '@/components/ui/insignia';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import { InterruptorFondo } from './_components/interruptor-fondo';
import { cambiarFondoEnDonativos, conectarStripe } from './actions';

export const metadata: Metadata = { title: 'Ofrendas en línea' };

const PANEL_STRIPE = 'https://dashboard.stripe.com';

const CONFIRMACIONES: Record<string, string> = {
  'fondo-dentro': 'Guardado. Ese fondo ya se puede elegir al dar.',
  'fondo-fuera':
    'Guardado. Ese fondo ya no sale al dar. Lo que se dio antes sigue en su sitio.',
};

/** «1,5 % + 0,25 €», de las mismas constantes con las que se calcula la casilla de cubrirla. */
// Con espacio duro antes del «%»: si no, a 390 px el número y su signo se
// separan de línea. El de «€» ya lo pone `Intl`.
const TARIFA_STRIPE = `${(COMISION_PORCENTAJE * 100).toLocaleString('es-ES')} % + ${formatearEuros(COMISION_FIJA)}`;

type Estado = 'fuera' | 'conectar' | 'revision' | 'activa';

/**
 * Cuatro situaciones, y en este orden:
 *
 *   - `fuera`: la iglesia no es de España o no cuenta en euros (decisión 4). Da
 *     igual lo que haya en Stripe: la página de dar no ofrece tarjeta.
 *   - `activa`: Stripe deja cobrar. Se mira `cobrosActivos` y nada más, que es
 *     lo que mira la página de dar: si dijéramos «a medias» mientras la tarjeta
 *     ya sale en la web, el panel mentiría.
 *   - `revision`: los datos están enviados y Stripe no deja cobrar todavía.
 *   - `conectar`: sin cuenta, o con el alta a medias.
 */
function estadoDe(r: ResumenEnLinea): Estado {
  if (!r.paisAdmitido) return 'fuera';
  if (r.cuenta?.cobrosActivos) return 'activa';
  if (r.cuenta?.datosCompletos) return 'revision';
  return 'conectar';
}

/**
 * Finanzas → Ofrendas en línea: conectar la cuenta de Stripe de la iglesia,
 * elegir qué fondos salen al dar y ver lo que entra.
 *
 * QUIÉN VE QUÉ
 * ------------
 * Entra quien lleva la caja (`requireFinanzas`). Pero quién da a la iglesia es
 * dato del art. 9, y la RLS de la `0056` (`ve_donantes()`) solo se lo devuelve
 * al pastor y al ROL tesorero, no a quien tiene el permiso de la caja por una
 * excepción. A esa persona se le dice por qué no ve los pagos, y ve lo demás:
 * el estado de la conexión y los fondos.
 *
 * Y no basta con que la RLS no le dé nada: `resumenEnLinea` le devolvería SUS
 * PROPIOS donativos (la policy deja a cada cual leer los suyos), y pintados aquí
 * dirían «este mes ha entrado lo que diste tú» como si fuera el total de la
 * iglesia. Por eso las cifras y «Lo último» ni se pintan.
 */
export default async function OfrendasEnLineaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; vuelta?: string }>;
}) {
  // La guarda entera, también aquí: el layout no protege la página (CLAUDE.md).
  const ctx = await requireFinanzas();
  const { error, ok, vuelta } = await searchParams;

  const pastor = esPastor(ctx);
  // El mismo criterio que `ve_donantes()`: el rol, no el permiso.
  const veDonantes = pastor || ctx.rol === 'tesorero';

  // Al volver del alta se pregunta a Stripe en el momento, sin esperar al
  // webhook, para que la pantalla diga ya «Conectada» si lo está. Solo con el
  // pastor, que es el único que puede haber ido: es una escritura (por
  // `dbAdmin`), y no tiene por qué dispararla cualquiera con un `?vuelta=1`.
  // Si Stripe no responde, se lee lo que haya y se avisa.
  let stripeNoContesta = false;
  if (vuelta === '1' && pastor) {
    try {
      await refrescarCuenta(ctx.iglesia.id);
    } catch (err) {
      stripeNoContesta = true;
      await captureException(err, {
        action: 'refrescar_cuenta_stripe',
        iglesiaId: ctx.iglesia.id,
      });
    }
  }

  const r = await resumenEnLinea(ctx);
  const estado = estadoDe(r);
  const conGeneral = r.fondos.some((f) => f.esGeneral);

  const avisos = (
    <>
      {error && <Aviso>{error}</Aviso>}
      {ok && Object.hasOwn(CONFIRMACIONES, ok) && (
        <Aviso tipo="ok">{CONFIRMACIONES[ok]}</Aviso>
      )}
      {stripeNoContesta && (
        <Aviso tipo="aviso">
          Stripe no ha contestado ahora. Lo que ves puede tardar unos minutos en
          ponerse al día: vuelve a abrir esta pantalla en un rato.
        </Aviso>
      )}
      {/* Sin fondo general no hay a dónde apuntar «Donde más falte», y la
          página de dar no ofrece la tarjeta aunque Stripe esté conectado
          (`paginaDeDar`). Pasa si Finanzas no se ha empezado nunca. */}
      {estado !== 'fuera' && !conGeneral && (
        <Aviso tipo="aviso">
          Antes hay que empezar Finanzas: «Donde más falte» es su fondo general,
          y sin él la tarjeta no sale al dar.{' '}
          <Link href="/panel/finanzas">Empezar Finanzas</Link>
        </Aviso>
      )}
    </>
  );

  return (
    <>
      <CabeceraPanel
        titulo="Ofrendas en línea"
        subtitulo="Diezmos y ofrendas con tarjeta"
        volver={{ href: '/panel/finanzas', texto: 'Finanzas' }}
        insignia={<InsigniaEstado estado={estado} aMedias={Boolean(r.cuenta)} />}
      >
        {estado === 'activa' && (
          <BotonEnlace href={PANEL_STRIPE} nuevaPestana variant="outline">
            <ExternalLink strokeWidth={1.8} />
            Abrir Stripe
          </BotonEnlace>
        )}
      </CabeceraPanel>

      {estado === 'activa' ? (
        <Contenedor>
          {avisos}

          <Aviso tipo="ok">
            Conectada a Stripe. Los pagos llegan a la cuenta del banco de la
            iglesia
            {conGeneral
              ? ', y «Dar» con tarjeta ya sale en la web y en la app.'
              : '.'}
          </Aviso>

          {veDonantes && <CifrasDelMes r={r} />}

          {/* Dos columnas en escritorio, como Comunidad: lo que entra a la
              izquierda, que es a lo que se viene; los fondos a la derecha, que
              se tocan una vez. En el móvil, en ese mismo orden. */}
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            {veDonantes ? <LoUltimo recientes={r.recientes} /> : <SinDonantes />}

            <div className="flex flex-col gap-4">
              <Fondos fondos={r.fondos} pastor={pastor} />
              {veDonantes && <NotaPrivacidad />}
            </div>
          </div>
        </Contenedor>
      ) : (
        // Ancho de formulario: aquí hay una tarjeta y como mucho la lista de
        // fondos. A 1600 px el texto quedaría de punta a punta (`SinActivar`).
        <Contenedor ancho="formulario">
          {avisos}

          {estado === 'fuera' && <FueraDeEspana pastor={pastor} />}
          {estado === 'conectar' && (
            <Conectar aMedias={Boolean(r.cuenta)} pastor={pastor} />
          )}
          {estado === 'revision' && (
            <>
              <EnRevision />
              {/* Los fondos se pueden dejar elegidos mientras Stripe revisa:
                  es el paso dos, y así «Dar» sale completo el día que se
                  enciende. */}
              <Fondos fondos={r.fondos} pastor={pastor} />
              {!veDonantes && <SinDonantes />}
            </>
          )}
        </Contenedor>
      )}
    </>
  );
}

/**
 * El estado junto al título, solo desde `sm`: a 390 px la insignia le comía el
 * título hasta «Ofrendas …», y en el móvil la tarjeta de debajo ya dice lo
 * mismo con palabras.
 */
function InsigniaEstado({ estado, aMedias }: { estado: Estado; aMedias: boolean }) {
  if (estado === 'fuera') return null;
  return (
    <span className="hidden sm:flex">
      {estado === 'activa' ? (
        <Insignia tono="exito" punto>
          Conectada
        </Insignia>
      ) : estado === 'revision' ? (
        <Insignia tono="aviso" punto>
          En revisión
        </Insignia>
      ) : (
        <Insignia punto>{aMedias ? 'A medias' : 'Sin conectar'}</Insignia>
      )}
    </span>
  );
}

/** El cuadro del icono de cabeza de cada tarjeta: el de `SinActivar`, en carbón. */
function IconoTarjeta({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-10 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-support [&_svg]:size-5"
    >
      {children}
    </span>
  );
}

// ============================================================================
// Antes de cobrar
// ============================================================================

const PASOS = [
  {
    titulo: 'Conecta la cuenta de Stripe de la iglesia',
    detalle:
      'O créala ahí mismo. Stripe pide el CIF y la cuenta del banco de la iglesia; Hatril no los ve.',
  },
  {
    titulo: 'Elige qué fondos se pueden elegir al dar',
    detalle: '«Donde más falte» está siempre; Misiones o Construcción, si quieres.',
  },
  {
    titulo: 'Se enciende «Dar» en la web y en la app',
    detalle: 'En cuanto Stripe termine de revisar los datos de la iglesia.',
  },
] as const;

/**
 * La tarjeta de los tres pasos, con el único botón naranja de la pantalla.
 *
 * Conectar lo hace el pastor (`soloPastor` en la action). A tesorería se le
 * enseña lo mismo sin el botón y se le dice quién lo pulsa: un botón que al
 * pulsarlo responde «no tienes permiso» es peor que no tenerlo.
 */
function Conectar({ aMedias, pastor }: { aMedias: boolean; pastor: boolean }) {
  return (
    <section className="flex flex-col items-start gap-5 rounded-xl border border-border bg-surface p-5 md:p-6">
      <IconoTarjeta>
        <CreditCard strokeWidth={1.8} />
      </IconoTarjeta>

      <div className="flex flex-col gap-1.5">
        <h2 className="t-subtitulo text-balance">
          Recibe diezmos y ofrendas con tarjeta
        </h2>
        <p className="text-body text-pretty text-muted-foreground">
          Tu congregación da desde la web y la app, y el dinero llega a la
          cuenta del banco de la iglesia. Hatril no lo toca.
        </p>
      </div>

      <ol className="flex w-full flex-col gap-3.5">
        {PASOS.map((p, i) => (
          <li key={p.titulo} className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-6 flex-none items-center justify-center rounded-full border border-border bg-surface-alt text-label font-semibold tabular-nums"
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
              <span className="text-body font-semibold">{p.titulo}</span>
              <span className="text-pretty text-label text-muted-foreground">
                {p.detalle}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {aMedias && (
        <p className="text-pretty text-label text-foreground">
          El alta en Stripe se quedó a medias: puedes seguir donde lo dejaste.
        </p>
      )}

      {pastor ? (
        <form action={conectarStripe} className="w-full sm:w-auto">
          <BotonEnviar pendiente="Abriendo Stripe…" className="w-full sm:w-auto">
            <IconoEnlace strokeWidth={1.8} />
            {aMedias ? 'Seguir con el alta en Stripe' : 'Conectar con Stripe'}
          </BotonEnviar>
        </form>
      ) : (
        <p className="w-full rounded-lg border border-border bg-surface-alt px-3.5 py-3 text-pretty text-label text-foreground">
          {aMedias ? 'Seguir con el alta' : 'Conectar la cuenta'} lo hace el
          pastor de la iglesia, desde esta misma pantalla.
        </p>
      )}

      <p className="text-pretty text-label text-muted-foreground">
        Stripe cobra {TARIFA_STRIPE} por cada pago con tarjeta europea. Hatril
        no se queda nada.
      </p>
    </section>
  );
}

function EnRevision() {
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 md:p-6">
      <IconoTarjeta>
        <Clock strokeWidth={1.8} />
      </IconoTarjeta>
      <h2 className="t-subtitulo text-balance">
        Stripe está revisando los datos de la iglesia
      </h2>
      <p className="text-body text-pretty text-muted-foreground">
        Hasta que acabe, «Dar» con tarjeta no sale en la web ni en la app. Si le
        falta algo, Stripe lo pide por correo y en su panel.
      </p>
      <BotonEnlace href={PANEL_STRIPE} nuevaPestana variant="outline">
        <ExternalLink strokeWidth={1.8} />
        Abrir Stripe
      </BotonEnlace>
    </section>
  );
}

/**
 * Fuera de España no hay botón de conectar: Stripe abriría la cuenta, pero la
 * página de dar no ofrecería la tarjeta (decisión 4), y la iglesia habría dado
 * sus datos a Stripe para nada. Lo que sí tiene es la transferencia, que es lo
 * que su gente puede usar hoy.
 */
function FueraDeEspana({ pastor }: { pastor: boolean }) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 md:p-6">
      <IconoTarjeta>
        <Globe strokeWidth={1.8} />
      </IconoTarjeta>
      <h2 className="t-subtitulo text-balance">
        Por ahora, solo para iglesias de España
      </h2>
      <p className="text-body text-pretty text-muted-foreground">
        Las ofrendas con tarjeta van con Stripe, en euros, y de momento solo
        pueden usarlas las iglesias de España.
      </p>
      <p className="text-body text-pretty text-muted-foreground">
        Tu congregación puede seguir dando por transferencia a la cuenta que
        aparece en la web de la iglesia
        {pastor ? ', la que pones en Ajustes.' : '. La pone el pastor en Ajustes.'}
      </p>
      {pastor && (
        <BotonEnlace href="/panel/ajustes#cuentaDonativos" variant="outline">
          Ver la cuenta en Ajustes
        </BotonEnlace>
      )}
    </section>
  );
}

// ============================================================================
// Conectada
// ============================================================================

/**
 * Dos por dos en el móvil, como el super admin, salvo las dos cantidades en
 * euros, que van a lo ancho: «1.240,00 €» con la letra de las cifras no cabe
 * en media pantalla de 390 px. Cuatro en fila desde 1280; por debajo no caben
 * las cantidades.
 */
function CifrasDelMes({ r }: { r: ResumenEnLinea }) {
  const { total, pagos, personas, comisiones } = r.mes;
  return (
    <section aria-labelledby="cifras-mes">
      <h2 id="cifras-mes" className="sr-only">
        Este mes
      </h2>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Cifra
          etiqueta="Este mes"
          valor={formatearEuros(Number(total))}
          className="col-span-2 sm:col-span-1"
        >
          <Detalle>{pagos === 1 ? '1 pago' : `${pagos} pagos`}</Detalle>
        </Cifra>
        <Cifra etiqueta="Personas" valor={personas}>
          <Detalle>{personas === 1 ? 'ha dado este mes' : 'han dado este mes'}</Detalle>
        </Cifra>
        <Cifra etiqueta="Cada mes" valor={r.mensualesActivos}>
          <Detalle>
            {r.mensualesActivos === 1 ? 'ofrenda mensual' : 'ofrendas mensuales'}
          </Detalle>
        </Cifra>
        <Cifra
          etiqueta="Comisiones"
          valor={formatearEuros(Number(comisiones))}
          className="col-span-2 sm:col-span-1"
        >
          <Detalle>Las cobra Stripe. Hatril, nada.</Detalle>
        </Cifra>
      </div>
    </section>
  );
}

function Detalle({ children }: { children: React.ReactNode }) {
  return <span className="text-label text-muted-foreground">{children}</span>;
}

function LoUltimo({ recientes }: { recientes: DonativoReciente[] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="t-subtitulo">Lo último</h2>
        {recientes.length > 0 && (
          <span className="text-label text-muted-foreground">
            {recientes.length === 1 ? 'Un pago' : `Los ${recientes.length} más recientes`}
          </span>
        )}
      </div>

      {recientes.length === 0 ? (
        <EstadoVacio Icono={HandCoins} titulo="Todavía no ha entrado nada">
          Cuando alguien dé con tarjeta, saldrá aquí con su nombre. En
          Movimientos entra solo, como un ingreso más y sin nombre.
        </EstadoVacio>
      ) : (
        <ul className="flex flex-col">
          {recientes.map((d) => (
            <FilaDonativo key={d.id} d={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Un pago, con sus líneas debajo (hasta tres: un diezmo y dos ofrendas, por
 * ejemplo). Con más de una, cada línea lleva su importe: el total de la
 * derecha incluye la comisión si la persona la cubrió, y así no parece que las
 * cuentas no cuadran.
 *
 * El nombre es el que escribió la persona al dar, que es obligatorio. Si dio
 * sin haber entrado en su cuenta se dice, con el correo al que fue el recibo:
 * ese nombre no lo respalda ninguna ficha.
 */
function FilaDonativo({ d }: { d: DonativoReciente }) {
  const devuelto = d.estado === 'reembolsado';
  const varias = d.lineas.length > 1;

  return (
    <li className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="w-12 flex-none pt-0.5 text-label text-muted-foreground tabular-nums">
        {fechaCorta(d.fecha)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-semibold">{d.donanteNombre}</span>
        {d.lineas.map((l, i) => (
          <span key={i} className="text-pretty text-label text-muted-foreground">
            {NOMBRE_TIPO[l.tipo]} · {l.fondo}
            {/* Sin partir: «· 50,00 €» solo en una línea quedaba huérfano. */}
            {varias && (
              <span className="whitespace-nowrap tabular-nums">
                {' '}
                · {formatearEuros(Number(l.importe))}
              </span>
            )}
          </span>
        ))}
        {!d.conCuenta && (
          <span className="truncate text-label text-muted-foreground">
            Sin cuenta · {d.donanteEmail}
          </span>
        )}
      </span>

      <span className="flex flex-none flex-col items-end gap-1.5">
        <span
          className={clsx(
            'text-body font-semibold tabular-nums',
            devuelto && 'text-muted-foreground line-through',
          )}
        >
          {formatearEuros(Number(d.total))}
        </span>
        {d.periodicidad === 'mensual' && <Insignia>Cada mes</Insignia>}
        {devuelto && <Insignia tono="aviso">Devuelto</Insignia>}
      </span>
    </li>
  );
}

/** Lo que ve en lugar de los pagos quien lleva la caja sin ser pastor ni tesorero. */
function SinDonantes() {
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 md:p-6">
      <IconoTarjeta>
        <EyeOff strokeWidth={1.8} />
      </IconoTarjeta>
      <h2 className="t-subtitulo text-balance">
        Quién da lo ven el pastor y tesorería
      </h2>
      <p className="text-body text-pretty text-muted-foreground">
        Que alguien dé a la iglesia dice que pertenece a ella, y eso es un dato
        protegido. Por eso aquí no salen los pagos ni los nombres.
      </p>
      <p className="text-body text-pretty text-muted-foreground">
        Cada pago entra solo en Movimientos, como un ingreso más y sin nombre.
        Ahí sí lo ves.
      </p>
    </section>
  );
}

function NotaPrivacidad() {
  return (
    <p className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-3 text-pretty text-label text-muted-foreground">
      <EyeOff className="mt-px size-4 flex-none text-support" strokeWidth={1.8} aria-hidden />
      <span>
        Solo el pastor y tesorería ven quién da. En Movimientos cada pago entra
        solo, sin nombre.
      </span>
    </p>
  );
}

/**
 * Los fondos de Finanzas que salen al dar. Son los mismos de siempre; aquí
 * solo se elige cuáles se ofrecen.
 *
 * Cada interruptor es su propio formulario y lleva el valor AL QUE cambia
 * (ver la action). El general va el primero, encendido y sin poder tocarlo.
 */
function Fondos({
  fondos,
  pastor,
}: {
  fondos: ResumenEnLinea['fondos'];
  pastor: boolean;
}) {
  const otros = fondos.filter((f) => !f.esGeneral);
  const general = fondos.find((f) => f.esGeneral);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
        <h2 className="t-subtitulo">Fondos que se pueden elegir</h2>
        <p className="text-pretty text-label text-muted-foreground">
          Al dar, cada persona elige a qué va su dinero.
        </p>
      </div>

      <ul className="flex flex-col">
        {general && (
          <li className="border-b border-border last:border-b-0">
            <InterruptorFondo nombre="Donde más falte" encendido fijo />
          </li>
        )}
        {otros.map((f) => (
          <li key={f.id} className="border-b border-border last:border-b-0">
            <form action={cambiarFondoEnDonativos}>
              <input type="hidden" name="fondoId" value={f.id} />
              <input type="hidden" name="enDonativos" value={f.enDonativos ? 'no' : 'si'} />
              <InterruptorFondo nombre={f.nombre} encendido={f.enDonativos} />
            </form>
          </li>
        ))}
      </ul>

      {/* Sin ninguno, Finanzas no se ha empezado: lo dice el aviso de arriba. */}
      {!general && otros.length === 0 && (
        <p className="px-4 py-3 text-pretty text-label text-muted-foreground">
          Todavía no hay fondos.
        </p>
      )}

      {/* Solo el general: se dice qué hacer para tener más, y dónde. Crear un
          fondo es del pastor (Fondos y cajas rebota a los demás). */}
      {general && otros.length === 0 && (
        <p className="border-t border-border px-4 py-3 text-pretty text-label text-muted-foreground">
          {pastor ? (
            <>
              Si creas Misiones o Construcción en{' '}
              <Link href="/panel/finanzas/ajustes">Fondos y cajas</Link>, podrás
              ofrecerlos aquí.
            </>
          ) : (
            'Si el pastor crea Misiones o Construcción en Fondos y cajas, podrás ofrecerlos aquí.'
          )}
        </p>
      )}
    </section>
  );
}

/** «18 nov». La fecha se parte a mano: `new Date('2026-11-18')` es medianoche UTC y en Bogotá saldría el 17. */
function fechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a!, m! - 1, d!)
    .toLocaleDateString('es', { day: 'numeric', month: 'short' })
    .replace('.', '');
}
