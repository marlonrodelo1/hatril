'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { CircleAlert, Delete, Lock, Pencil, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import {
  MAXIMO_LINEA,
  MAX_LINEAS,
  MINIMO_LINEA,
  NOMBRE_TIPO,
  TIPOS_DONATIVO,
  aCentimos,
  comisionACubrir,
  formatearEuros,
  type TipoDonativo,
} from '@/lib/donativos/calculo';
import type { EstadoDar } from '../actions';
import { claveBorrador } from '../_lib/borrador';
import { Transferencia } from './transferencia';

/**
 * El formulario de la página de dar: un teclado y un ticket.
 *
 * POR QUÉ ASÍ Y NO CAMPOS
 * -----------------------
 * La primera versión eran tarjetas con un campo de cantidad, cuatro atajos y un
 * desplegable, una por línea, y Marlon la vio «muy genérica» (19-nov). Esta es
 * la que aprobó: arriba se compone UNA línea como en una app de pagos —diezmo
 * u ofrenda, la cantidad en grande con su teclado, el destino de un toque— y
 * abajo la cesta se va escribiendo como un ticket. Tocar una línea del ticket
 * la vuelve a traer arriba para cambiarla. Referencias de 21st: «Animate
 * Digits» para las cifras y «Receipt Pricing» para el ticket.
 *
 * El modelo no cambia: siguen siendo hasta tres líneas con tipo, fondo e
 * importe, que viajan en JSON como lee `leerFormularioDonativo`. Lo único nuevo
 * es cuál se está editando (`activa`).
 *
 * EL TECLADO Y EL TECLADO DEL MÓVIL
 * ---------------------------------
 * La cifra grande es un dibujo (`aria-hidden`) y el dato vive en un `<input>`
 * oculto a la vista pero no al lector de pantalla ni al teclado físico. Lleva
 * `inputMode="none"` para que el móvil no abra el suyo encima del nuestro; en
 * un ordenador se escribe con las teclas de siempre. Las dos vías pasan por las
 * mismas reglas (`limpiarImporte`).
 *
 * TODO EN EL ESTADO DEL CLIENTE, Y LA ACTION NO REDIRIGE CON ERRORES
 * ------------------------------------------------------------------
 * Con `useActionState` la action contesta `{ error }` y nada se mueve de su
 * sitio. El envío se lanza a mano (`startTransition` en `onSubmit`) y no con
 * `<form action>`, porque React vacía un formulario de action al terminar.
 *
 * LO QUE SE COMPRUEBA AQUÍ ES LO MISMO QUE EN EL SERVIDOR
 * -------------------------------------------------------
 * Mismos topes de `calculo.ts` y mismos mensajes de `validacion.ts`. El
 * servidor lo vuelve a mirar todo, y lo que se cobra lo calcula él.
 *
 * AL VOLVER DE STRIPE SIN PAGAR, LO ESCRITO SIGUE AHÍ
 * ---------------------------------------------------
 * Justo antes de ir a Stripe se guarda en `sessionStorage`; con `?cancelado=1`
 * se recupera una vez y se borra.
 */

type Linea = { clave: number; tipo: TipoDonativo; fondoId: string; importe: string };
type Periodicidad = 'una' | 'mensual';
type Fondo = { id: string; nombre: string; esGeneral: boolean };

const ATAJOS = [10, 20, 50, 100] as const;
const DONDE_MAS_FALTE = 'Donde más falte';
/** 10.000 € tiene cinco cifras: no hace falta dejar escribir una sexta. */
const CIFRAS_ENTERAS = String(MAXIMO_LINEA).length;

/** Lo mismo que hace `validacion.ts`: quita espacios y cambia UNA coma por punto. */
function aNumero(texto: string): number {
  return Number(texto.trim().replace(',', '.'));
}

function errorDeImporte(texto: string): string | undefined {
  if (!texto.trim()) return 'Escribe cuánto.';
  const n = aNumero(texto);
  if (!Number.isFinite(n)) return 'Escribe la cantidad con números.';
  if (n < MINIMO_LINEA) return `Cada línea, como mínimo ${MINIMO_LINEA} €.`;
  if (n > MAXIMO_LINEA) {
    return `Cada línea, como mucho ${MAXIMO_LINEA.toLocaleString('es-ES')} €.`;
  }
  if (Math.abs(n * 100 - Math.round(n * 100)) >= 1e-6) return 'Como mucho, dos decimales.';
  return undefined;
}

