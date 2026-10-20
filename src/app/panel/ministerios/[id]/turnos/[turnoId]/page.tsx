import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';
import {
  cancionesDelTurno,
  cancionesParaElegir,
  type CancionEnTurno,
} from '@/lib/repertorio/consultas';
import {
  obtenerTurno,
  otrosTurnosDelDia,
  turnoParaCopiar,
  type PersonaEnTurno,
} from '@/lib/turnos/consultas';
import { puestosDelMinisterio } from '@/lib/turnos/puestos';
import { diaYHora, ensayoAntesDelTurno } from '@/lib/agenda/ensayos';
import { ETIQUETA_RESPUESTA } from '@/lib/turnos/respuestas';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { iniciales } from '@/lib/format/iniciales';
import type { RespuestaTurno } from '@/lib/db/schema/turnos';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import {
  asignarAlTurno,
  borrarTurno,
  copiarTurno,
  editarTurno,
  marcarRespuesta,
  quitarDelTurno,
} from '../actions';
import { CONFIRMACIONES } from '../constantes';
import {
  agregarCancionAlTurno,
  cambiarTonoDelDia,
  moverCancion,
  quitarCancionDelTurno,
} from '../../repertorio/actions';

export const metadata: Metadata = { title: 'Turno' };

/**
 * El cuadrante de un culto: cada puesto con su gente.
 *
 * UN FORMULARIO POR PUESTO, SIN JAVASCRIPT
 * ----------------------------------------
 * Cada puesto lleva su desplegable con el equipo y su botón de añadir. Es más
 * lento que una rejilla con arrastrar y soltar, y funciona en el móvil de quien
 * lleva el equipo, que es donde se hace esto: el sábado por la noche, después de
 * que alguien escriba en el grupo que mañana no puede.
 *
 * EL DESPLEGABLE AVISA, NO PROHÍBE
 * --------------------------------
 * Quien ya sirve en otro equipo ese mismo culto sale con «también en Medios» al
 * lado del nombre. No se impide: en una iglesia pequeña es lo normal, y la base
 * de datos no sabe si le da tiempo a las dos cosas. Lo sabe el responsable.
 */
