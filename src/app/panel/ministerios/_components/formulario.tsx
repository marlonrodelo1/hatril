import Link from 'next/link';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLORES_MINISTERIO } from '@/lib/ministerios/colores';
import {
  MODULOS_MINISTERIO,
  modulosActivos,
  sinConfigurar,
} from '@/lib/ministerios/modulos';
import {
  TIPOS_MINISTERIO,
  modulosDelTipo,
  tipoDeMinisterio,
} from '@/lib/ministerios/tipos';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';

/**
 * Alta y edición de un ministerio.
 *
 * AQUÍ NO SE NOMBRA AL RESPONSABLE
 * --------------------------------
 * Había un desplegable con los integrantes, y se fue con la migración `0005`.
 * Ahora un ministerio admite varios líderes, y una lista de personas con su rol
 * no cabe en un `<select>` de valor único.
 *
 * Se nombra desde la pantalla del ministerio, en la propia fila de cada persona.
 * Que es además donde el pastor está mirando cuando decide quién manda: con las
 * caras del equipo delante, no en un formulario de datos.
 *
 * LAS HERRAMIENTAS SOLO SE EDITAN AL EDITAR
 * -----------------------------------------
 * Al crear, las enciende la plantilla del tipo y se dice qué va a pasar. Al
 * editar, se pintan las casillas con lo que hay guardado.
 *
 * Podrían pintarse también en el alta, pero no servirían de nada: para que se
 * marcaran solas al cambiar el tipo haría falta JavaScript de cliente, y sin él
 * el pastor vería unas casillas que ignoran el desplegable que tiene justo
 * encima. Un control que no responde a lo que hay al lado se lee como un fallo.
 *
 * Todo entrada nativa —`select`, `radio`, `checkbox`— porque este formulario
 * viaja en el `FormData` de una server action. Los de Base UI guardan el valor
 * en estado de React y exigirían un input oculto detrás de cada uno.
 */
