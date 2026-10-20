import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight, CircleAlert, Info, Phone, UserPlus } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import {
  DIAS_EN_NUEVOS,
  SE_QUEDA,
  nuevosDelSeguimiento,
  type EtapaNuevo,
  type NuevosDelSeguimiento,
} from '@/lib/seguimiento/consultas';
import { RESULTADOS } from '@/lib/seguimiento/catalogos';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { VistasSeguimiento } from '../_components/vistas';
import { CONFIRMACIONES } from '../constantes';

export const metadata: Metadata = { title: 'Nuevos' };

/**
 * ¿Quién ha llegado, y vuelve?
 *
 * DENTRO DEL MÓDULO DE SEGUIMIENTO, Y NO COMO MÓDULO PROPIO
 * ---------------------------------------------------------
 * El análisis de consolidación propone un módulo `bienvenida` aparte. Se ha
 * decidido no hacerlo todavía, con la regla de que solo aparece lo que funciona:
 *
 *   - Hoy «Nuevos» no tiene nada suyo. Lee las mismas fichas, las mismas
 *     asistencias, y escribe con la misma ficha de `[miembroId]`, el mismo
 *     acompañante y los mismos contactos que los ausentes. Un interruptor
 *     propio podría estar encendido con el seguimiento apagado, y entonces cada
 *     fila llevaría a una ficha que da 404.
 *   - Y al revés es peor: quien está en nuevos NO sale en ausentes. Con
 *     «Nuevos» apagado y el seguimiento encendido, el visitante del domingo
 *     desaparecería de las dos listas a la vez. Las dos vistas solo son
 *     coherentes si siempre van juntas.
 *
 * El día que exista la tarjeta por QR —su tabla `llegadas`, su enlace público y
 * su consentimiento propio, que necesitan migración— eso sí será una pieza con
 * datos y ruta propios, y le tocará su interruptor. Esta vista se quedará aquí.
 *
 * Mismas tres llaves que los ausentes, porque las pone el `layout.tsx` de la
 * carpeta: `ver_seguimiento`, llevar este ministerio y el módulo encendido.
 */
