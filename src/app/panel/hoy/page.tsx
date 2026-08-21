import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  HandHeart,
  Inbox,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import {
  esPastor,
  puede,
  puedeGestionarEventos,
  puedeGestionarFinanzas,
} from '@/lib/auth/permisos';
import {
  nuevosSinMinisterio,
  resumenCongregacion,
  type RecienLlegado,
} from '@/lib/panel/inicio';
import { ministeriosSinResponsable } from '@/lib/ministerios/consultas';
import { listarSolicitudesPendientes } from '@/lib/solicitudes/consultas';
import { misTurnosPendientes } from '@/lib/devocionales/consultas';
import { formatearFechaLarga, mesEnLaIglesia } from '@/lib/fecha/hoy';
import { resumen as resumenFinanzas } from '@/lib/finanzas/consultas';
import { proximosEventos } from '@/lib/eventos/consultas';
import { formatearInstante } from '@/lib/fecha/zona';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';

export const metadata: Metadata = { title: 'Inicio' };

/**
 * Pantalla de entrada del panel.
 *
 * LO QUE PIDE ACCIÓN VA ARRIBA, Y SOLO SI EXISTE
 * ----------------------------------------------
 * Antes esto eran dos cifras —cuánta gente y cuántos ministerios— que no llevan
 * a ninguna parte: se leen, se asiente y se cierra. Lo que un pastor necesita al
 * abrir el panel un lunes no es cuánta gente tiene, sino de quién se está
 * olvidando.
 *
 * Cada aviso se pinta solo si tiene contenido. Que no haya nada arriba es la
 * mejor noticia posible, y una fila de ceros no la daría.
 *
 * CADA AVISO SE PIDE SOLO A QUIEN PUEDE VERLO
 * -------------------------------------------
 * Los recuentos son agregados y no revelan a nadie. Los avisos con NOMBRES se
 * consultan únicamente si esta persona tiene el permiso correspondiente —y no se
 * consultan «por si acaso» para luego ocultarlos: la consulta que no se hace es
 * la que no puede filtrar nada.
 *
 * QUÉ SIGUE SIN ESTAR
 * -------------------
 * Asistencia del domingo, donativos y próximos eventos. Son de la v2 y no hay
 * tablas: pintarlos con datos de ejemplo es la forma más rápida de que un pastor
 * deje de fiarse también de lo que sí es cierto.
 *
 * Los cumpleaños de la semana sí se pueden calcular —`fecha_nacimiento` está—,
 * pero son dato protegido y van con `ver_datos_sensibles` por medio. Segunda
 * pasada.
 */