export function FormularioMinisterio({
  accion,
  ministerio,
  error,
}: {
  accion: (formData: FormData) => Promise<void>;
  ministerio?: MinisterioDetalle;
  error?: string;
}) {
  const colorActual = ministerio?.colorHex ?? COLORES_MINISTERIO[0].hex;
  const tipoActual = tipoDeMinisterio(ministerio?.tipo);

  // Un ministerio anterior a esta columna tiene `{}`, y le toca la plantilla de
  // su tipo. Uno que apagó las casillas a mano tiene las claves escritas con
  // `activo: false`, y esa decisión se respeta.
  const marcados = new Set(
    ministerio && !sinConfigurar(ministerio.modulos)
      ? modulosActivos(ministerio.modulos).map((m) => m.id)
      : modulosDelTipo(ministerio?.tipo),
  );

  return (
    <form action={accion} className="flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Nombre del ministerio</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            autoFocus
            maxLength={80}
            defaultValue={ministerio?.nombre}
            placeholder="Alabanza"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipo">De qué va</Label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipoActual.id}
            className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
          >
            {TIPOS_MINISTERIO.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <p className="t-label text-muted-foreground">
            {ministerio
              ? tipoActual.descripcion
              : 'Decide qué herramientas trae encendidas de salida. Luego las cambias cuando quieras.'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descripcion">
            Qué hace
            <span className="ml-1.5 font-normal text-muted-foreground">
              (opcional)
            </span>
          </Label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            maxLength={400}
            defaultValue={ministerio?.descripcion ?? ''}
            placeholder="Música y canto en los cultos del domingo. Ensayo los jueves a las 19:30."
            className={CLASE_TEXTAREA}
          />
        </div>

        {/*
         * Cinco colores fijos y no un selector libre. El porqué está en
         * `lib/ministerios/colores.ts`: cada color lleva su pareja suave para
         * el fondo, y con un color arbitrario esa pareja habría que inventarla.
         *
         * Radios nativos: viajan en el FormData sin JavaScript de por medio, y
         * el teclado los recorre con las flechas por ser un mismo `name`.
         */}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="t-label mb-2.5">Color de la etiqueta</legend>
          <div className="flex flex-wrap gap-2.5">
            {COLORES_MINISTERIO.map((c) => (
              <label
                key={c.hex}
                className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface-alt px-3 py-2.5 text-[14px] font-medium has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground"
              >
                <input
                  type="radio"
                  name="colorHex"
                  value={c.hex}
                  defaultChecked={c.hex === colorActual}
                  className="sr-only"
                />
                <span
                  className="flex size-7 items-center justify-center rounded-lg"
                  style={{ background: c.suave }}
                >
                  <span
                    className="size-3 rounded-sm"
                    style={{ background: c.hex }}
                  />
                </span>
                {c.nombre}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/*
       * Tres campos y no uno largo: son tres preguntas distintas y un pastor las
       * contesta por separado. Juntas en un textarea se acaba escribiendo solo
       * la primera.
       *
       * El objetivo va el primero porque es el único que se revisa: la misión y
       * la visión se escriben una vez y duran años.
       */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Hacia dónde trabaja</h2>
          <p className="t-label text-muted-foreground">
            Todo opcional, y se puede rellenar más adelante. Lo ve el equipo al
            entrar en su ministerio.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="objetivo">Objetivo de esta temporada</Label>
          <textarea
            id="objetivo"
            name="objetivo"
            rows={2}
            maxLength={600}
            defaultValue={ministerio?.objetivo ?? ''}
            placeholder="Que en diciembre el equipo pueda cubrir los dos cultos sin repetir a nadie dos domingos seguidos."
            className={CLASE_TEXTAREA}
          />
          <p className="t-label text-muted-foreground">
            Lo concreto. Lo que se puede mirar dentro de unos meses y saber si se
            ha cumplido.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mision">Misión</Label>
            <textarea
              id="mision"
              name="mision"
              rows={3}
              maxLength={600}
              defaultValue={ministerio?.mision ?? ''}
              placeholder="Servir a la congregación conduciéndola en la adoración cada domingo."
              className={CLASE_TEXTAREA}
            />
            <p className="t-label text-muted-foreground">Lo que hace hoy.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vision">Visión</Label>
            <textarea
              id="vision"
              name="vision"
              rows={3}
              maxLength={600}
              defaultValue={ministerio?.vision ?? ''}
              placeholder="Un equipo donde cada persona sepa tocar y enseñar a otra."
              className={CLASE_TEXTAREA}
            />
            <p className="t-label text-muted-foreground">
              A dónde quiere llegar.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-subtitulo">Herramientas del equipo</h2>
          <p className="t-label text-muted-foreground">
            No todos los ministerios hacen lo mismo. Enciende solo lo que este
            vaya a usar.
          </p>
        </div>

        {ministerio ? (
          <div className="flex flex-col gap-2.5">
            {MODULOS_MINISTERIO.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-background has-checked:border-primary"
              >
                <input
                  type="checkbox"
                  name="modulos"
                  value={m.id}
                  defaultChecked={marcados.has(m.id)}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    <m.Icono
                      className="size-4 text-muted-foreground"
                      strokeWidth={1.9}
                      aria-hidden
                    />
                    {m.nombre}
                  </span>
                  <span className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
                    {m.descripcion}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Al crearlo se encienden las herramientas propias del tipo que elijas
            arriba. Después las cambias desde esta misma pantalla.
          </p>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit">
          {ministerio ? 'Guardar los cambios' : 'Crear el ministerio'}
        </Button>
        <Button
          variant="ghost"
          render={
            <Link
              href={
                ministerio
                  ? `/panel/ministerios/${ministerio.id}`
                  : '/panel/ministerios'
              }
            />
          }
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Repetida en cinco textareas; a mano se despareja en cuanto se toca una. */
const CLASE_TEXTAREA =
  'rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';