export default async function NuevosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const { personas, hayListas, ausentes } = await nuevosDelSeguimiento(ctx, id);

  const base = `/panel/ministerios/${id}/seguimiento`;
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const sinContactar = personas.filter((p) => !p.ultimoContacto).length;

  // Pasar lista y cambiar el estado de una ficha son de otras secciones. Se
  // enlazan solo si esta persona puede abrirlas: un enlace que rebota es la
  // pestaña que rebotaba, otra vez.
  const pasaLista = esPastor(ctx) || puede(ctx, 'registrar_asistencia');
  const editaFichas = esPastor(ctx) || puede(ctx, 'editar_miembros');

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo={`Quién ha llegado en los últimos ${DIAS_EN_NUEVOS} días, y si vuelve`}
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      >
        <Button render={<Link href={`${base}/nuevos/alta`} />}>
          <UserPlus strokeWidth={1.8} />
          Apuntar a alguien nuevo
        </Button>
      </CabeceraPanel>

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="seguimiento" />

        <VistasSeguimiento
          base={base}
          activa="nuevos"
          nuevos={personas.length}
          ausentes={ausentes}
        />

        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {/*
         * Sin lista no hay «volvió». Se dice en vez de inventarlo: con todo el
         * mundo en «llegó», el equipo llamaría a quien lleva cuatro domingos
         * viniendo para preguntarle si piensa volver.
         *
         * Y la salida no es que consolidación marque «vino hoy»: una sola fila
         * en una reunión sin lista la convierte en «lista tomada» y le apunta
         * una falta a toda la congregación.
         */}
        {!hayListas && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 md:px-5">
            <Info
              className="mt-0.5 size-[18px] flex-none text-muted-foreground"
              strokeWidth={1.8}
              aria-hidden
            />
            <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                En los últimos {DIAS_EN_NUEVOS} días no se ha pasado lista en
                ningún culto, así que no sabemos quién ha vuelto.
              </strong>{' '}
              Lo que ves abajo es quién llegó, no quién se ha quedado.{' '}
              {pasaLista ? (
                <>
                  Pasa lista en{' '}
                  <Link href="/panel/reuniones" className="underline">
                    Reuniones
                  </Link>{' '}
                  y esta pantalla empezará a saberlo.
                </>
              ) : (
                'Pídele a quien pasa lista en los cultos que lo apunte en Reuniones.'
              )}
            </p>
          </div>
        )}

        {personas.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">
              Nadie nuevo en los últimos {DIAS_EN_NUEVOS} días
            </h2>
            <p className="max-w-[60ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Aquí sale quien tiene la ficha en Visitante o Nuevo y llegó hace
              menos de {DIAS_EN_NUEVOS} días. Cuando alguien venga por primera
              vez, apúntalo con su teléfono y verás aquí si vuelve.
            </p>
            <Button
              variant="outline"
              render={<Link href={`${base}/nuevos/alta`} />}
            >
              <UserPlus strokeWidth={1.8} />
              Apuntar a la primera persona
            </Button>
          </div>
        ) : (
          <>
            <p className="text-[14px] text-muted-foreground">
              {personas.length}{' '}
              {personas.length === 1 ? 'persona ha llegado' : 'personas han llegado'}{' '}
              en los últimos {DIAS_EN_NUEVOS} días.{' '}
              {sinContactar > 0 &&
                (sinContactar === 1
                  ? 'A una todavía no la ha llamado nadie.'
                  : `A ${sinContactar} todavía no las ha llamado nadie.`)}
            </p>

            {GRUPOS.map((g) => {
              const delGrupo = personas.filter((p) => p.nuevo.etapa === g.etapa);
              if (delGrupo.length === 0) return null;

              return (
                <section key={g.etapa} className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1 px-1">
                    <h2 className="t-micro">
                      {g.titulo} · {delGrupo.length}
                    </h2>
                    <p className="text-pretty text-[13px] leading-snug text-muted-foreground">
                      {g.etapa === 'se_queda'
                        ? editaFichas
                          ? 'Que ya sea de la casa lo decides tú: cámbiale el estado a Miembro en su ficha de Miembros, y saldrá de aquí.'
                          : 'Que ya sea de la casa lo decide el pastor cambiando el estado de su ficha a Miembro.'
                        : g.ayuda}
                    </p>
                  </div>

                  <ul className="flex flex-col gap-2.5">
                    {delGrupo.map((p) => (
                      <Fila
                        key={p.miembroId}
                        persona={p}
                        href={`${base}/${p.miembroId}`}
                        hoy={hoy}
                        hayListas={hayListas}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </Contenedor>
    </>
  );
}

/**
 * Primero quien solo vino una vez: es la llamada que más cuenta, y la que antes
 * caduca. Quien ya se queda va al final porque es quien menos necesita al
 * equipo.
 *
 * Solo etapas CALCULADAS de las asistencias. La ruta de crecimiento y la célula
 * no son grupos de aquí sino insignias de cada fila (ver `Insignias`): quien se
 * queda puede llevar ya «Encuentro» y una célula, y seguir en este grupo.
 */
const GRUPOS: { etapa: EtapaNuevo; titulo: string; ayuda: string }[] = [
  {
    etapa: 'llego',
    titulo: 'Vinieron una vez',
    ayuda: 'La llamada de los primeros días es la que más cuenta.',
  },
  {
    etapa: 'volvio',
    titulo: 'Volvieron',
    ayuda: 'Han venido a algún culto con lista después de su primera visita.',
  },
  {
    etapa: 'se_queda',
    titulo: 'Se quedan',
    ayuda: '',
  },
];

type PersonaNueva = NuevosDelSeguimiento['personas'][number];

function Fila({
  persona: p,
  href,
  hoy,
  hayListas,
}: {
  persona: PersonaNueva;
  href: string;
  hoy: string;
  hayListas: boolean;
}) {
  const dias = diasEntre(p.llegada, hoy);

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-foreground/20 hover:bg-surface-alt hover:no-underline md:gap-4 md:px-5"
      >
        <span
          className={`flex size-10 flex-none items-center justify-center self-start rounded-full text-[12px] font-bold ${ESTADOS[p.estado].avatar}`}
        >
          {iniciales(p.nombre)}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[16px] font-bold tracking-[-0.015em]">
              {p.nombre}
            </span>
            <span className="text-[13px] text-muted-foreground first-letter:uppercase">
              {dias === 0
                ? 'Llegó hoy'
                : `Llegó hace ${dias} ${dias === 1 ? 'día' : 'días'}, el ${formatearFechaLarga(p.llegada)}`}
            </span>
          </div>

          <Insignias persona={p} />

          <span className="text-pretty text-[13px] leading-snug text-muted-foreground">
            {detalleDeEtapa(p, hayListas)}
          </span>
        </div>

        <ChevronRight
          className="size-4 flex-none text-disabled-text"
          strokeWidth={1.9}
          aria-hidden
        />
      </Link>
    </li>
  );
}

/**
 * Lo que pide algo, en una fila de insignias que se parte en el móvil.
 *
 * Dentro de la columna y no en un lateral, como en la tarjeta de turnos: a
 * 375 px un lateral deja el nombre en una tira de tres palabras, y esconderlo en
 * el móvil se lleva justo lo que se mira después del culto.
 *
 * AQUÍ ENTRA LO QUE VIENE
 * -----------------------
 * La célula a la que se le asigne y los pasos de la ruta de crecimiento
 * (encuentro, bautismo, escuela de líderes) llegan en una tanda con migración.
 * Son insignias de esta fila, una por dato, en este orden: primero lo que pide
 * una llamada, después quién le lleva, después dónde está. No son etapas: la
 * etapa se calcula de las asistencias y la ruta son hechos que alguien apunta,
 * así que no se mezclan en `GRUPOS`.
 */
function Insignias({ persona: p }: { persona: PersonaNueva }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
      {/* Con icono y no solo con color, como los errores: es lo único de la
          fila que pide algo. */}
      {p.ultimoContacto ? (
        <span
          className={`rounded-md px-2 py-0.5 ${RESULTADOS[p.ultimoContacto.resultado].badge}`}
        >
          {RESULTADOS[p.ultimoContacto.resultado].etiqueta}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-badge-warning-bg px-2 py-0.5 text-badge-warning-fg">
          <CircleAlert className="size-3.5" strokeWidth={2} aria-hidden />
          Sin contactar
        </span>
      )}

      {p.acompana ? (
        <span className="rounded-md bg-badge-neutral-bg px-2 py-0.5 text-badge-neutral-fg">
          Le acompaña {p.acompana.nombre}
        </span>
      ) : (
        // «Sin asignar», como en ausentes, y sin color de alarma: que nadie la
        // acompañe todavía es lo normal el primer día.
        <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-muted-foreground">
          Sin asignar
        </span>
      )}

      {/* En el móvil sobra: se llama desde la ficha, que tiene el botón. */}
      {p.telefono && (
        <span className="hidden items-center gap-1 px-1 font-medium text-muted-foreground sm:inline-flex">
          <Phone className="size-3.5" strokeWidth={1.8} aria-hidden />
          {p.telefono}
        </span>
      )}
    </span>
  );
}

function detalleDeEtapa(p: PersonaNueva, hayListas: boolean): string {
  switch (p.nuevo.etapa) {
    case 'se_queda':
      return `Ha venido a ${p.nuevo.presenciasRecientes} de las últimas ${SE_QUEDA.deLasUltimas} reuniones con lista.`;
    case 'volvio': {
      // Volver una vez no es quedarse: si después ha dejado de venir, se dice.
      const despues =
        p.faltasSeguidas > 0
          ? ` Desde entonces, ${p.faltasSeguidas} ${p.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} con lista sin venir.`
          : '';
      return p.ultimaAsistencia
        ? `Volvió. La última vez, el ${formatearFechaLarga(p.ultimaAsistencia)}.${despues}`
        : 'Volvió.';
    }
    case 'llego':
      // «No ha vuelto» solo si hubo listas después en las que pudo salir. Sin
      // ellas, la respuesta honrada es que no se sabe.
      if (p.faltasSeguidas > 0) {
        return p.faltasSeguidas === 1
          ? 'No vino a la reunión con lista que hubo después.'
          : `No ha vuelto en las ${p.faltasSeguidas} reuniones con lista que ha habido después.`;
      }
      return hayListas
        ? 'Aún no se ha pasado lista en ningún culto desde que llegó.'
        : 'Sin lista de los cultos no sabemos si ha vuelto.';
  }
}

/** Días entre dos fechas `YYYY-MM-DD`, sin pasar por ningún huso horario. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(...partes(desde));
  const b = Date.UTC(...partes(hasta));
  return Math.round((b - a) / 86_400_000);
}

function partes(f: string): [number, number, number] {
  const [y, m, d] = f.split('-').map(Number);
  return [y!, m! - 1, d!];
}
