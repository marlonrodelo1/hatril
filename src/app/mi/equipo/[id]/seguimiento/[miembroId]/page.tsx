import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Phone, Trash2 } from 'lucide-react';

import {
  exigirUuid,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import {
  acompanaDe,
  contactosDe,
  personasPorFaltas,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/seguimiento/constantes';
import { MarcoEquipo, Rotulo } from '../../../_components/marco';
import { CAMPO, SELECT } from '../../../_components/estilos';
import {
  asignarAcompanante,
  borrarContacto,
  registrarContacto,
} from '../actions';

export const metadata: Metadata = { title: 'Seguimiento de una persona' };

/**
 * Llamar a alguien y apuntar lo que pasó, desde el móvil.
 *
 * LA PERSONA SALE DE LA LISTA, NO DE `miembros`
 * ---------------------------------------------
 * Como en el panel: `personasPorFaltas` es la única puerta, y de ahí sale el
 * 404 para quien negó el permiso de asistencia. Una consulta directa a la ficha
 * reabriría su seguimiento con solo saber su uuid.
 *
 * El orden es el del gesto: arriba el botón de llamar, debajo el formulario de
 * lo que pasó —con la fecha de hoy ya puesta—, y después la historia. El
 * naranja es «Apuntar el contacto». Llamar es un enlace `tel:` en contorno: es
 * una salida de la app, no lo que se guarda.
 */
export default async function PersonaEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; miembroId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, miembroId } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'seguimiento');
  exigirUuid(miembroId);

  const persona = (await personasPorFaltas(ctx, id)).find(
    (p) => p.miembroId === miembroId,
  );
  if (!persona) notFound();

  const [contactos, acompanaId] = await Promise.all([
    contactosDe(ctx, id, miembroId),
    acompanaDe(ctx, id, miembroId),
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={persona.nombre}
      subtitulo={ministerio.nombre}
      volver={rutaApp(id, 'seguimiento')}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-12 flex-none items-center justify-center rounded-full text-[14px] font-bold ${ESTADOS[persona.estado].avatar}`}
          >
            {iniciales(persona.nombre)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold leading-snug">
              {persona.ultimaAsistencia
                ? `Vino por última vez el ${formatearFechaLarga(persona.ultimaAsistencia)}`
                : 'Nunca se le ha marcado presente en una reunión'}
            </span>
            <span className="text-[13px] text-muted-foreground">
              Se ha perdido {persona.faltasSeguidas}{' '}
              {persona.faltasSeguidas === 1 ? 'reunión' : 'reuniones'} de las que
              se pasó lista.
            </span>
          </div>
        </div>
        {persona.telefono ? (
          <Button
            variant="outline"
            size="lg"
            render={<a href={`tel:${persona.telefono}`} />}
          >
            <Phone strokeWidth={1.8} />
            Llamar · {persona.telefono}
          </Button>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">
            No tiene teléfono apuntado en su ficha.
          </p>
        )}
      </section>

      <form
        action={registrarContacto.bind(null, id, miembroId)}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
      >
        <input type="hidden" name="miembroId" value={miembroId} />
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Apuntar un contacto</h2>
          <p className="t-label text-muted-foreground">
            Lo que se intentó y qué pasó. Queda con tu nombre y con la fecha.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="fecha">Cuándo</Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoy}
              max={hoy}
              className={CAMPO}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="via">Cómo</Label>
            <select id="via" name="via" defaultValue="llamada" className={SELECT}>
              {VIAS_ELEGIBLES.map((v) => (
                <option key={v} value={v}>
                  {VIAS[v]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Radios y no un desplegable, como en el panel: son siete opciones que
            hay que LEER, con su explicación al lado. */}
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
                className="mt-0.5 size-[18px] flex-none accent-primary"
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
            <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="proximoPaso"
            name="proximoPaso"
            maxLength={200}
            placeholder="Llamarla otra vez el sábado"
            className={CAMPO}
          />
          {/* El aviso va en el único campo libre del módulo, en el momento en
              que alguien está a punto de escribir. */}
          <p className="t-label text-muted-foreground">
            Un recordatorio, no un informe. Nada de salud, dinero ni situación
            familiar: Hatril no guarda eso, y aquí tampoco.
          </p>
        </div>

        <div>
          <Button type="submit" size="lg">
            Apuntar el contacto
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Quién le acompaña</h2>
          <p className="t-label text-muted-foreground">
            Del equipo de {ministerio.nombre}. Sin un nombre al lado, nadie llama
            porque todos suponen que llama otro.
          </p>
        </div>
        {ministerio.equipo.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">
            Este ministerio todavía no tiene a nadie en su equipo.
          </p>
        ) : (
          <form
            action={asignarAcompanante.bind(null, id, miembroId)}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="hoy" value={hoy} />
            <select
              name="responsable"
              defaultValue={acompanaId ?? ''}
              aria-label="Le acompaña"
              className={SELECT}
            >
              <option value="">Sin asignar</option>
              {ministerio.equipo.map((p) => (
                <option key={p.miembroId} value={p.miembroId}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Guardar
            </Button>
          </form>
        )}
      </section>

      <Rotulo>Lo que se ha hablado</Rotulo>
      {contactos.length === 0 ? (
        <p className="px-1 text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          Todavía nada. Lo que apuntes aquí evita que la próxima persona que abra
          esta pantalla vuelva a empezar de cero.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contactos.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5"
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
                  aria-label="Borrar este contacto"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 strokeWidth={1.8} />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </MarcoEquipo>
  );
}
