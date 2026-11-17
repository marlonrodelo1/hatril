import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { listarNotificaciones, type Notificacion } from '@/lib/notificaciones/consultas';
import type { TipoNotificacion } from '@/lib/notificaciones/emitir';
import { textoNotificacion } from '@/lib/notificaciones/textos';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { abrirAviso, marcarTodoLeido } from './actions';

export const metadata: Metadata = { title: 'Avisos' };

/**
 * Los avisos de una persona.
 *
 * SOLO PIDE SESIÓN
 * ----------------
 * Ni `requireIglesia` ni permisos. Es la única pantalla del producto que tiene
 * que funcionar para alguien que NO pertenece a ninguna congregación: a quien le
 * rechazan la solicitud se le borra la membresía en el mismo movimiento, y su
 * aviso —el que le cuenta por qué— se quedaría fuera de su alcance con cualquier
 * guard de iglesia.
 *
 * `dynamic` porque cada persona ve una cosa distinta y cambia a cada minuto.
 *
 * DE UN VISTAZO (zona 2 del rediseño, 17-nov)
 * -------------------------------------------
 * Antes todos los avisos eran iguales: un turno y un comentario solo se
 * distinguían leyendo, y lo de hoy iba pegado a lo de hace un mes. Ahora cada
 * tipo lleva su icono y su color, y van agrupados en Hoy, Esta semana y Antes.
 */
export const dynamic = 'force-dynamic';

/**
 * El icono y el color de cada tipo de aviso, en un círculo.
 *
 * Por familias y no uno por tipo: once colores no se aprenden, cuatro sí.
 *
 * - Lo que te pide algo (un turno, alguien que quiere entrar): el naranja
 *   suave. Es el color de «te toca», el mismo de la raya de la agenda.
 * - Lo que sale bien (te aprobaron): el verde de las insignias de éxito.
 * - El devocional, y lo que solo informa: gris con el icono en carbón.
 * - Lo que hace la gente en tus publicaciones: el azul. `info` es un color de
 *   distinguir categorías, no de texto: sobre su propio fondo al 15 % da
 *   3.2:1, que vale para un icono (WCAG pide 3:1 a un gráfico) y no llegaría
 *   para letra. Por eso aquí solo pinta el icono.
 * - Una denuncia, el ámbar de aviso: hay que mirarla, pero no es un error.
 *
 * Un `Record` sobre el enum de Postgres, y no un `switch` con `default`: el día
 * que se añada un tipo, esto deja de compilar hasta que alguien le dé icono.
 */
const TURNO = 'bg-accent text-accent-foreground';
const BIEN = 'bg-badge-success-bg text-badge-success-fg';
const NEUTRO = 'bg-badge-neutral-bg text-support';
const GENTE = 'bg-info/15 text-info';
const OJO = 'bg-badge-warning-bg text-badge-warning-fg';

const ESTILO: Record<TipoNotificacion, { Icono: LucideIcon; circulo: string }> = {
  turno_asignado: { Icono: CalendarCheck, circulo: TURNO },
  turno_no_puede: { Icono: CalendarX, circulo: TURNO },
  solicitud_recibida: { Icono: UserPlus, circulo: TURNO },
  solicitud_aprobada: { Icono: UserCheck, circulo: BIEN },
  turno_devocional: { Icono: BookOpen, circulo: NEUTRO },
  solicitud_rechazada: { Icono: UserX, circulo: NEUTRO },
  contenido_retirado: { Icono: EyeOff, circulo: NEUTRO },
  comentario_en_publicacion: { Icono: MessageCircle, circulo: GENTE },
  me_gusta_en_publicacion: { Icono: Heart, circulo: GENTE },
  denuncia_en_comunidad: { Icono: Flag, circulo: OJO },
};

type Grupo = 'Hoy' | 'Esta semana' | 'Antes';

type AvisoEnGrupo = {
  aviso: Notificacion;
  cuando: { texto: string; iso: string };
  /** Su sitio en la pantalla, para escalonar la cascada del punto. */
  orden: number;
};

/**
 * Zona de quien no tiene iglesia: la que pone la base por defecto a una
 * iglesia nueva. Solo decide dónde cae la medianoche que separa «Hoy» de
 * «Esta semana», y a quien acaban de rechazar le da igual una hora arriba o
 * abajo.
 */
