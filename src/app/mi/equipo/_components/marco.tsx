import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { UserContext } from '@/lib/auth/user-context';
import { Aviso } from '@/components/aviso';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';

/**
 * Las piezas de la zona de equipos, copiadas de la guía visual
 * (`docs/diseno/guia-visual.md`) y de sus pantallas de referencia: la agenda y
 * el muro de `/mi`, y turnos y repertorio en el panel. Viven aquí y no en
 * `components/` porque la fase 2 de esa guía trae las compartidas
 * (`Insignia`, `BotonEnlace`, `Campo`); cuando lleguen, estas se cambian por
 * aquellas.
 */

/**
 * El marco de cada pantalla: la cabecera de `/mi`, la columna de 620 px y los
 * avisos de las actions.
 *
 * El mismo ancho, relleno y hueco que la agenda. Con otros, al pasar de la
 * pestaña «Agenda» a «Equipo» el contenido saltaría de sitio.
 *
 * Los avisos van arriba y siempre aquí, para que ninguna pantalla se olvide de
 * pintar el `?error=` con el que vuelve una action: sin él, un «no puedes
 * guardar en solo lectura» se queda en la URL y la persona cree que guardó.
 */
export function MarcoEquipo({
  ctx,
  titulo,
  subtitulo,
  volver,
  conLogo = false,
  error,
  ok,
  children,
}: {
  ctx: UserContext;
  titulo: string;
  subtitulo?: string;
  volver?: string;
  /**
   * El logo de la iglesia a la izquierda, como en la raíz de cada pestaña de
   * `/mi` (el muro, la agenda). Las pantallas de dentro llevan la flecha de
   * volver en su lugar, como la ficha de un turno en la agenda.
   */
  conLogo?: boolean;
  error?: string;
  /** El texto de confirmación, ya resuelto desde `?guardado=`. */
  ok?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={ctx.user}
        titulo={titulo}
        subtitulo={subtitulo}
        volver={volver}
        logoUrl={conLogo && !volver ? ctx.iglesia.logoUrl : undefined}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {children}
      </main>
    </div>
  );
}

/**
 * Un grupo con su rótulo encima, fuera de la tarjeta: «Próximos»,
 * «Anteriores». Es el de la agenda, en `t-micro`.
 */
export function Seccion({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="t-micro px-1">{rotulo}</h2>
      {children}
    </section>
  );
}

/** Una tarjeta con filas separadas por una línea: la lista por defecto. */
export function Lista({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {children}
    </ul>
  );
}

/** Una fila de `Lista`. */
export function Fila({ children }: { children: React.ReactNode }) {
  return <li className="border-b border-border last:border-b-0">{children}</li>;
}

/**
 * Una fila que lleva a otra pantalla, con su flecha.
 *
 * La fila entera es el enlace y lleva `text-foreground`: `globals.css` pinta
 * de naranja todo `<a>`, y sin esto el título y los datos saldrían naranjas.
 */
export function FilaEnlace({
  href,
  children,
  derecha,
}: {
  href: string;
  children: React.ReactNode;
  /** Lo que va pegado a la flecha: una insignia. */
  derecha?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      {derecha}
      <ChevronRight
        className="size-4 flex-none text-disabled-text"
        strokeWidth={1.8}
        aria-hidden
      />
    </Link>
  );
}

/**
 * El estado vacío: qué es esto, qué hay que hacer y el botón para hacerlo.
 * El botón va siempre de contorno, aunque la misma acción esté arriba en
 * naranja.
 */
export function Vacio({
  titulo,
  children,
  accion,
}: {
  titulo: string;
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
      <h2 className="t-subtitulo">{titulo}</h2>
      <p className="max-w-[56ch] text-pretty text-body leading-relaxed text-muted-foreground">
        {children}
      </p>
      {accion}
    </div>
  );
}

/**
 * La zona de borrar: tarjeta propia al final, con sus consecuencias y el botón
 * `destructive`. Es la de «Borrar» en eventos.
 */
export function ZonaDeBorrar({
  titulo,
  children,
  boton,
}: {
  titulo: string;
  children: React.ReactNode;
  boton: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-danger-border bg-danger-soft p-5">
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">{titulo}</h2>
        <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">
          {children}
        </p>
      </div>
      {boton}
    </section>
  );
}
