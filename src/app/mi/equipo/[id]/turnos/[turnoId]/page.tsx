import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleCheck,
  Copy,
  Plus,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';

import {
  exigirUuid,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
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
import { estadoDeTurno, textoDelEstado } from '@/lib/turnos/en-la-app';
import { puestosDelMinisterio } from '@/lib/turnos/puestos';
import { ETIQUETA_RESPUESTA } from '@/lib/turnos/respuestas';
import type { RespuestaTurno } from '@/lib/db/schema/turnos';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/turnos/constantes';
import { MarcoEquipo, Rotulo, Vacio } from '../../../_components/marco';
import { AREA, CAMPO, SELECT } from '../../../_components/estilos';
import {
  agregarCancionAlTurno,
  asignarAlTurno,
  borrarTurno,
  cambiarTonoDelDia,
  copiarTurno,
  editarTurno,
  marcarRespuesta,
  moverCancion,
  quitarCancionDelTurno,
  quitarDelTurno,
} from '../actions';

export const metadata: Metadata = { title: 'Turno' };

/**
 * El cuadrante de un culto en la app: quién va a cada puesto, quién ha
 * contestado, y qué se toca.
 *
 * Es la pantalla del sábado por la noche, después de que alguien escriba en el
 * grupo que mañana no puede. Por eso arriba va la línea de lo que falta, con las
 * mismas cuentas que la portada, y cada puesto debajo con su gente.
 *
 * LA RESPUESTA, CON PALABRAS Y NO CON ICONOS SUELTOS
 * --------------------------------------------------
 * En el panel, cambiar la respuesta de alguien son dos iconos con su `title`
 * al pasar el ratón. En el móvil no hay ratón: serían dos dibujos sin nombre al
 * lado de cada persona. Aquí van escritas, como fichas: la insignia dice lo que
 * contestó y debajo las otras dos. Es para el bajista que contestó «sí» en el
 * grupo de WhatsApp y no en la aplicación.
 *
 * SIN NARANJA
 * -----------
 * Cada puesto tiene su «Añadir», cada canción sus flechas. Con un naranja en
 * cualquiera de ellos habría siete, así que todo va en contorno y la regla de
 * uno por pantalla se cumple por abajo.
 */
export default async function TurnoEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; turnoId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, turnoId } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'turnos');
  exigirUuid(turnoId);

  const turno = await obtenerTurno(ctx, turnoId);
  // La guarda comprobó el ministerio de la URL; falta que el turno sea suyo y
  // no del de al lado, igual que en el panel.
  if (!turno || turno.ministerioId !== id) notFound();

  // La lista solo con el repertorio encendido, como en el panel: un equipo de
  // ujieres no tiene nada que tocar.
  const conRepertorio = tieneModulo(ministerio.modulos, 'repertorio');

  const [otros, paraCopiar, lista, repertorio] = await Promise.all([
    otrosTurnosDelDia(ctx, turno),
    turno.personas.length === 0
      ? turnoParaCopiar(ctx, turno, id)
      : Promise.resolve(null),
    conRepertorio ? cancionesDelTurno(ctx, turnoId) : Promise.resolve([]),
    conRepertorio ? cancionesParaElegir(ctx, id) : Promise.resolve([]),
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const puestos = puestosDelMinisterio(ministerio);
  const estado = estadoDeTurno(turno, puestos);
  const falta = textoDelEstado(estado);

  // Los puestos de la lista y, detrás, los que tenga este turno y ya no estén
  // en ella: esa gente sigue yendo, y esconderla haría creer que el puesto
  // está vacío. La misma regla que el panel.
  const enLista = new Set(puestos.map((p) => p.toLocaleLowerCase('es')));
  const huerfanos = [
    ...new Set(
      turno.personas
        .map((p) => p.puesto)
        .filter((p) => !enLista.has(p.toLocaleLowerCase('es'))),
    ),
  ];
  const filas = [...puestos, ...huerfanos];

  const enLaLista = new Set(lista.map((c) => c.id));
  const candidatas = repertorio.filter((c) => !enLaLista.has(c.id));

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={mayuscula(formatearFechaLarga(turno.fecha))}
      subtitulo={`${turno.hora ? `${turno.hora} · ` : ''}${turno.titulo}`}
      volver={rutaApp(id, 'turnos')}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <p
        className={
          'flex items-start gap-2 px-1 text-[14.5px] font-semibold leading-snug ' +
          (falta ? 'text-badge-warning-fg' : 'text-badge-success-fg')
        }
      >
        {falta ? (
          <TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={2} aria-hidden />
        ) : (
          <CircleCheck className="mt-0.5 size-4 flex-none" strokeWidth={2} aria-hidden />
        )}
        {falta ?? 'Todo cubierto y confirmado'}
      </p>

      {turno.notas && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-pretty text-[14.5px] leading-relaxed">
          {turno.notas}
        </p>
      )}

      {paraCopiar && (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface p-4">
          <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
            Este turno está vacío. Puedes empezar con la gente del{' '}
            <span className="font-semibold text-foreground">
              {diaCorto(paraCopiar.fecha, hoy).toLocaleLowerCase('es')}
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

      <Rotulo>Quién va</Rotulo>

      {ministerio.equipo.length === 0 ? (
        <Vacio>
          <p>
            El equipo está vacío, y solo se puede poner en un turno a gente del
            equipo. Súmale gente desde el panel y vuelve aquí.
          </p>
        </Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
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
            const sinCubrir = !huerfano && estado.huecos.includes(puesto);

            return (
              <li
                key={puesto}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[15.5px] font-bold tracking-[-0.012em]">
                    {puesto}
                  </h3>
                  {huerfano ? (
                    <span className="text-[12.5px] text-muted-foreground">
                      Ya no está en la lista de puestos
                    </span>
                  ) : (
                    sinCubrir && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-badge-warning-bg px-2 py-0.5 text-[12px] font-semibold text-badge-warning-fg">
                        <TriangleAlert className="size-3" strokeWidth={2.2} aria-hidden />
                        Sin cubrir
                      </span>
                    )
                  )}
                </div>

                {aqui.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {aqui.map((p) => (
                      <FilaPersona
                        key={p.asignacionId}
                        persona={p}
                        responder={marcarRespuesta.bind(null, id, turnoId, p.miembroId)}
                        quitar={quitarDelTurno.bind(null, id, turnoId, p.asignacionId)}
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
                      className={SELECT}
                    >
                      <option value="" disabled>
                        Poner a alguien…
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
                      size="icon"
                      aria-label={`Añadir a ${puesto}`}
                      title={`Añadir a ${puesto}`}
                    >
                      <UserPlus strokeWidth={1.8} />
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
          className="flex scroll-mt-20 flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15.5px] font-bold tracking-[-0.012em]">
              Qué se toca
            </h2>
            <Link
              href={rutaApp(id, 'repertorio')}
              className="text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              El repertorio
            </Link>
          </div>

          {lista.length === 0 ? (
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              Todavía no hay canciones para este culto. El equipo las verá en su
              agenda, con su tono y dónde escucharlas.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {lista.map((c, i) => (
                <FilaCancion
                  key={c.filaId}
                  cancion={c}
                  posicion={i + 1}
                  esPrimera={i === 0}
                  esUltima={i === lista.length - 1}
                  subir={moverCancion.bind(null, id, turnoId, c.filaId, 'arriba')}
                  bajar={moverCancion.bind(null, id, turnoId, c.filaId, 'abajo')}
                  quitar={quitarCancionDelTurno.bind(null, id, turnoId, c.filaId)}
                  tono={cambiarTonoDelDia.bind(null, id, turnoId, c.filaId)}
                />
              ))}
            </ol>
          )}

          {candidatas.length > 0 ? (
            <form
              action={agregarCancionAlTurno.bind(null, id, turnoId)}
              className="flex flex-col gap-2 border-t border-border pt-3"
            >
              <Label htmlFor="cancionId">Añadir una canción</Label>
              <select
                id="cancionId"
                name="cancionId"
                required
                defaultValue=""
                className={SELECT}
              >
                <option value="" disabled>
                  Elige del repertorio…
                </option>
                {candidatas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                    {c.autor ? ` — ${c.autor}` : ''}
                    {c.tono ? ` (${c.tono})` : ''}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  name="tono"
                  maxLength={12}
                  placeholder="Tono, si cambia"
                  aria-label="Tono para este culto, si no es el de siempre"
                  className={`min-w-0 flex-1 ${CAMPO}`}
                />
                <Button type="submit" variant="outline">
                  <Plus strokeWidth={1.8} />
                  Añadir
                </Button>
              </div>
            </form>
          ) : (
            repertorio.length === 0 && (
              <p className="text-[14px] text-muted-foreground">
                El repertorio está vacío.{' '}
                <Link href={rutaApp(id, 'repertorio', 'nueva')} className="underline">
                  Apunta la primera canción
                </Link>{' '}
                y vuelve aquí.
              </p>
            )
          )}
        </section>
      )}

      <details className="rounded-xl border border-border bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-[15px] font-semibold marker:hidden">
          Cambiar el día, el nombre o las notas
        </summary>

        <form
          action={editarTurno.bind(null, id, turnoId)}
          className="flex flex-col gap-4 border-t border-border p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Qué es</Label>
            <Input
              id="titulo"
              name="titulo"
              required
              maxLength={120}
              defaultValue={turno.titulo}
              className={CAMPO}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="fecha">Día</Label>
              <Input
                id="fecha"
                name="fecha"
                type="date"
                required
                defaultValue={turno.fecha}
                className={CAMPO}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                name="hora"
                type="time"
                defaultValue={turno.hora ?? ''}
                className={CAMPO}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notas">Para el equipo</Label>
            <textarea
              id="notas"
              name="notas"
              rows={2}
              maxLength={1000}
              defaultValue={turno.notas ?? ''}
              placeholder="Llegar a las 9:30 para la prueba de sonido."
              className={AREA}
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

        <div className="flex flex-col items-start gap-3 border-t border-border p-4">
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Borrar el turno se lleva su cuadrante y su lista. No avisa a nadie:
            si ya había gente puesta, díselo tú.
          </p>
          <form action={borrarTurno.bind(null, id, turnoId)}>
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.8} />
              Borrar el turno
            </Button>
          </form>
        </div>
      </details>
    </MarcoEquipo>
  );
}

/**
 * Las dos respuestas que se pueden marcar desde cada estado. La que tiene ya
 * la dice su insignia, debajo del nombre; repetirla como botón ocupaba una
 * tercera ficha que a 375 px saltaba de línea.
 */
const SIGUIENTES: Record<RespuestaTurno, RespuestaTurno[]> = {
  pendiente: ['confirmado', 'no_puede'],
  confirmado: ['no_puede', 'pendiente'],
  no_puede: ['confirmado', 'pendiente'],
};

/** Lo que dice cada ficha: lo que se marca, en dos palabras. */
const MARCAR: Record<RespuestaTurno, string> = {
  confirmado: 'Confirma',
  no_puede: 'No puede',
  pendiente: 'Sin contestar',
};

function FilaPersona({
  persona: p,
  responder,
  quitar,
}: {
  persona: PersonaEnTurno;
  /** La respuesta viaja en el campo oculto de cada ficha. */
  responder: (formData: FormData) => Promise<void>;
  quitar: () => Promise<void>;
}) {
  const estado = ETIQUETA_RESPUESTA[p.respuesta];

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt p-2.5">
      <div className="flex items-center gap-2.5">
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
        <form action={quitar}>
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
      </div>

      {/* Un formulario por ficha: con el `bind` de las server actions, dos
          submits en el mismo form comparten destino. */}
      <div
        className="flex flex-wrap gap-1.5 pl-[42px]"
        role="group"
        aria-label={`Marcar la respuesta de ${p.nombre}`}
      >
        {SIGUIENTES[p.respuesta].map((r) => {
          const Icono = ETIQUETA_RESPUESTA[r].Icono;
          return (
            <form key={r} action={responder}>
              <input type="hidden" name="respuesta" value={r} />
              <button
                type="submit"
                aria-label={`${MARCAR[r]}: ${p.nombre}`}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground"
              >
                <Icono className="size-3.5" strokeWidth={2.1} aria-hidden />
                {MARCAR[r]}
              </button>
            </form>
          );
        })}
      </div>
    </li>
  );
}

/**
 * Una canción de la lista: su número y título arriba, y debajo el tono de ese
 * día y los botones de moverla o quitarla. En una sola fila, cinco controles al
 * lado del título lo dejan en tres letras.
 */
function FilaCancion({
  cancion: c,
  posicion,
  esPrimera,
  esUltima,
  subir,
  bajar,
  quitar,
  tono,
}: {
  cancion: CancionEnTurno;
  posicion: number;
  esPrimera: boolean;
  esUltima: boolean;
  subir: () => Promise<void>;
  bajar: () => Promise<void>;
  quitar: () => Promise<void>;
  tono: (formData: FormData) => Promise<void>;
}) {
  const icono = 'text-muted-foreground hover:bg-muted hover:text-foreground';

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2.5">
      <span className="flex min-w-0 items-baseline gap-2.5">
        <span className="w-5 flex-none text-right text-[13px] font-bold tabular-nums text-muted-foreground">
          {posicion}
        </span>
        <span className="min-w-0 text-[14.5px] font-semibold leading-snug">
          {c.titulo}
          {c.autor && (
            <span className="font-normal text-muted-foreground"> · {c.autor}</span>
          )}
        </span>
      </span>

      <span className="flex items-center gap-1 pl-7">
        <form action={tono} className="flex items-center gap-1">
          <Input
            name="tono"
            maxLength={12}
            defaultValue={c.tonoDelDia ?? ''}
            placeholder={c.tono ?? 'Tono'}
            aria-label={`Tono de ${c.titulo} en este culto`}
            className={`h-9 w-[72px] px-2 text-center ${CAMPO}`}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            title="Guardar el tono"
            aria-label={`Guardar el tono de ${c.titulo}`}
            className={icono}
          >
            <Check strokeWidth={1.8} />
          </Button>
        </form>

        <span className="flex-1" />

        <form action={subir}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={esPrimera}
            aria-label={`Subir ${c.titulo}`}
            className={icono}
          >
            <ArrowUp strokeWidth={1.8} />
          </Button>
        </form>
        <form action={bajar}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={esUltima}
            aria-label={`Bajar ${c.titulo}`}
            className={icono}
          >
            <ArrowDown strokeWidth={1.8} />
          </Button>
        </form>
        <form action={quitar}>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar ${c.titulo} de la lista`}
            className={icono}
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
 * La misma que el panel: el papel que tiene en el equipo es lo que decide a
 * quién poner en cada puesto, y «también en Medios» avisa sin prohibir.
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