const ZONA_SIN_IGLESIA = 'America/Bogota';

export default async function AvisosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/acceso?next=/mi/avisos');

  // El corte del consentimiento, solo para quien SÍ tiene iglesia: los avisos
  // nombran a terceros («Fulano quiere unirse»), y una cuenta que todavía no
  // ha aceptado no los lee aquí lo que no puede leer en el panel. Al rechazado,
  // que no tiene contexto, no le toca, y sigue viendo el aviso que le explica
  // por qué.
  const ctx = await getCurrentUserContext();
  if (ctx) await exigirConsentimientoAlDia(ctx);

  const avisos = await listarNotificaciones(user.id);
  const sinLeer = avisos.filter((a) => !a.leida).length;

  const zona = ctx?.iglesia.timezone ?? ZONA_SIN_IGLESIA;
  const grupos = agrupar(avisos, zona);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/*
       * Sin campana, y no por ahorrar: esta pantalla ES la bandeja. Una campana
       * aquí abriría un desplegable con los mismos avisos que hay debajo y un
       * segundo «Marcar todo» al lado del que ya está en la cabecera.
       *
       * El menú de cuenta sí, y es la razón de que exista `soloSalir`: aquí
       * puede haber alguien SIN iglesia. La cabecera lo resuelve sola.
       */}
      <CabeceraMiembro user={user} titulo="Avisos" volver="/mi/comunidad" campana={false}>
        {sinLeer > 0 && (
          <form action={marcarTodoLeido}>
            <BotonEnviar variant="ghost" size="sm" pendiente="Marcando…">
              <CheckCheck strokeWidth={1.8} />
              Marcar todo
            </BotonEnviar>
          </form>
        )}
      </CabeceraMiembro>

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {avisos.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            {/* Sin botón: no hay nada que hacer para que lleguen. Lo que sí
                hace falta es saber qué va a aparecer aquí, para no pensar que
                la pantalla está rota. */}
            <EstadoVacio Icono={Bell} titulo="No tienes avisos">
              Aquí te contamos cuando alguien comenta lo que publicas, cuando te
              toca servir o escribir el devocional, o cuando se resuelve una
              solicitud.
            </EstadoVacio>
          </div>
        ) : (
          grupos.map(({ grupo, avisos: delGrupo }) => (
            <section key={grupo} className="flex flex-col gap-1.5">
              <h2 className="t-micro px-1 pb-1">{grupo}</h2>
              <ul className="flex flex-col gap-1.5">
                {delGrupo.map(({ aviso, cuando, orden }) => (
                  <li key={aviso.id}>
                    <FilaAviso aviso={aviso} cuando={cuando} orden={orden} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

/**
 * Un aviso: el círculo de su tipo, lo que pasó y cuándo.
 *
 * NO ES UNA `Fila`, Y ES A PROPÓSITO
 * ----------------------------------
 * `Fila` es un enlace o un bloque muerto, y esto es un botón de formulario: al
 * pulsarlo hay que marcarlo leído ANTES de llevar a ninguna parte, y eso es una
 * escritura. Un `<a>` con un `fetch` al lado se queda a medias en cuanto la
 * navegación gana la carrera.
 *
 * SIN LEER, TARJETA; LEÍDO, PLANO
 * -------------------------------
 * Lo sin leer va en tarjeta blanca con borde y un punto naranja; lo leído se
 * queda sobre el crema, sin borde. Se distingue de lejos sin leer nada, y el
 * punto lleva además su texto para quien no ve el color.
 *
 * Al pulsar «Marcar todo», la action revalida sin redirigir y React reutiliza
 * estos mismos botones: el cambio de clases dispara las transiciones, y cada
 * punto se apaga un poco después que el de encima. Es la cascada de la maqueta
 * sin una línea de JavaScript. El retraso va solo en el punto: puesto en la
 * tarjeta, retrasaría también el color al pasar por encima.
 */
function FilaAviso({ aviso: a, cuando, orden }: AvisoEnGrupo) {
  const { titulo, detalle } = textoNotificacion(a.tipo, a.datos);
  const { Icono, circulo } = ESTILO[a.tipo];

  return (
    <form action={abrirAviso.bind(null, a.id)}>
      <button
        type="submit"
        className={clsx(
          'relative flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-240 ease-hatril hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none motion-reduce:transition-none',
          a.leida ? 'border-transparent' : 'border-border bg-surface',
        )}
      >
        <span
          aria-hidden
          className={clsx(
            'flex size-[34px] flex-none items-center justify-center rounded-full',
            circulo,
          )}
        >
          <Icono className="size-[17px]" strokeWidth={1.8} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body leading-snug font-semibold text-pretty">
            {titulo}
          </span>
          {detalle && (
            <span className="line-clamp-2 text-label text-pretty text-muted-foreground">
              {detalle}
            </span>
          )}
        </span>

        {/* El hueco del punto se reserva siempre: si no, al leer el aviso la
            hora saltaría a la derecha. */}
        <time
          dateTime={cuando.iso}
          className="flex-none pt-0.5 pr-4 text-label whitespace-nowrap text-muted-foreground tabular-nums"
        >
          {cuando.texto}
        </time>

        <span
          aria-hidden
          className={clsx(
            'absolute top-[19px] right-3 size-2 rounded-full bg-primary transition-[opacity,scale] duration-240 ease-hatril motion-reduce:transition-none',
            a.leida ? 'scale-[0.4] opacity-0' : 'opacity-100',
          )}
          style={{ transitionDelay: `${Math.min(orden, 8) * 60}ms` }}
        />
        {!a.leida && <span className="sr-only">Sin leer</span>}
      </button>
    </form>
  );
}

/**
 * Los avisos, en Hoy, Esta semana y Antes, con lo que va a su derecha.
 *
 * «Esta semana» son los seis días de antes de hoy, no la semana del
 * calendario: un aviso del domingo leído el lunes no es «de antes», y con la
 * semana que empieza en lunes lo sería. Y así el día de la semana basta para
 * situarlo («lun», «sáb»): dentro de seis días no se repite ninguno.
 *
 * Todo en la zona de la iglesia y no en la del servidor, que está en Europa:
 * para Bogotá, a las ocho de la tarde el servidor ya va por el día siguiente,
 * y lo de esa misma mañana saldría en «Esta semana».
 *
 * La lista ya viene ordenada de lo nuevo a lo viejo, así que los grupos salen
 * en orden y sin huecos.
 */
function agrupar(
  avisos: Notificacion[],
  zona: string,
): { grupo: Grupo; avisos: AvisoEnGrupo[] }[] {
  const hoy = hoyEnLaIglesia(zona);
  const diaDe = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const hora = new Intl.DateTimeFormat('es-ES', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const diaSemana = new Intl.DateTimeFormat('es-ES', { timeZone: zona, weekday: 'short' });
  const fechaCorta = new Intl.DateTimeFormat('es-ES', {
    timeZone: zona,
    day: 'numeric',
    month: 'short',
  });
  const fechaConAnio = new Intl.DateTimeFormat('es-ES', {
    timeZone: zona,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const salida: { grupo: Grupo; avisos: AvisoEnGrupo[] }[] = [];

  avisos.forEach((aviso, orden) => {
    const dia = diaDe.format(aviso.createdAt);
    // Días enteros entre dos fechas sin hora: las dos a medianoche UTC, que no
    // tiene cambios de horario que resten una hora a un día.
    const hace = Math.round((Date.parse(hoy) - Date.parse(dia)) / 86_400_000);

    const grupo: Grupo = hace <= 0 ? 'Hoy' : hace < 7 ? 'Esta semana' : 'Antes';
    const texto =
      grupo === 'Hoy'
        ? hora.format(aviso.createdAt)
        : grupo === 'Esta semana'
          ? diaSemana.format(aviso.createdAt).replace('.', '')
          : (dia.slice(0, 4) === hoy.slice(0, 4) ? fechaCorta : fechaConAnio)
              .format(aviso.createdAt)
              .replace('.', '');

    const fila: AvisoEnGrupo = {
      aviso,
      cuando: { texto, iso: aviso.createdAt.toISOString() },
      orden,
    };
    const ultimo = salida[salida.length - 1];
    if (ultimo?.grupo === grupo) ultimo.avisos.push(fila);
    else salida.push({ grupo, avisos: [fila] });
  });

  return salida;
}
