import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  CirclePause,
  CirclePlay,
  EyeOff,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';

import type { Apunte } from '@/lib/admin/registro';
import type { AccionAdmin } from '@/lib/db/schema';
import { ZONA_ADMIN } from './piezas';

/**
 * Una lista de apuntes del registro, como línea de tiempo. La usan la
 * pantalla Registro y el historial de cada ficha (iglesia y cuenta).
 *
 * Cada fila es una frase —«Suspendió Iglesia Sion»— y no una tabla de columnas
 * (acción, objeto, actor): el registro se lee para contestar una pregunta
 * concreta, y una frase la contesta sin tener que cruzar columnas.
 *
 * CADA ACCIÓN CON SU ICONO Y SU COLOR
 * -----------------------------------
 * Antes todas las filas se parecían y suspender y ampliar se distinguían solo
 * leyendo. Ahora: ampliar en verde, suspender en rojo, reactivar en naranja
 * suave, el directorio y las contraseñas en gris. Los colores son los de las
 * insignias, que ya están medidos para que el icono se lea sobre su fondo, y
 * el icono es distinto en cada una: el color solo no basta (regla 2).
 *
 * Aquí no hay ningún botón, ni lo habrá: el registro solo se añade, y la
 * pantalla que lo enseña tampoco toca nada.
 *
 * LAS PROPS NUEVAS SON OPCIONALES
 * -------------------------------
 * `apuntes` y `vacio` siguen siendo lo único obligatorio, y sin más se pinta
 * como en las fichas: en su tarjeta, sin agrupar, con día y hora en cada
 * apunte.
 */
