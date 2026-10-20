import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { sumarDias } from '@/lib/agenda/horarios';
import { DIAS_EN_NUEVOS } from '@/lib/seguimiento/consultas';
import { TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS } from '@/lib/rgpd/consentimiento';
import { Aviso } from '@/components/aviso';
import { CasillaAsistencia } from '@/components/casilla-asistencia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../../_components/cabecera';
import { Contenedor } from '../../../../../_components/contenedor';
import { apuntarVisitante } from '../../actions';

export const metadata: Metadata = { title: 'Apuntar a alguien nuevo' };

/**
 * La tarjeta de bienvenida, pasada a mano por el equipo.
 *
 * Pensada para el móvil después del culto, con la tarjeta de papel delante:
 * cinco campos y tres casillas, y nada que haya que pensar. Lo que puede hacer
 * y lo que no, en `apuntarVisitante()`.
 *
 * Sin campo de notas, a propósito. Es el sitio exacto donde acabaría escrito
 * «viene porque se está separando», y eso no lo guarda Hatril en ninguna parte.
 */
export default async function AltaVisitantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; repetido?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error, repetido } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return (
    <>
      <CabeceraPanel
        titulo="Apuntar a alguien nuevo"
        subtitulo="Se crea su ficha como Visitante"
        volver={{
          href: `/panel/ministerios/${id}/seguimiento/nuevos`,
          texto: 'Nuevos',
        }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <form
          action={apuntarVisitante.bind(null, id)}
          className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" required minLength={2} maxLength={120} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidos">
                Apellidos
                <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="apellidos" name="apellidos" maxLength={160} autoComplete="off" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                maxLength={40}
                autoComplete="off"
              />
              <p className="t-label text-muted-foreground">
                Sin él, solo se le puede saludar en persona.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                Correo
                <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="email" name="email" type="email" maxLength={200} autoComplete="off" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:max-w-[50%]">
            <Label htmlFor="fecha">Cuándo vino por primera vez</Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoy}
              min={sumarDias(hoy, -DIAS_EN_NUEVOS)}
              max={hoy}
            />
          </div>

          {/*
           * Si volvió porque el teléfono ya era de otra ficha con otro nombre.
           * Con las casillas, que es lo último que se toca antes de pulsar. Hay
           * que volver a escribir los datos: este repo devuelve los errores por
           * redirección, y los datos de una persona no viajan en la dirección.
           */}
          {repetido && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent">
              {/* Nombre escrito, como en `CasillaAsistencia`: con la casilla dentro
                  del `<label>` y nada más, el lector la anunciaba como «on». */}
              <input
                type="checkbox"
                name="otraPersona"
                aria-label="Sí, es otra persona con el mismo teléfono"
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[14.5px] font-semibold">
                  Sí, es otra persona con el mismo teléfono
                </span>
                <span className="text-pretty text-[13px] leading-snug text-muted-foreground">
                  Pasa en las familias que vienen juntas con un solo móvil. Se
                  creará su ficha aparte.
                </span>
              </span>
            </label>
          )}

          {/*
           * EL PERMISO SE LEE EN VOZ ALTA, COMO EN EL REPARTO
           * -------------------------------------------------
           * Quien apunta lee los textos y marca lo que la persona dice. Los dos
           * textos son los mismos que firma quien entra desde el directorio,
           * palabra por palabra: se guardan con la misma versión, y dos
           * redacciones bajo una versión harían mentir al registro.
           *
           * La primera es obligatoria: sin ella no hay base para apuntar a
           * nadie. La segunda no, y sin `defaultChecked`: el silencio no es
           * consentimiento (considerando 32). Si no la marca, la ficha se crea
           * pero no sale en Nuevos ni en las listas.
           */}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-1 flex flex-col gap-0.5">
              <span className="t-subtitulo">Antes de apuntarle</span>
              <span className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
                Léele las dos casillas y marca lo que te diga. La primera hace
                falta para apuntarle; la segunda la decide esa persona, y puede
                decir que no.
              </span>
            </legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent">
              <input
                type="checkbox"
                name="permiso"
                required
                aria-label="Quiere que la iglesia guarde sus datos"
                aria-describedby="permiso-texto permiso-prueba"
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[14.5px] font-semibold">
                  Quiere que la iglesia guarde sus datos
                </span>
                <span
                  id="permiso-texto"
                  className="text-pretty text-[13.5px] leading-snug text-muted-foreground"
                >
                  {TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}
                </span>
                <span
                  id="permiso-prueba"
                  className="text-pretty text-[13px] leading-snug text-muted-foreground"
                >
                  Si te lo dio por escrito en una tarjeta, guárdala: es la prueba, y
                  la guarda la iglesia.
                </span>
              </span>
            </label>

            <CasillaAsistencia consecuencia="Si no la marca, su ficha se crea igual, pero no sale en Nuevos ni en las listas, y no se le pueden apuntar llamadas." />

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent">
              <input
                type="checkbox"
                name="adulto"
                required
                aria-label="Es mayor de edad"
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[14.5px] font-semibold">Es mayor de edad</span>
                <span className="text-pretty text-[13px] leading-snug text-muted-foreground">
                  Los niños y los adolescentes no se apuntan por aquí.
                </span>
              </span>
            </label>
          </fieldset>

          <div>
            <Button type="submit">Apuntarle</Button>
          </div>
        </form>
      </Contenedor>
    </>
  );
}