export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bienvenida?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, bienvenida } = await searchParams;

  const puedeCrear = esPastor(ctx) || puede(ctx, 'editar_miembros');
  const puedeVerSolicitudes = esPastor(ctx) || puede(ctx, 'aprobar_solicitudes');
  const puedeGestionarMinisterios =
    esPastor(ctx) || puede(ctx, 'gestionar_ministerios');
  // Gente que no está en NINGÚN equipo: a quien solo ve sus ministerios no le
  // corresponde ni una de esas fichas, así que ni se pregunta.
  const puedeVerLaCongregacion =
    esPastor(ctx) || puede(ctx, 'ver_todos_los_miembros');


  const [resumen, solicitudes, sinResponsable, recienLlegados, misTurnos] =
    await Promise.all([
      resumenCongregacion(ctx),
      puedeVerSolicitudes ? listarSolicitudesPendientes(ctx) : [],
      puedeGestionarMinisterios ? ministeriosSinResponsable(ctx) : [],
      puedeVerLaCongregacion ? nuevosSinMinisterio(ctx) : [],
      // Sin condición de permiso: son SUS turnos. La consulta ya filtra por su
      // ficha, así que no puede devolver los de nadie más.
      misTurnosPendientes(ctx),
    ]);

  const hayAvisos =
    misTurnos.length > 0 ||
    solicitudes.length > 0 ||
    sinResponsable.length > 0 ||
    recienLlegados.length > 0;

  // El pastor vive en esta pantalla y es quien paga. Si el número de la caja no
  // le sale al paso aquí, no abre finanzas y no renueva. Solo se consulta a
  // quien puede verlo: para un líder de alabanza sería una consulta en cada
  // carga del panel para algo que no se pinta.
  const finanzas = await (async () => {
    if (!puedeGestionarFinanzas(ctx)) return null;
    const { desde, hasta, etiqueta } = mesEnLaIglesia(ctx.iglesia.timezone);
    const r = await resumenFinanzas(ctx, desde, hasta, etiqueta);
    const moneda = ctx.iglesia.moneda as Moneda;
    return {
      entro: formatearDinero(r.entro, moneda),
      salio: formatearDinero(r.salio, moneda),
    };
  })();

  // Lo que viene, para quien organiza. Un evento que nadie recuerda es un
  // evento al que no va nadie, y el pastor vive en esta pantalla: mismo
  // argumento que ya justifica el bloque de la caja.
  const eventosProximos = puedeGestionarEventos(ctx)
    ? await proximosEventos(ctx, 3)
    : [];

  const sirviendoPct =
    resumen.total > 0
      ? Math.round((resumen.sirviendo / resumen.total) * 100)
      : 0;

  const diasDeTrial = diasHasta(ctx.iglesia.trialUntil);

  /*
   * ¿Hay algo que llevar a la columna de la derecha?
   *
   * La caja y lo próximo son las dos cosas de esta pantalla que se MIRAN —una
   * cifra y tres fechas— frente a lo demás, que se PULSA. Van juntas a un lado
   * y así el resto ocupa el ancho.
   *
   * Pero solo si existen: a un líder de alabanza no le corresponde ninguna de
   * las dos, y una segunda columna vacía deja justo el hueco a la derecha que
   * se está intentando quitar. Sin ellas, una sola columna a todo lo ancho.
   */
  const hayLateral = finanzas !== null || eventosProximos.length > 0;

  return (
    <>
      <CabeceraPanel
        titulo={ctx.iglesia.nombre}
        subtitulo={ctx.iglesia.ciudad ?? 'Panel de la iglesia'}
      />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {bienvenida && (
          <Aviso tipo="ok">
            Tu iglesia ya está creada. Tienes siete días de prueba, sin tarjeta.
          </Aviso>
        )}

        {/* El trial solo al pastor: es quien paga y quien puede hacer algo. */}
        {esPastor(ctx) &&
          ctx.iglesia.plan === 'trial' &&
          diasDeTrial !== null &&
          diasDeTrial <= 7 && (
            <Aviso>
              {diasDeTrial <= 0
                ? 'Tu periodo de prueba ha terminado.'
                : diasDeTrial === 1
                  ? 'Te queda 1 día de prueba.'
                  : `Te quedan ${diasDeTrial} días de prueba.`}
            </Aviso>
          )}

        {/*
         * Dos columnas a partir de `xl` (1280 px), que es un portátil normal.
         * Por debajo, todo apilado como estaba: partir en dos una pantalla de
         * tableta da dos columnas estrechas y ninguna se lee bien.
         *
         * `items-start` para que la columna corta no se estire hasta la altura
         * de la larga; sin eso, la tarjeta de la caja crece hasta el fondo con
         * un palmo de vacío dentro.
         */}
        <div
          className={
            'grid items-start gap-6 ' +
            (hayLateral ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : '')
          }
        >
          <div className="flex min-w-0 flex-col gap-6">
          {/* ---------- Lo que pide algo ---------- */}
          {hayAvisos && (
            <section className="flex flex-col gap-3">
              <h2 className="t-micro">Te está esperando</h2>

              {/* Primero lo que tiene que hacer ESTA persona, antes de lo que
                  tiene que revisar. Un turno de devocional con fecha es lo único
                  de esta pantalla que vence. */}
              {misTurnos.length > 0 && (
                <Panel
                  Icono={BookOpen}
                  titulo={
                    misTurnos.length === 1
                      ? 'Te toca escribir el devocional'
                      : `Te tocan ${misTurnos.length} devocionales`
                  }
                  detalle={misTurnos
                    .map((t) => formatearFechaLarga(t.fecha))
                    .join(' · ')}
                  enlace={`/panel/devocionales?abrir=${misTurnos[0]!.id}`}
                  accion="Escribirlo"
                />
              )}

              {solicitudes.length > 0 && (
                <Panel
                  Icono={Inbox}
                  titulo={
                    solicitudes.length === 1
                      ? 'Una persona quiere unirse'
                      : `${solicitudes.length} personas quieren unirse`
                  }
                  detalle={solicitudes
                    .slice(0, 4)
                    .map((s) => s.nombre)
                    .join(', ')}
                  enlace="/panel/solicitudes"
                  accion="Revisar"
                />
              )}

              {sinResponsable.length > 0 && (
                <Panel
                  Icono={HandHeart}
                  titulo={
                    sinResponsable.length === 1
                      ? 'Un ministerio sin responsable'
                      : `${sinResponsable.length} ministerios sin responsable`
                  }
                  detalle={sinResponsable.map((m) => m.nombre).join(', ')}
                  enlace={
                    sinResponsable.length === 1
                      ? `/panel/ministerios/${sinResponsable[0]!.id}`
                      : '/panel/ministerios'
                  }
                  accion="Asignar"
                />
              )}

              {recienLlegados.length > 0 && (
                <PanelRecienLlegados personas={recienLlegados} />
              )}
            </section>
          )}

          {/* ---------- Cómo está la congregación ---------- */}
          <section className="flex flex-col gap-3">
            <h2 className="t-micro">La congregación</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
                <span className="t-micro">Personas</span>
                <span className="t-cifra">{resumen.total}</span>

                {/* El desglose va DENTRO de la tarjeta del total, no en cuatro
                    tarjetas aparte: cuatro cifras sueltas obligan a sumarlas
                    mentalmente para saber si cuadran con el total. */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {(['miembro', 'nuevo', 'visitante', 'inactivo'] as const).map(
                    (e) =>
                      resumen.porEstado[e] > 0 ? (
                        <span
                          key={e}
                          className="text-[13px] text-muted-foreground"
                        >
                          <strong className="font-semibold text-foreground">
                            {resumen.porEstado[e]}
                          </strong>{' '}
                          {ESTADOS[e].etiqueta.toLowerCase()}
                          {resumen.porEstado[e] === 1 ? '' : 's'}
                        </span>
                      ) : null,
                  )}
                </div>

                <span className="text-[13.5px] text-muted-foreground">
                  {resumen.nuevosDelMes > 0
                    ? `${resumen.nuevosDelMes} ${resumen.nuevosDelMes === 1 ? 'alta' : 'altas'} este mes`
                    : 'Sin altas este mes'}
                </span>
              </div>

              <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
                <span className="t-micro">Sirviendo en un ministerio</span>
                <span className="t-cifra">{resumen.sirviendo}</span>

                {/* La proporción es el dato, no la cifra: 12 personas sirviendo es
                    mucho en una congregación de 30 y muy poco en una de 400. */}
                {resumen.total > 0 && (
                  <div className="flex flex-col gap-2">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-background"
                      role="img"
                      aria-label={`${sirviendoPct}% de la congregación sirve en algún ministerio`}
                    >
                      <div
                        className="h-full rounded-full bg-support"
                        style={{ width: `${sirviendoPct}%` }}
                      />
                    </div>
                    <span className="text-[13.5px] text-muted-foreground">
                      {sirviendoPct}% de la congregación
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {resumen.total === 0 && puedeCrear && (
            <section className="flex flex-col items-start gap-3.5 rounded-xl border border-border bg-surface p-6">
              <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Users className="size-5" strokeWidth={1.7} />
              </span>
              <div className="flex max-w-[520px] flex-col gap-1.5">
                <h2 className="t-subtitulo">Empieza por la congregación</h2>
                <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
                  Añade a las personas que ya vienen. No hace falta que tengas
                  todos sus datos: con el nombre basta para empezar, y lo demás se
                  completa con el tiempo.
                </p>
              </div>
              <Button render={<Link href="/panel/miembros/nuevo" />}>
                Añadir la primera persona
                <ArrowRight strokeWidth={1.9} />
              </Button>
            </section>
          )}
          </div>

          {/*
           * La columna de la derecha: lo que se mira, no lo que se pulsa.
           * Ancho fijo de 360 px y no una fracción, para que la tarjeta de la
           * caja no se estire hasta ser una cifra sola en mitad de un campo de
           * fútbol en un monitor de 2560.
           */}
          {hayLateral && (
            <aside className="flex min-w-0 flex-col gap-6">
              {/* ---------- Lo próximo ---------- */}
                {eventosProximos.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="t-micro">Lo próximo</h2>

                    <ul className="flex flex-col gap-2">
                      {eventosProximos.map((e) => (
                        <li key={e.id}>
                          <Link
                            href={`/panel/eventos/${e.id}`}
                            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-xl border border-border bg-surface p-4 no-underline transition-colors hover:bg-surface-alt hover:no-underline"
                          >
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-[15.5px] font-semibold text-foreground">
                                {e.titulo}
                              </span>
                              <span className="text-[13px] text-muted-foreground first-letter:uppercase">
                                {formatearInstante(e.inicioEn, ctx.iglesia.timezone)}
                              </span>
                            </div>
                            <span className="flex-none text-[13.5px] text-muted-foreground tabular-nums">
                              {e.cupo
                                ? `${e.ocupadas} de ${e.cupo}`
                                : `${e.ocupadas} apuntados`}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* ---------- La caja ---------- */}
                {finanzas && (
                  <section className="flex flex-col gap-3">
                    <h2 className="t-micro">La caja</h2>

                    <Link
                      href="/panel/finanzas"
                      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-surface p-5 no-underline transition-colors hover:bg-surface-alt hover:no-underline"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="t-micro">Entró este mes</span>
                        <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">
                          {finanzas.entro}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="t-micro">Salió</span>
                        <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">
                          {finanzas.salio}
                        </span>
                      </div>
                    </Link>
                  </section>
                )}
            </aside>
          )}
        </div>
      </Contenedor>
    </>
  );
}

function Panel({
  Icono,
  titulo,
  detalle,
  enlace,
  accion,
}: {
  Icono: LucideIcon;
  titulo: string;
  detalle: string;
  enlace: string;
  accion: string;
}) {
  return (
    <article className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-surface px-5 py-4">
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-background text-support">
        <Icono className="size-[19px]" strokeWidth={1.7} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15.5px] font-semibold leading-snug">
          {titulo}
        </span>
        <span className="truncate text-[13.5px] text-muted-foreground">
          {detalle}
        </span>
      </div>

      {/* Todos en `outline`: hay varios avisos y un solo botón naranja por
          pantalla. Si todos gritan, ninguno se oye. */}
      <Button variant="outline" size="sm" render={<Link href={enlace} />}>
        {accion}
      </Button>
    </article>
  );
}

function PanelRecienLlegados({ personas }: { personas: RecienLlegado[] }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-background text-support">
          <UserPlus className="size-[19px]" strokeWidth={1.7} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15.5px] font-semibold leading-snug">
            {personas.length === 1
              ? 'Alguien ha llegado y no sirve en ningún equipo'
              : `${personas.length} personas han llegado y no sirven en ningún equipo`}
          </span>
          <span className="text-[13.5px] text-muted-foreground">
            Es a quien más fácil se le pierde la pista.
          </span>
        </div>

        <Button variant="outline" size="sm" render={<Link href="/panel/miembros" />}>
          Ver el fichero
        </Button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {personas.map((p) => (
          <li key={p.id}>
            <Link
              href={`/panel/miembros?ficha=${p.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt py-1 pl-1 pr-3 text-[13.5px] font-medium text-foreground no-underline hover:bg-background hover:no-underline"
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[10.5px] font-bold ${ESTADOS[p.estado].avatar}`}
              >
                {iniciales(p.nombre)}
              </span>
              {p.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Días que faltan, redondeando hacia arriba.
 *
 * Se calcula en el servidor y en UTC. Es una aproximación aceptable para «te
 * quedan 3 días»: la zona horaria de la iglesia solo cambiaría el resultado en
 * las horas límite, y para un aviso de trial eso da igual. Donde sí importa —el
 * «hoy» de una agenda— está `src/lib/fecha/zona.ts`.
 */
function diasHasta(fecha: Date | null): number | null {
  if (!fecha) return null;
  const ms = fecha.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