function errorDeNombre(texto: string): string | undefined {
  return texto.trim() ? undefined : 'Escribe tu nombre.';
}

function errorDeCorreo(texto: string): string | undefined {
  // Laxo a propósito: solo caza lo evidente. El que decide es el servidor.
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto.trim())
    ? undefined
    : 'Revisa el correo: ahí llega el recibo.';
}

/** Céntimos de una línea, solo si el servidor la aceptaría tal cual. */
function centimosDe(texto: string): number {
  return errorDeImporte(texto) ? 0 : aCentimos(aNumero(texto));
}

/**
 * Lo que se puede escribir, por el teclado de la pantalla o por el físico: solo
 * cifras y una coma (un punto se convierte en coma, como se escribe aquí), dos
 * decimales como mucho, cinco cifras enteras como mucho y sin ceros delante.
 */
function limpiarImporte(texto: string): string {
  const limpio = texto.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [entera = '', ...resto] = limpio.split(',');
  const sinCeros = entera.replace(/^0+(?=\d)/, '').slice(0, CIFRAS_ENTERAS);
  if (resto.length === 0) return sinCeros;
  return `${sinCeros || '0'},${resto.join('').slice(0, 2)}`;
}

/** «1250,5» se dibuja «1.250,5», igual que lo pinta `formatearEuros`. */
function paraDibujar(texto: string): string {
  if (!texto) return '0';
  const [entera = '', decimales] = texto.split(',');
  const agrupada = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimales === undefined ? agrupada : `${agrupada},${decimales}`;
}

type Borrador = {
  periodicidad: Periodicidad;
  lineas: { tipo: TipoDonativo; fondoId: string; importe: string }[];
  cubrir: boolean;
  nombre: string;
  email: string;
};