export function ListaRegistro({
  apuntes,
  vacio,
  porDia = false,
  marco = true,
  dentroDe,
}: {
  apuntes: Apunte[];
  /** Qué decir cuando no hay nada, que depende de dónde se pinte. */
  vacio: string;
  /**
   * Agrupa por día, con el día de rótulo y solo la hora en cada apunte. Para
   * la pantalla Registro, donde se leen semanas seguidas.
   */
  porDia?: boolean;
  /**
   * Con su tarjeta alrededor (por defecto). Sin ella, para meterla dentro de
   * una tarjeta que ya existe o para dejarla sobre el fondo, como Registro.
   */
  marco?: boolean;
  /**
   * Si se pinta dentro de la ficha de una iglesia o de una cuenta: ahí el
   * objeto se sobreentiende, y «Suspendió la iglesia» se lee mejor que el
   * nombre enlazado a la misma página en la que ya se está.
   */
  dentroDe?: 'iglesia' | 'cuenta';
}) {
  if (apuntes.length === 0) {
    return (
      <p
        className={clsx(
          'text-label text-muted-foreground',
          marco && 'rounded-xl border border-border bg-surface px-4 py-3',
        )}
      >
        {vacio}
      </p>
    );
  }

  const ahora = new Date();
  const grupos = porDia
    ? agrupar(apuntes)
    : [{ clave: 'todo', rotulo: null, apuntes }];

  return (
    <div
      className={clsx(
        'flex flex-col',
        marco && 'rounded-xl border border-border bg-surface px-4 py-2 md:px-5',
      )}
    >
      {grupos.map((g, i) => (
        <section key={g.clave} className="flex flex-col">
          {g.rotulo && (
            <h3 className={clsx('t-micro px-0.5 pb-1.5', i === 0 ? 'pt-0' : 'pt-4')}>
              {g.rotulo}
            </h3>
          )}
          <ol className="flex flex-col">
            {g.apuntes.map((a, j) => (
              <ApunteEnLinea
                key={a.id}
                apunte={a}
                dentroDe={dentroDe}
                cuando={porDia ? hora(a.createdAt) : diaYHora(a.createdAt, ahora)}
                // La entrada escalonada se corta a los diez primeros: más
                // abajo ya no se ve al cargar y solo retrasaría lo que sí.
                retraso={Math.min(j, 10) * 25}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

const ACCIONES: Record<AccionAdmin, { Icono: LucideIcon; tono: string }> = {
  ampliar_prueba: {
    Icono: CalendarPlus,
    tono: 'bg-badge-success-bg text-badge-success-fg',
  },
  // El rojo de error y no el de la insignia: `badge-danger-fg` y
  // `badge-accent-fg` son dos marrones rojizos casi iguales, y en la primera
  // prueba suspender y reactivar, una encima de otra, solo se distinguían por
  // la forma del icono. `danger` sobre su fondo suave da 5.4:1.
  suspender_iglesia: {
    Icono: CirclePause,
    tono: 'bg-danger-soft text-danger',
  },
  reactivar_iglesia: {
    Icono: CirclePlay,
    tono: 'bg-badge-accent-bg text-badge-accent-fg',
  },
  sacar_del_directorio: {
    Icono: EyeOff,
    tono: 'bg-badge-neutral-bg text-badge-neutral-fg',
  },
  poner_contrasena: {
    Icono: KeyRound,
    tono: 'bg-badge-neutral-bg text-badge-neutral-fg',
  },
};

function ApunteEnLinea({
  apunte: a,
  dentroDe,
  cuando,
  retraso,
}: {
  apunte: Apunte;
  dentroDe?: 'iglesia' | 'cuenta';
  cuando: string;
  retraso: number;
}) {
  const { Icono, tono } = ACCIONES[a.accion];
  const cambio = a.accion === 'ampliar_prueba' ? cambioDeFecha(a.detalle) : null;

  return (
    <li
      // La línea que une los iconos sale de debajo de cada uno y llega al
      // siguiente; el último de cada día no la lleva.
      className="anim-aparece relative grid grid-cols-[34px_minmax(0,1fr)_auto] gap-x-3 py-2 before:absolute before:top-[46px] before:-bottom-1 before:left-[16.5px] before:border-l before:border-border last:before:hidden"
      style={{ '--retraso': `${retraso}ms` } as CSSProperties}
    >
      <span
        aria-hidden
        className={clsx('flex size-[34px] items-center justify-center rounded-lg', tono)}
      >
        <Icono className="size-4" strokeWidth={1.8} />
      </span>

      <span className="flex min-w-0 flex-col gap-0.5 pt-1.5">
        <span className="text-body font-semibold text-pretty break-words">
          <Frase apunte={a} dentroDe={dentroDe} />
        </span>
        <span className="truncate text-label text-muted-foreground">
          {[a.actor, a.ip ? `IP ${a.ip}` : null].filter(Boolean).join(' · ')}
        </span>
        {cambio && (
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-surface-alt px-2 py-0.5 text-label tabular-nums">
            {cambio.antes && (
              <>
                <s className="text-muted-foreground">
                  <span className="sr-only">Acababa el </span>
                  {cambio.antes}
                </s>
                <ArrowRight
                  className="size-3 flex-none text-muted-foreground"
                  strokeWidth={1.8}
                  aria-hidden
                />
              </>
            )}
            <span>
              <span className="sr-only">ahora acaba el </span>
              {cambio.despues}
            </span>
          </span>
        )}
      </span>

      <time
        dateTime={a.createdAt.toISOString()}
        className="pt-2 text-label whitespace-nowrap text-muted-foreground tabular-nums"
      >
        {cuando}
      </time>
    </li>
  );
}

function Frase({
  apunte: a,
  dentroDe,
}: {
  apunte: Apunte;
  dentroDe?: 'iglesia' | 'cuenta';
}): ReactNode {
  const iglesia =
    dentroDe === 'iglesia' ? null : a.iglesia ? (
      <Enlace href={`/admin/iglesias/${a.iglesia.id}`}>{a.iglesia.nombre}</Enlace>
    ) : (
      'una iglesia'
    );

  switch (a.accion) {
    case 'ampliar_prueba':
      return iglesia ? <>Amplió la prueba de {iglesia}</> : <>Amplió la prueba</>;
    case 'suspender_iglesia':
      return iglesia ? <>Suspendió {iglesia}</> : <>Suspendió la iglesia</>;
    case 'reactivar_iglesia':
      return iglesia ? <>Reactivó {iglesia}</> : <>Reactivó la iglesia</>;
    case 'sacar_del_directorio':
      return iglesia ? (
        <>Sacó {iglesia} del directorio</>
      ) : (
        <>Sacó la iglesia del directorio</>
      );
    case 'poner_contrasena':
      if (dentroDe === 'cuenta') return <>Le puso una contraseña provisional</>;
      return (
        <>
          Puso una contraseña provisional a{' '}
          {a.cuenta ? (
            <Enlace href={`/admin/cuentas/${a.cuenta.id}`}>{a.cuenta.email}</Enlace>
          ) : (
            'una cuenta'
          )}
        </>
      );
  }
}

/**
 * Un enlace dentro de la frase. En el color del texto (`globals.css` pinta de
 * naranja todo `<a>`, y el naranja es para acciones), con un subrayado tenue
 * que dice que se puede pulsar sin competir con la frase.
 */
function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-foreground underline decoration-border underline-offset-[3px] hover:text-foreground hover:decoration-current"
    >
      {children}
    </Link>
  );
}

/**
 * La fecha de antes y la nueva de una ampliación, desde los `YYYY-MM-DD` que
 * guarda la action (el día en la zona de la iglesia, ver su comentario). Sin
 * el año en la de antes cuando es el mismo: «15 nov → 30 nov 2026».
 */
function cambioDeFecha(
  detalle: Record<string, unknown>,
): { antes: string | null; despues: string } | null {
  const despues = aFecha(detalle.despuesDia);
  if (!despues) return null;
  const antes = aFecha(detalle.antesDia);
  const mismoAnio = antes?.getUTCFullYear() === despues.getUTCFullYear();
  return {
    antes: antes ? diaCorto(antes, !mismoAnio) : null,
    despues: diaCorto(despues, true),
  };
}

function aFecha(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  return new Date(`${valor}T12:00:00Z`);
}

/** «30 nov 2026» sin pasar por ninguna zona: el día ya viene decidido. */
function diaCorto(d: Date, conAnio: boolean): string {
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    ...(conAnio && { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

// ----------------------------------------------------------------------------
// Fechas del apunte: en la zona de la administración, como todo `/admin`.
// ----------------------------------------------------------------------------

/** «2026-10-29» en la zona de la administración: la clave de cada día. */
function claveDia(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: ZONA_ADMIN });
}

function agrupar(apuntes: Apunte[]) {
  const anioActual = claveDia(new Date()).slice(0, 4);
  const grupos: { clave: string; rotulo: string; apuntes: Apunte[] }[] = [];
  for (const a of apuntes) {
    const clave = claveDia(a.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.clave === clave) {
      ultimo.apuntes.push(a);
      continue;
    }
    // «jueves, 29 de octubre», y el año solo si no es este.
    const rotulo = a.createdAt.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(clave.slice(0, 4) !== anioActual && { year: 'numeric' }),
      timeZone: ZONA_ADMIN,
    });
    grupos.push({ clave, rotulo, apuntes: [a] });
  }
  return grupos;
}

function hora(d: Date): string {
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA_ADMIN,
  });
}

/** «29 oct, 12:29», y el año delante de la coma si no es este. */
function diaYHora(d: Date, ahora: Date): string {
  const otroAnio = claveDia(d).slice(0, 4) !== claveDia(ahora).slice(0, 4);
  const dia = d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    ...(otroAnio && { year: 'numeric' }),
    timeZone: ZONA_ADMIN,
  });
  return `${dia}, ${hora(d)}`;
}
