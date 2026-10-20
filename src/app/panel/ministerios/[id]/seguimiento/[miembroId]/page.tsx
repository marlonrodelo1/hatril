import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MessageCircle, Phone, Trash2 } from 'lucide-react';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';
import {
  SE_QUEDA,
  acompanaDe,
  contactosDe,
  personasPorFaltas,
  queSabemosDeSiVolvio,
  type EtapaNuevo,
} from '@/lib/seguimiento/consultas';
import {
  RESULTADOS,
  RESULTADOS_ELEGIBLES,
  VIAS,
  VIAS_ELEGIBLES,
} from '@/lib/seguimiento/catalogos';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import {
  asignarAcompanante,
  borrarContacto,
  registrarContacto,
} from '../actions';
import { CONFIRMACIONES } from '../constantes';

export const metadata: Metadata = { title: 'Seguimiento de una persona' };

export default async function PersonaEnSeguimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; miembroId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, miembroId } = await params;
  // Las tres puertas de su layout aquí, y no solo allí: ver CLAUDE.md.
  const { ctx, ministerio } = await requireModuloMinisterio(id, 'seguimiento', {
    permiso: 'ver_seguimiento',
  });
  const { error, guardado } = await searchParams;

  // La persona sale de la MISMA consulta que la lista, y no de una nueva contra
  // `miembros`: así el ámbito de quién es visible aquí no puede separarse del de
  // la lista. Dos consultas distintas para la misma pregunta acaban dando
  // respuestas distintas, y aquí la respuesta es a quién se le puede leer el
  // seguimiento.
  //
  // De aquí sale también el 404 para quien negó el permiso de asistencia —la
  // lista lo filtra—, que es lo que `/privacidad` §4 promete. Cambiar esto por
  // una consulta directa contra `miembros` reabriría su ficha con su uuid. Las
  // actions preguntan lo mismo con `estaEnSeguimiento()`, que tira de la misma
  // función.
  const persona = (await personasPorFaltas(ctx, id)).find(
    (p) => p.miembroId === miembroId,
  );
  if (!persona) notFound();

  const [contactos, acompanaId] = await Promise.all([
    contactosDe(ctx, id, miembroId),
    acompanaDe(ctx, id, miembroId),
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const base = `/panel/ministerios/${id}/seguimiento`;
  const whatsapp = enlaceWhatsApp(persona.telefono);

  // Quien acompaña sale del equipo de ESTE ministerio, que es lo que HT118
  // exige en la base. Ofrecer la congregación entera dejaría elegir a alguien
  // que la base va a rechazar.
  const equipo = ministerio.equipo;

  return (
    <>
      <CabeceraPanel
        titulo={persona.nombre}
        // Vuelve a la lista de la que vino: a quien acaba de llegar se le abre
        // desde «Nuevos», y en ausentes no está.
        volver={
          persona.nuevo
            ? { href: `${base}/nuevos`, texto: 'Nuevos' }
            : { href: base, texto: ministerio.nombre }
        }
      >
        {persona.telefono && (
          <Button variant="outline" render={<a href={`tel:${persona.telefono}`} />}>
            <Phone strokeWidth={1.8} />
            {persona.telefono}
          </Button>
        )}
        {/*
         * WhatsApp abre la conversación con ese número, nada más: no se manda
         * nada desde Hatril ni se le pasa ningún texto. El mensaje lo escribe
         * quien acompaña, desde su teléfono, y el contacto lo apunta aquí.
         */}
        {whatsapp && (
          <Button
            variant="outline"
            render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle strokeWidth={1.8} />
            WhatsApp
          </Button>
        )}
      </CabeceraPanel>

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
          <span
            className={`flex size-12 flex-none items-center justify-center rounded-full text-[14px] font-bold ${ESTADOS[persona.estado].avatar}`}
          >
            {iniciales(persona.nombre)}
          </span>
          {persona.nuevo ? (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                Llegó el {formatearFechaLarga(persona.llegada)}
              </span>
              <span className="text-[13.5px] text-muted-foreground">
                {ETAPAS[persona.nuevo.etapa]}
                {persona.nuevo.etapa === 'llego'
                  ? ` ${queSabemosDeSiVolvio(persona.faltasSeguidas, persona.nuevo)}`
                  : persona.ultimaAsistencia &&
                    ` La última vez que vino fue el ${formatearFechaLarga(persona.ultimaAsistencia)}.`}
              </span>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                {persona.ultimaAsistencia
                  ? `Vino por última vez el ${formatearFechaLarga(persona.ultimaAsistencia)}`
                  : 'Nunca se le ha marcado presente en una reunión'}
              </span>
              <span className="text-[13.5px] text-muted-foreground">
                Se ha perdido {persona.faltasSeguidas}{' '}
                {persona.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} de las que
                se pasó lista.
              </span>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Quién le acompaña</h2>
            <p className="t-label text-muted-foreground">
              Del equipo de {ministerio.nombre}. Sin un nombre al lado no llama
              nadie, porque todos suponen que llama otro.
            </p>
          </div>

          {equipo.length === 0 ? (
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Este ministerio todavía no tiene a nadie.{' '}
              <Link href={`/panel/ministerios/${id}`} className="underline">
                Súmale gente
              </Link>{' '}
              y vuelve aquí.
            </p>
          ) : (
            <form
              action={asignarAcompanante.bind(null, id, miembroId)}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="hoy" value={hoy} />
              <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <Label htmlFor="responsable">Le acompaña</Label>
                <select
                  id="responsable"
                  name="responsable"
                  defaultValue={acompanaId ?? ''}
                  className={CLASE_SELECT}
                >
                  <option value="">Sin asignar</option>
                  {equipo.map((p) => (
                    <option key={p.miembroId} value={p.miembroId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline">
                Guardar
              </Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Apuntar un contacto</h2>
            <p className="t-label text-muted-foreground">
              Lo que se intentó y qué pasó. Queda con tu nombre y con la fecha.
            </p>
          </div>

          <form
            action={registrarContacto.bind(null, id)}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="miembroId" value={miembroId} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha">Cuándo</Label>
                <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="via">Cómo</Label>
                <select
                  id="via"
                  name="via"
                  defaultValue="llamada"
                  className={CLASE_SELECT}
                >
                  {VIAS_ELEGIBLES.map((v) => (
                    <option key={v} value={v}>
                      {VIAS[v]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/*
             * Radios y no un desplegable: son siete opciones que el voluntario
             * tiene que LEER antes de elegir, con su explicación al lado. En un
             * `<select>` la ayuda no cabe, y «no contesta» acabaría marcándose
             * para todo por ser la primera que suena razonable.
             */}
            <fieldset className="flex flex-col gap-2">
              <legend className="t-label mb-2">Qué pasó</legend>
              {RESULTADOS_ELEGIBLES.map((r, i) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent"
                >
                  <input
                    type="radio"
                    name="resultado"
                    value={r}
                    defaultChecked={i === 0}
                    className="mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold">
                      {RESULTADOS[r].etiqueta}
                    </span>
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      {RESULTADOS[r].ayuda}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proximoPaso">
                Qué toca ahora
                <span className="ml-1.5 font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="proximoPaso"
                name="proximoPaso"
                maxLength={200}
                placeholder="Llamarla otra vez el sábado por la mañana"
              />
              {/*
               * El aviso va aquí, en el único campo libre del módulo y en el
               * momento exacto en que alguien está a punto de escribir. Una
               * política que nadie abre no habría evitado nada.
               */}
              <p className="t-label text-muted-foreground">
                Un recordatorio, no un informe. Nada de salud, dinero ni
                situación familiar: Hatril no guarda eso, y aquí tampoco.
              </p>
            </div>

            <div>
              <Button type="submit">Apuntar el contacto</Button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
          <h2 className="t-subtitulo">Lo que se ha hablado</h2>

          {contactos.length === 0 ? (
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Todavía nada. Lo que apuntes aquí es lo que evita que la próxima
              persona que abra esta pantalla vuelva a empezar de cero.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {contactos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${RESULTADOS[c.resultado].badge}`}
                      >
                        {RESULTADOS[c.resultado].etiqueta}
                      </span>
                      <span className="text-[13px] text-muted-foreground first-letter:uppercase">
                        {formatearFechaLarga(c.fecha)} · {VIAS[c.via]}
                      </span>
                    </span>
                    {c.proximoPaso && (
                      <span className="text-pretty text-[14px] leading-snug">
                        {c.proximoPaso}
                      </span>
                    )}
                    <span className="text-[12.5px] text-muted-foreground">
                      Lo apuntó {c.autor}
                    </span>
                  </div>

                  <form action={borrarContacto.bind(null, id, miembroId, c.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      title="Borrar este contacto"
                      aria-label="Borrar este contacto"
                    >
                      <Trash2 strokeWidth={1.8} />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Contenedor>
    </>
  );
}

/**
 * 16 px por debajo de `md`, como el `Input` de `components/ui`: con menos,
 * Safari de iOS amplía la página al tocar el desplegable y no la devuelve. Es
 * el camino de después del alta rápida, que se hace con el móvil en la mano.
 */
const CLASE_SELECT =
  'h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px]';

const ETAPAS: Record<EtapaNuevo, string> = {
  llego: 'Ha venido una vez.',
  volvio: 'Ha vuelto a algún culto con lista después de su primera visita.',
  se_queda: `Viene: ${SE_QUEDA.presencias} o más de las últimas ${SE_QUEDA.deLasUltimas} reuniones con lista.`,
};

/**
 * El enlace de WhatsApp, o `null` si el número no está en internacional.
 *
 * `wa.me` quiere el número con su prefijo y sin el más, igual que en
 * `iglesias/redes.ts`. Un teléfono que `normalizarTelefono` no supo poner en
 * E.164 se queda sin botón: adivinarle el país abriría el chat de otra persona.
 */
function enlaceWhatsApp(telefono: string | null): string | null {
  if (!telefono?.startsWith('+')) return null;
  const digitos = telefono.slice(1).replace(/\D/g, '');
  return digitos.length >= 8 ? `https://wa.me/${digitos}` : null;
}