export function FormularioDar({
  accion,
  slug,
  iglesiaNombre,
  fondos,
  transferencia,
  inicial,
  cancelado,
  cabecera,
}: {
  accion: (previo: EstadoDar, formData: FormData) => Promise<EstadoDar>;
  slug: string;
  iglesiaNombre: string;
  /** El general primero (`paginaDeDar` ya los ordena así). */
  fondos: Fondo[];
  transferencia: { cuenta: string; titular: string | null } | null;
  /** Con sesión, el nombre y el correo de la cuenta; si no, vacíos. */
  inicial: { nombre: string; email: string };
  /** Vuelve de Stripe sin haber pagado. */
  cancelado: boolean;
  cabecera: ReactNode;
}) {
  const general = fondos.find((f) => f.esGeneral) ?? fondos[0]!;
  const nombreFondo = (id: string) => {
    const f = fondos.find((x) => x.id === id);
    return !f || f.esGeneral ? DONDE_MAS_FALTE : f.nombre;
  };

  const siguienteClave = useRef(1);
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('una');
  // 50 € de diezmo a «Donde más falte»: lo que se aprobó en la presentación.
  const [lineas, setLineas] = useState<Linea[]>([
    { clave: 0, tipo: 'diezmo', fondoId: general.id, importe: '50' },
  ]);
  const [activa, setActiva] = useState(0);
  const [cubrir, setCubrir] = useState(false);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [email, setEmail] = useState(inicial.email);
  const [errores, setErrores] = useState<{
    lineas: Record<number, string | undefined>;
    nombre?: string;
    email?: string;
  }>({ lineas: {} });

  const [estado, enviar, enviando] = useActionState(accion, { error: null });

  const id = useId();
  const idImporte = `${id}-importe`;
  const almacen = claveBorrador(slug);
  const avisoServidor = useRef<HTMLDivElement>(null);
  const compositor = useRef<HTMLDivElement>(null);
  const enviandoRef = useRef(false);
  useEffect(() => {
    enviandoRef.current = enviando;
  }, [enviando]);

  // Al volver de Stripe sin pagar, lo que había. Una sola vez, y se borra.
  useEffect(() => {
    if (!cancelado) return;
    let borrador: Borrador | null = null;
    try {
      const crudo = window.sessionStorage.getItem(almacen);
      window.sessionStorage.removeItem(almacen);
      borrador = crudo ? (JSON.parse(crudo) as Borrador) : null;
    } catch {
      borrador = null;
    }
    if (!borrador || !Array.isArray(borrador.lineas) || borrador.lineas.length === 0) return;

    // Un fondo que ya no se ofrece vuelve a «Donde más falte» en vez de mandar
    // un id que el servidor rechazaría.
    const vigentes = new Set(fondos.map((f) => f.id));
    const recuperadas = borrador.lineas.slice(0, MAX_LINEAS).map((l, i) => ({
      clave: i,
      tipo: TIPOS_DONATIVO.includes(l.tipo) ? l.tipo : 'ofrenda',
      fondoId: vigentes.has(l.fondoId) ? l.fondoId : general.id,
      importe: typeof l.importe === 'string' ? limpiarImporte(l.importe) : '',
    }));
    siguienteClave.current = recuperadas.length;
    /* eslint-disable react-hooks/set-state-in-effect -- es leer `sessionStorage`,
       que no existe en el servidor: hacerlo al pintar descuadraría la hidratación. */
    setLineas(recuperadas);
    setActiva(recuperadas.at(-1)!.clave);
    setPeriodicidad(borrador.periodicidad === 'mensual' ? 'mensual' : 'una');
    setCubrir(borrador.cubrir === true);
    if (typeof borrador.nombre === 'string' && borrador.nombre) setNombre(borrador.nombre);
    if (typeof borrador.email === 'string' && borrador.email) setEmail(borrador.email);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cancelado, almacen, fondos, general.id]);

  /*
   * Volver de Stripe con «Atrás» puede sacar la página de la caché de Safari
   * con el botón congelado en «Abriendo el pago…». Con borrador, no llegó a
   * gracias: se trata como el «Volver» de Stripe. Sin él, pagó: página nueva.
   */
  useEffect(() => {
    function alVolver(e: PageTransitionEvent) {
      if (!e.persisted || !enviandoRef.current) return;
      let conBorrador = false;
      try {
        conBorrador = window.sessionStorage.getItem(almacen) !== null;
      } catch {
        conBorrador = false;
      }
      if (conBorrador) window.location.replace(`${window.location.pathname}?cancelado=1`);
      else window.location.reload();
    }
    window.addEventListener('pageshow', alVolver);
    return () => window.removeEventListener('pageshow', alVolver);
  }, [almacen]);

  useEffect(() => {
    if (estado.error) avisoServidor.current?.scrollIntoView({ block: 'nearest' });
  }, [estado]);

  const linea = lineas.find((l) => l.clave === activa) ?? lineas[0]!;
  const errorActiva = errores.lineas[linea.clave];
  const baseCent = lineas.reduce((s, l) => s + centimosDe(l.importe), 0);
  const base = baseCent / 100;
  const comision = comisionACubrir(base);
  const total = (baseCent + (cubrir ? aCentimos(comision) : 0)) / 100;
  const mensual = periodicidad === 'mensual';
  const hoy = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date());

  function cambiarActiva(cambio: Partial<Omit<Linea, 'clave'>>) {
    const clave = linea.clave;
    setLineas((antes) => antes.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
    // Un error a la vista se quita en cuanto se arregla.
    if (cambio.importe !== undefined && errores.lineas[clave]) {
      const nuevo = errorDeImporte(cambio.importe);
      setErrores((e) => ({ ...e, lineas: { ...e.lineas, [clave]: nuevo } }));
    }
  }

  function pulsar(tecla: string) {
    if (tecla === 'borrar') {
      cambiarActiva({ importe: linea.importe.slice(0, -1) });
      return;
    }
    cambiarActiva({ importe: limpiarImporte(linea.importe + tecla) });
  }

  function anadir() {
    if (lineas.length >= MAX_LINEAS) return;
    // Antes de abrir otra, la que se estaba escribiendo tiene que valer: si no,
    // el ticket guardaría una línea a cero que luego frena el envío.
    const error = errorDeImporte(linea.importe);
    if (error) {
      setErrores((e) => ({ ...e, lineas: { ...e.lineas, [linea.clave]: error } }));
      return;
    }
    // Un fondo que todavía no esté en otra línea, si lo hay: quien añade una
    // segunda casi siempre es para Misiones o para el templo.
    const usados = new Set(lineas.map((l) => l.fondoId));
    const libre = fondos.find((f) => !f.esGeneral && !usados.has(f.id));
    const clave = siguienteClave.current++;
    setLineas((antes) => [
      ...antes,
      { clave, tipo: 'ofrenda', fondoId: libre?.id ?? general.id, importe: '10' },
    ]);
    setActiva(clave);
    compositor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function editar(clave: number) {
    setActiva(clave);
    compositor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function quitar(clave: number) {
    const quedan = lineas.filter((l) => l.clave !== clave);
    setLineas(quedan);
    if (clave === activa) setActiva(quedan.at(-1)!.clave);
    setErrores((e) => ({ ...e, lineas: { ...e.lineas, [clave]: undefined } }));
  }

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;

    const deLineas: Record<number, string | undefined> = {};
    for (const l of lineas) deLineas[l.clave] = errorDeImporte(l.importe);
    const nuevos = {
      lineas: deLineas,
      nombre: errorDeNombre(nombre),
      email: errorDeCorreo(email),
    };
    setErrores(nuevos);

    const conError = lineas.find((l) => deLineas[l.clave]);
    if (conError) {
      setActiva(conError.clave);
      document.getElementById(idImporte)?.focus();
      compositor.current?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const primero = nuevos.nombre ? `${id}-nombre` : nuevos.email ? `${id}-email` : null;
    if (primero) {
      document.getElementById(primero)?.focus();
      return;
    }

    const borrador: Borrador = {
      periodicidad,
      lineas: lineas.map(({ tipo, fondoId, importe }) => ({ tipo, fondoId, importe })),
      cubrir,
      nombre,
      email,
    };
    try {
      window.sessionStorage.setItem(almacen, JSON.stringify(borrador));
    } catch {
      // Sin `sessionStorage`, al volver de Stripe se empieza de cero.
    }

    const datos = new FormData(e.currentTarget);
    startTransition(() => enviar(datos));
  }

  const dibujo = paraDibujar(linea.importe);

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-1 flex-col">
      <input
        type="hidden"
        name="lineas"
        value={JSON.stringify(
          lineas.map(({ tipo, fondoId, importe }) => ({ tipo, fondoId, importe })),
        )}
      />
      <input type="hidden" name="periodicidad" value={periodicidad} />

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-4 pt-5 pb-6 sm:px-5 sm:pt-10">
        {cabecera}

        {cancelado && (
          <Aviso tipo="info">
            No se ha cobrado nada. Puedes cambiar lo que quieras y volver a
            intentarlo.
          </Aviso>
        )}

        {/* ---------------- La línea que se está componiendo ---------------- */}
        <div ref={compositor} className="flex scroll-mt-4 flex-col gap-3.5">
          <Segmentado
            etiqueta="Qué es"
            opciones={TIPOS_DONATIVO.map((t) => ({ id: t, texto: NOMBRE_TIPO[t] }))}
            valor={linea.tipo}
            alCambiar={(t) => cambiarActiva({ tipo: t })}
          />

          <div className="flex flex-col items-center gap-1">
            {/* El dato de verdad, para el lector de pantalla y el teclado físico. */}
            <input
              id={idImporte}
              type="text"
              inputMode="none"
              autoComplete="off"
              value={linea.importe}
              aria-invalid={errorActiva ? true : undefined}
              aria-describedby={errorActiva ? `${id}-error` : undefined}
              onChange={(e) => cambiarActiva({ importe: limpiarImporte(e.currentTarget.value) })}
              onBlur={(e) => {
                const nuevo = errorDeImporte(e.currentTarget.value);
                if (nuevo !== errores.lineas[linea.clave]) {
                  setErrores((x) => ({ ...x, lineas: { ...x.lineas, [linea.clave]: nuevo } }));
                }
              }}
              className="peer sr-only"
            />
            {/* La cifra que se ve. Cada carácter es su propio `span` con una
                clave de posición y valor: solo se anima el que cambia. */}
            <label
              htmlFor={idImporte}
              className={clsx(
                'flex cursor-text items-baseline justify-center gap-1.5 rounded-xl px-4 py-1 tabular-nums',
                'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/20',
                errorActiva && 'anim-tiembla',
              )}
            >
              <span className="sr-only">Cantidad en euros</span>
              <span
                aria-hidden
                className={clsx(
                  'flex overflow-hidden t-display',
                  linea.importe ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {dibujo.split('').map((c, i) => (
                  <span key={`${i}-${c}`} className="anim-aparece inline-block">
                    {c}
                  </span>
                ))}
              </span>
              <span aria-hidden className="t-titulo text-muted-foreground">
                €
              </span>
            </label>
            {errorActiva && (
              <span
                id={`${id}-error`}
                role="alert"
                className="anim-aparece flex items-center gap-1.5 text-label font-semibold text-badge-danger-fg"
              >
                <CircleAlert className="size-[15px] flex-none" strokeWidth={1.9} />
                {errorActiva}
              </span>
            )}
          </div>

          <div role="group" aria-label="Cantidades rápidas" className="flex justify-center gap-1.5">
            {ATAJOS.map((c) => (
              <Opcion
                key={c}
                elegida={aNumero(linea.importe) === c}
                onClick={() => cambiarActiva({ importe: String(c) })}
                className="tabular-nums"
              >
                {c} €
              </Opcion>
            ))}
          </div>

          <Teclado alPulsar={pulsar} />

          {fondos.length > 1 ? (
            <div role="group" aria-label="Para qué" className="flex flex-wrap justify-center gap-1.5">
              {fondos.map((f) => (
                <Opcion
                  key={f.id}
                  elegida={linea.fondoId === f.id}
                  onClick={() => cambiarActiva({ fondoId: f.id })}
                >
                  {f.esGeneral ? DONDE_MAS_FALTE : f.nombre}
                </Opcion>
              ))}
            </div>
          ) : (
            <p className="text-center text-label text-muted-foreground">
              Para <span className="font-semibold text-foreground">{DONDE_MAS_FALTE}</span>
            </p>
          )}
        </div>

        {/* ---------------- El ticket ---------------- */}
        <section
          aria-label="Tu ofrenda"
          className="flex flex-col rounded-xl border border-border bg-surface px-4 pt-3 pb-1"
        >
          <div className="flex items-baseline justify-between pb-1.5 text-micro text-muted-foreground">
            <span className="uppercase tracking-[0.08em]">Tu ofrenda</span>
            <span>{hoy}</span>
          </div>

          <ul aria-live="polite" className="flex flex-col">
            {lineas.map((l) => (
              <FilaTicket
                key={l.clave}
                texto={`${NOMBRE_TIPO[l.tipo]} · ${nombreFondo(l.fondoId)}`}
                importe={
                  centimosDe(l.importe) > 0 ? formatearEuros(centimosDe(l.importe) / 100) : '—'
                }
                activa={l.clave === linea.clave && lineas.length > 1}
                conError={Boolean(errores.lineas[l.clave])}
                alEditar={() => editar(l.clave)}
                alQuitar={lineas.length > 1 ? () => quitar(l.clave) : undefined}
              />
            ))}
            {cubrir && base > 0 && (
              <li className="flex items-baseline gap-2 py-2 text-label text-muted-foreground">
                <span>Comisión de la tarjeta</span>
                <Puntos />
                <span className="tabular-nums whitespace-nowrap">{formatearEuros(comision)}</span>
              </li>
            )}
          </ul>

          <button
            type="button"
            onClick={anadir}
            disabled={lineas.length >= MAX_LINEAS}
            className="my-1.5 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-label font-semibold text-foreground outline-none transition-colors duration-150 hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:border-disabled-border disabled:text-disabled-text disabled:hover:bg-transparent motion-reduce:transition-none"
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden />
            {lineas.length >= MAX_LINEAS ? `Como mucho, ${MAX_LINEAS} en un pago` : 'Añadir otra'}
          </button>

          <div className="flex flex-col gap-2.5 border-t border-dashed border-border-strong py-3">
            <Casilla
              marcada={mensual}
              alCambiar={(v) => setPeriodicidad(v ? 'mensual' : 'una')}
              titulo="Repetir cada mes"
              ayuda="Se cobra lo mismo el mismo día de cada mes. Lo dejas cuando quieras desde el recibo."
            />
            {/* Sin marcar de entrada: es dinero de más, y lo decide quien da. */}
            <Casilla
              nombre="cubrir"
              marcada={cubrir}
              alCambiar={setCubrir}
              titulo={
                <>
                  Cubro la comisión de la tarjeta
                  {base > 0 && <span className="tabular-nums"> ({formatearEuros(comision)})</span>}
                </>
              }
              ayuda="Así le llega a la iglesia la cantidad entera."
            />
          </div>

          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border-strong py-3">
            <span className="text-body font-bold">{mensual ? 'Total, cada mes' : 'Total'}</span>
            <span className="t-titulo tabular-nums whitespace-nowrap">{formatearEuros(total)}</span>
          </div>
        </section>

        <section className="flex flex-col gap-3 pt-1">
          <h2 className="t-micro px-0.5">El recibo, a</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre" htmlFor={`${id}-nombre`} error={errores.nombre}>
              <Input
                id={`${id}-nombre`}
                name="nombre"
                autoComplete="name"
                maxLength={120}
                value={nombre}
                aria-invalid={errores.nombre ? true : undefined}
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  setErrores((x) => ({ ...x, nombre: errorDeNombre(v) }));
                }}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setNombre(v);
                  if (errores.nombre) setErrores((x) => ({ ...x, nombre: errorDeNombre(v) }));
                }}
              />
            </Campo>
            <Campo etiqueta="Correo" htmlFor={`${id}-email`} error={errores.email}>
              <Input
                id={`${id}-email`}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={200}
                value={email}
                aria-invalid={errores.email ? true : undefined}
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  setErrores((x) => ({ ...x, email: errorDeCorreo(v) }));
                }}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setEmail(v);
                  if (errores.email) setErrores((x) => ({ ...x, email: errorDeCorreo(v) }));
                }}
              />
            </Campo>
          </div>
        </section>

        {transferencia && (
          <Transferencia
            iglesiaNombre={iglesiaNombre}
            cuenta={transferencia.cuenta}
            titular={transferencia.titular}
            plegada
          />
        )}
      </div>

      {/*
       * El único naranja de la pantalla, abajo y siempre a mano, con el total
       * escrito. Pegado al borde: con el teclado arriba, el ticket queda debajo
       * del pliegue en un móvil, y el total tiene que verse sin bajar.
       */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4 pt-3 sm:px-5">
          {estado.error && !enviando && (
            <div ref={avisoServidor}>
              <Aviso>{estado.error}</Aviso>
            </div>
          )}
          <Button
            type="submit"
            size="lg"
            aria-busy={enviando || undefined}
            className={clsx('w-full tabular-nums', enviando && 'pointer-events-none')}
          >
            {enviando ? (
              <>
                <span
                  aria-hidden
                  className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none"
                />
                Abriendo el pago…
              </>
            ) : total > 0 ? (
              `Dar ${formatearEuros(total)}${mensual ? ' al mes' : ''}`
            ) : (
              'Dar'
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-micro text-pretty text-muted-foreground">
            <Lock className="size-3 flex-none" strokeWidth={1.8} aria-hidden />
            Pagas en la página segura de Stripe. Ni Hatril ni la iglesia ven tu tarjeta.
          </p>
        </div>
      </div>
    </form>
  );
}

/**
 * Diezmo u Ofrenda, con la pastilla que viaja. La forma de la guía
 * (`Segmentado` de la agenda): pista `rounded-xl border bg-surface p-1` y la
 * elegida en `bg-accent text-accent-foreground`.
 */
function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: { id: T; texto: string }[];
  valor: T;
  alCambiar: (v: T) => void;
}) {
  const indice = Math.max(0, opciones.findIndex((o) => o.id === valor));
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="relative grid rounded-xl border border-border bg-surface p-1"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-accent transition-transform duration-240 ease-hatril motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${opciones.length})`,
          transform: `translateX(${indice * 100}%)`,
        }}
      />
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          onClick={() => alCambiar(o.id)}
          className={clsx(
            'relative h-10 cursor-pointer rounded-lg text-label font-semibold outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
            valor === o.id ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/**
 * El teclado. Botones de 8 px como el resto, sin relleno de color: el único
 * naranja es «Dar». Doce teclas en tres columnas, como el de un teléfono.
 */
function Teclado({ alPulsar }: { alPulsar: (tecla: string) => void }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'borrar'];
  return (
    <div role="group" aria-label="Teclado" className="grid grid-cols-3 gap-1.5">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => alPulsar(t)}
          aria-label={t === 'borrar' ? 'Borrar la última cifra' : t === ',' ? 'Coma decimal' : undefined}
          className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-subtitle font-semibold tabular-nums text-foreground outline-none transition-colors duration-100 hover:bg-surface-alt active:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none"
        >
          {t === 'borrar' ? <Delete className="size-5" strokeWidth={1.8} aria-hidden /> : t}
        </button>
      ))}
    </div>
  );
}

/** Los puntos del ticket entre lo que es y lo que cuesta. */
function Puntos() {
  return <span aria-hidden className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-border-strong" />;
}

/**
 * Una línea del ticket. Tocarla la sube al teclado para cambiarla; la que se
 * está cambiando lleva el lápiz y el color de lo elegido.
 */
function FilaTicket({
  texto,
  importe,
  activa,
  conError,
  alEditar,
  alQuitar,
}: {
  texto: string;
  importe: string;
  activa: boolean;
  conError: boolean;
  alEditar: () => void;
  alQuitar?: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={alEditar}
        aria-current={activa || undefined}
        className={clsx(
          '-mx-2 flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded-lg px-2 py-2 text-left text-label outline-none transition-colors duration-150 hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
          activa && 'bg-accent text-accent-foreground hover:bg-accent',
        )}
      >
        {conError ? (
          <CircleAlert className="size-[14px] flex-none self-center text-badge-danger-fg" strokeWidth={1.9} aria-label="Revisa esta línea" />
        ) : activa ? (
          <Pencil className="size-[13px] flex-none self-center" strokeWidth={1.8} aria-hidden />
        ) : null}
        <span className="min-w-0 truncate">{texto}</span>
        <Puntos />
        <span className="tabular-nums whitespace-nowrap font-semibold">{importe}</span>
      </button>
      {alQuitar && (
        <button
          type="button"
          onClick={alQuitar}
          aria-label={`Quitar ${texto}`}
          className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-surface-active hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
      )}
    </li>
  );
}

function Casilla({
  nombre,
  marcada,
  alCambiar,
  titulo,
  ayuda,
}: {
  nombre?: string;
  marcada: boolean;
  alCambiar: (v: boolean) => void;
  titulo: ReactNode;
  ayuda: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-label text-foreground">
      <input
        type="checkbox"
        name={nombre}
        checked={marcada}
        onChange={(e) => alCambiar(e.currentTarget.checked)}
        className="mt-0.5 flex-none"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{titulo}</span>
        <span className="text-pretty text-muted-foreground">{ayuda}</span>
      </span>
    </label>
  );
}

/**
 * Una opción en píldora: las cantidades rápidas y los destinos. La de la guía
 * (`OpcionAtajo` de la ficha del super admin): elegida en `bg-accent
 * text-accent-foreground` con borde naranja. Píldora porque es una opción, no
 * un botón (los botones van a 8 px).
 */
function Opcion({
  elegida,
  onClick,
  className,
  children,
}: {
  elegida: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className={clsx(
        'h-9 cursor-pointer rounded-full border px-3.5 text-label whitespace-nowrap outline-none',
        'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
        elegida
          ? 'border-primary bg-accent font-semibold text-accent-foreground'
          : 'border-border bg-surface-alt font-medium text-foreground hover:bg-surface-active',
        className,
      )}
    >
      {children}
    </button>
  );
}