export default async function TurnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; turnoId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, turnoId } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const [ministerio, turno] = await Promise.all([
    obtenerMinisterio(ctx, id),
    obtenerTurno(ctx, turnoId),
  ]);

  // El layout ya comprobó que quien entra manda en ESTE ministerio. Falta que
  // el turno de la URL sea de este ministerio y no del de al lado: sin esto, el
  // responsable de alabanza vería el cuadrante de niños cambiando un uuid.
  if (!ministerio || !turno || turno.ministerioId !== id) notFound();

  // La lista de canciones solo si el equipo tiene el repertorio encendido: un
  // equipo de ujieres no tiene nada que tocar, y un bloque vacío de «Canciones»
  // en su cuadrante se leería como algo que falta.
  const conRepertorio = tieneModulo(ministerio.modulos, 'repertorio');
  // La ficha del ensayo vive en la agenda, y con la agenda apagada esa ruta da
  // 404: el ensayo se enseña igual, pero sin enlace.
  const conAgenda = tieneModulo(ministerio.modulos, 'agenda');

  const [otros, paraCopiar, lista, repertorio, ensayo] = await Promise.all([
    otrosTurnosDelDia(ctx, turno),
    turno.personas.length === 0
      ? turnoParaCopiar(ctx, turno, id)
      : Promise.resolve(null),
    conRepertorio ? cancionesDelTurno(ctx, turnoId) : Promise.resolve([]),
    conRepertorio ? cancionesParaElegir(ctx, id) : Promise.resolve([]),
    ensayoAntesDelTurno(ctx, turno),
  ]);

  const enLaLista = new Set(lista.map((c) => c.id));
  const candidatas = repertorio.filter((c) => !enLaLista.has(c.id));

  const base = `/panel/ministerios/${id}/turnos`;

  // Los puestos de la lista, y detrás los que tenga este turno y ya no estén en
  // ella —renombrados o borrados después—: esa gente sigue yendo, y esconderla
  // haría creer que el puesto está vacío.
  const puestos = puestosDelMinisterio(ministerio);
  const enLista = new Set(puestos.map((p) => p.toLocaleLowerCase('es')));
  const huerfanos = [
    ...new Set(
      turno.personas
        .map((p) => p.puesto)
        .filter((p) => !enLista.has(p.toLocaleLowerCase('es'))),
    ),
  ];
  const filas = [...puestos, ...huerfanos];

  const titulo = mayuscula(formatearFechaLarga(turno.fecha));

  return (
    <>
      <CabeceraPanel
        titulo={titulo}
        subtitulo={`${turno.hora ? `${turno.hora} · ` : ''}${turno.titulo} · ${ministerio.nombre}`}
        volver={{ href: base, texto: ministerio.nombre }}
      />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {turno.notas && (
          <p className="rounded-xl border border-border bg-surface px-5 py-4 text-pretty text-[14.5px] leading-relaxed">
            {turno.notas}
          </p>
        )}

        {ensayo ? (
          <LineaEnsayo
            ensayo={ensayo}
            href={conAgenda ? `/panel/ministerios/${id}/agenda/${ensayo.id}` : null}
          />
        ) : (
          // El aviso de que falta, solo a un equipo que ensaya —el que tiene
          // repertorio—, que puede apuntarlo y cuando todavía está a tiempo. A
          // los ujieres no les falta nada, y al domingo pasado ya tampoco.
          conRepertorio &&
          conAgenda &&
          turno.fecha >= hoyEnLaIglesia(ctx.iglesia.timezone) && (
            <p className="rounded-xl border border-dashed border-border bg-surface px-5 py-3.5 text-pretty text-[14px] leading-relaxed text-muted-foreground">
              No hay ensayo apuntado en la semana de antes.{' '}
              <Link
                href={`/panel/ministerios/${id}/agenda/nueva`}
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Apuntarlo en la agenda
              </Link>
            </p>
          )
        )}

        {paraCopiar && (
          <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface p-5 sm:flex-row sm:items-center">
            <p className="flex-1 text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              Este turno está vacío. Puedes empezar con la gente del{' '}
              <span className="font-semibold text-foreground">
                {formatearFechaLarga(paraCopiar.fecha)}
              </span>{' '}
              ({paraCopiar.personas}{' '}
              {paraCopiar.personas === 1 ? 'persona' : 'personas'}) y cambiar lo
              que haga falta.
            </p>
            <form action={copiarTurno.bind(null, id, turnoId, paraCopiar.id)}>
              <Button type="submit" variant="outline">
                <Copy strokeWidth={1.8} />
                Copiar ese cuadrante
              </Button>
            </form>
          </section>
        )}

        {ministerio.equipo.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">El equipo está vacío</h2>
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Solo se puede poner en un turno a gente del equipo.{' '}
              <Link href={`/panel/ministerios/${id}`} className="underline">
                Súmale gente al equipo
              </Link>{' '}
              y vuelve aquí.
            </p>
          </div>
        ) : (
          // `grid-cols-1` escrito aunque sea el defecto: la columna implícita
          // de una rejilla mide lo que su contenido más ancho, y el desplegable
          // mide lo que su opción más larga —«Lucía Ferrer Ramos — Voz y
          // teclado · también en Medios»—. En un móvil eso sacaba la página 20
          // px por la derecha. `grid-cols-1` es `minmax(0, 1fr)` y la encoge.
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filas.map((puesto) => {
              const clave = puesto.toLocaleLowerCase('es');
              const aqui = turno.personas.filter(
                (p) => p.puesto.toLocaleLowerCase('es') === clave,
              );
              const yaAqui = new Set(aqui.map((p) => p.miembroId));
              const candidatos = ministerio.equipo.filter(
                (p) => !yaAqui.has(p.miembroId),
              );
              const huerfano = !enLista.has(clave);

              return (
                <li
                  key={puesto}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:px-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[15.5px] font-bold tracking-[-0.012em]">
                      {puesto}
                    </h2>
                    {huerfano ? (
                      <span className="text-[12.5px] text-muted-foreground">
                        Ya no está en la lista de puestos
                      </span>
                    ) : (
                      aqui.length === 0 && (
                        <span className="rounded-md bg-badge-warning-bg px-2 py-0.5 text-[12px] font-semibold text-badge-warning-fg">
                          Sin cubrir
                        </span>
                      )
                    )}
                  </div>

                  {aqui.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {aqui.map((p) => (
                        <FilaPersona
                          key={p.asignacionId}
                          persona={p}
                          acciones={{
                            responder: marcarRespuesta.bind(null, id, turnoId, p.miembroId),
                            quitar: quitarDelTurno.bind(null, id, turnoId, p.asignacionId),
                          }}
                        />
                      ))}
                    </ul>
                  )}

                  {!huerfano && candidatos.length > 0 && (
                    <form
                      action={asignarAlTurno.bind(null, id, turnoId)}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="puesto" value={puesto} />
                      <select
                        name="miembroId"
                        required
                        defaultValue=""
                        aria-label={`Quién va a ${puesto}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-surface-alt px-2.5 text-[14.5px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                      >
                        <option value="" disabled>
                          Añadir a alguien…
                        </option>
                        {candidatos.map((c) => (
                          <option key={c.miembroId} value={c.miembroId}>
                            {textoCandidato(c, otros.get(c.miembroId))}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        aria-label={`Añadir a ${puesto}`}
                      >
                        <UserPlus strokeWidth={1.8} />
                        <span className="max-sm:sr-only">Añadir</span>
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {conRepertorio && (
          <section
            id="canciones"
            className="flex scroll-mt-24 flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:px-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15.5px] font-bold tracking-[-0.012em]">
                Canciones
              </h2>
              <Link
                href={`/panel/ministerios/${id}/repertorio`}
                className="text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Ir al repertorio
              </Link>
            </div>

            {lista.length === 0 ? (
              <p className="text-[14.5px] text-muted-foreground">
                Todavía no hay canciones para este culto. El equipo las verá en
                su agenda, con su tono y dónde escucharlas.
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {lista.map((c, i) => (
                  <FilaCancion
                    key={c.filaId}
                    cancion={c}
                    posicion={i + 1}
                    esPrimera={i === 0}
                    esUltima={i === lista.length - 1}
                    acciones={{
                      subir: moverCancion.bind(null, id, turnoId, c.filaId, 'arriba'),
                      bajar: moverCancion.bind(null, id, turnoId, c.filaId, 'abajo'),
                      quitar: quitarCancionDelTurno.bind(null, id, turnoId, c.filaId),
                      tono: cambiarTonoDelDia.bind(null, id, turnoId, c.filaId),
                    }}
                  />
                ))}
              </ol>
            )}

            {candidatas.length > 0 ? (
              <form
                action={agregarCancionAlTurno.bind(null, id, turnoId)}
                className="flex flex-wrap items-center gap-2"
              >
                <select
                  name="cancionId"
                  required
                  defaultValue=""
                  aria-label="Canción para este culto"
                  className="h-9 min-w-0 flex-1 basis-56 rounded-lg border border-input bg-surface-alt px-2.5 text-[14.5px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                >
                  <option value="" disabled>
                    Añadir una canción…
                  </option>
                  {candidatas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                      {c.autor ? ` — ${c.autor}` : ''}
                      {c.tono ? ` (${c.tono})` : ''}
                    </option>
                  ))}
                </select>
                <Input
                  name="tono"
                  maxLength={12}
                  placeholder="Tono"
                  aria-label="Tono para este culto, si no es el de siempre"
                  className="h-9 w-20"
                />
                <Button type="submit" variant="outline" size="sm">
                  <Plus strokeWidth={1.8} />
                  Añadir
                </Button>
              </form>
            ) : (
              repertorio.length === 0 && (
                <p className="text-[14px] text-muted-foreground">
                  El repertorio está vacío.{' '}
                  <Link
                    href={`/panel/ministerios/${id}/repertorio/nueva`}
                    className="underline"
                  >
                    Apunta las canciones del equipo
                  </Link>{' '}
                  y vuelve aquí.
                </p>
              )
            )}
          </section>
        )}

        <details className="group rounded-xl border border-border bg-surface">
          <summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold marker:hidden">
            Cambiar el día, el nombre o las notas
          </summary>

          <form
            action={editarTurno.bind(null, id, turnoId)}
            className="flex flex-col gap-4 border-t border-border p-5"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">Qué es</Label>
              <Input id="titulo" name="titulo" required maxLength={120} defaultValue={turno.titulo} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha">Día</Label>
                <Input id="fecha" name="fecha" type="date" required defaultValue={turno.fecha} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hora">
                  Hora
                  <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input id="hora" name="hora" type="time" defaultValue={turno.hora ?? ''} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notas">
                Para el equipo
                <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <textarea
                id="notas"
                name="notas"
                rows={2}
                maxLength={1000}
                defaultValue={turno.notas ?? ''}
                placeholder="Llegar a las 9:30 para la prueba de sonido."
                className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
              />
              <p className="t-label text-muted-foreground">
                Lo ve todo el equipo. Instrucciones del turno, no cosas de las
                personas.
              </p>
            </div>

            <div>
              <Button type="submit" variant="outline">
                Guardar los cambios
              </Button>
            </div>
          </form>

          <div className="flex flex-col items-start gap-3 border-t border-border p-5">
            <p className="max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
              Borrar el turno se lleva su cuadrante. No avisa a nadie: si ya
              había gente puesta, díselo tú.
            </p>
            <form action={borrarTurno.bind(null, id, turnoId)}>
              <Button type="submit" variant="destructive">
                <Trash2 strokeWidth={1.8} />
                Borrar el turno
              </Button>
            </form>
          </div>
        </details>
      </Contenedor>
    </>
  );
}

/**
 * «Ensayo: jueves 16, 19:30 · La sala de música».
 *
 * Con el título que le puso el responsable delante, y no con «Ensayo» fijo: la
 * pantalla de turnos es la misma para alabanza que para acción social, y la
 * reunión del jueves de un equipo de reparto no es un ensayo.
 */
function LineaEnsayo({
  ensayo,
  href,
}: {
  ensayo: { titulo: string; fecha: string; hora: string | null; lugar: string | null };
  href: string | null;
}) {
  const cuerpo = (
    <>
      <CalendarClock
        className="size-[18px] flex-none text-muted-foreground"
        strokeWidth={1.8}
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-pretty text-[14.5px] leading-snug">
        <span className="font-semibold">{ensayo.titulo}:</span>{' '}
        {diaYHora(ensayo.fecha, ensayo.hora)}
        {ensayo.lugar && <span className="text-muted-foreground"> · {ensayo.lugar}</span>}
      </span>
    </>
  );

  const clases =
    'flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 md:px-5';

  return href ? (
    <Link
      href={href}
      className={`${clases} text-foreground no-underline transition-colors hover:border-support-hover hover:bg-surface-alt hover:no-underline`}
    >
      {cuerpo}
      <ChevronRight className="size-4 flex-none text-disabled-text" strokeWidth={1.9} aria-hidden />
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}

/** Las dos respuestas que se pueden marcar desde cada estado. */
const SIGUIENTES: Record<RespuestaTurno, RespuestaTurno[]> = {
  pendiente: ['confirmado', 'no_puede'],
  confirmado: ['no_puede', 'pendiente'],
  no_puede: ['confirmado', 'pendiente'],
};

const ACCION_RESPUESTA: Record<RespuestaTurno, string> = {
  confirmado: 'Marcar que confirma',
  no_puede: 'Marcar que no puede',
  pendiente: 'Dejar sin contestar',
};

function FilaPersona({
  persona: p,
  acciones,
}: {
  persona: PersonaEnTurno;
  acciones: {
    /** La respuesta viaja en el campo oculto de cada botón, no atada aquí. */
    responder: (formData: FormData) => Promise<void>;
    quitar: () => Promise<void>;
  };
}) {
  const estado = ETIQUETA_RESPUESTA[p.respuesta];

  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-alt px-2.5 py-2">
      <span className="flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
        {iniciales(p.nombre)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14.5px] font-medium">{p.nombre}</span>
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-px text-[11.5px] font-semibold ${estado.clase}`}
        >
          <estado.Icono className="size-3" strokeWidth={2.2} aria-hidden />
          {estado.equipo}
        </span>
      </span>

      <span className="flex flex-none items-center">
        {SIGUIENTES[p.respuesta].map((r) => {
          const Icono = ETIQUETA_RESPUESTA[r].Icono;
          return (
            // Un formulario por botón: con el `bind` de las server actions, dos
            // submits en el mismo form comparten destino. Ver `BotonRol` en la
            // pantalla del ministerio.
            <form key={r} action={acciones.responder}>
              <input type="hidden" name="respuesta" value={r} />
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                title={`${ACCION_RESPUESTA[r]}: ${p.nombre}`}
                aria-label={`${ACCION_RESPUESTA[r]}: ${p.nombre}`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icono strokeWidth={1.8} />
              </Button>
            </form>
          );
        })}

        <form action={acciones.quitar}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            title={`Quitar a ${p.nombre} de este puesto`}
            aria-label={`Quitar a ${p.nombre} de este puesto`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <UserMinus strokeWidth={1.7} />
          </Button>
        </form>
      </span>
    </li>
  );
}

/**
 * Una canción de la lista: su número, cómo se llama, el tono de ese día y los
 * botones para moverla o quitarla.
 *
 * En dos filas en el móvil: el título arriba, y debajo el tono y los botones.
 * En una sola, cinco controles al lado de un título lo dejan en tres letras.
 *
 * El campo del tono enseña de fondo el de siempre: vacío es «el de siempre», y
 * escribir uno es cambiarlo solo para este culto.
 */
function FilaCancion({
  cancion: c,
  posicion,
  esPrimera,
  esUltima,
  acciones,
}: {
  cancion: CancionEnTurno;
  posicion: number;
  esPrimera: boolean;
  esUltima: boolean;
  acciones: {
    subir: () => Promise<void>;
    bajar: () => Promise<void>;
    quitar: () => Promise<void>;
    tono: (formData: FormData) => Promise<void>;
  };
}) {
  const claseIcono = 'text-muted-foreground hover:bg-muted hover:text-foreground';

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2.5 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="w-5 flex-none text-right text-[13px] font-bold tabular-nums text-muted-foreground">
          {posicion}
        </span>
        <span className="min-w-0 truncate text-[14.5px] font-semibold">
          {c.titulo}
          {c.autor && (
            <span className="font-normal text-muted-foreground"> · {c.autor}</span>
          )}
        </span>
      </span>

      <span className="flex flex-none items-center gap-1 pl-7 sm:pl-0">
        <form action={acciones.tono} className="flex items-center gap-1">
          <Input
            name="tono"
            maxLength={12}
            defaultValue={c.tonoDelDia ?? ''}
            placeholder={c.tono ?? 'Tono'}
            aria-label={`Tono de ${c.titulo} en este culto`}
            className="h-8 w-16 px-2 text-center text-[14px]"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            title="Guardar el tono"
            aria-label={`Guardar el tono de ${c.titulo}`}
            className={claseIcono}
          >
            <Check strokeWidth={1.8} />
          </Button>
        </form>

        <form action={acciones.subir}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={esPrimera}
            title="Subir"
            aria-label={`Subir ${c.titulo}`}
            className={claseIcono}
          >
            <ArrowUp strokeWidth={1.8} />
          </Button>
        </form>
        <form action={acciones.bajar}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={esUltima}
            title="Bajar"
            aria-label={`Bajar ${c.titulo}`}
            className={claseIcono}
          >
            <ArrowDown strokeWidth={1.8} />
          </Button>
        </form>
        <form action={acciones.quitar}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            title="Quitar de la lista"
            aria-label={`Quitar ${c.titulo} de la lista`}
            className={claseIcono}
          >
            <X strokeWidth={1.8} />
          </Button>
        </form>
      </span>
    </li>
  );
}

/**
 * «Pedro Gómez — Guitarra · también en Medios».
 *
 * El papel que tiene en el equipo va detrás del nombre porque es lo que decide
 * a quién poner en cada puesto: en la lista de «Bajo», ver «— Bajo» al lado de
 * dos personas es la respuesta.
 */
function textoCandidato(
  c: { nombre: string; rolEnMinisterio: string | null },
  otrosEquipos: string[] | undefined,
): string {
  const partes = [c.nombre];
  if (c.rolEnMinisterio) partes.push(`— ${c.rolEnMinisterio}`);
  if (otrosEquipos?.length) partes.push(`· también en ${otrosEquipos.join(', ')}`);
  return partes.join(' ');
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}
