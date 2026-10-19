import Link from 'next/link';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ESTADOS, ESTADOS_ELEGIBLES } from '@/lib/miembros/estados';
import type { FichaMiembro } from '@/lib/miembros/consultas';
import type { RolEquipo } from '@/lib/db/schema';

/**
 * Formulario de alta y edición de una persona.
 *
 * SOLO EL NOMBRE ES OBLIGATORIO
 * -----------------------------
 * Todo lo demás puede quedarse en blanco. Un pastor apunta a alguien justo
 * después del culto con lo que sabe en ese momento —a veces solo el nombre de
 * pila— y lo completa cuando puede. Un formulario que exige correo y teléfono
 * para guardar consigue que esa persona no se apunte, no que se apunte mejor.
 *
 * LOS DATOS PROTEGIDOS VAN APARTE Y SE DICE POR QUÉ
 * ------------------------------------------------
 * Nacimiento, dirección, estado civil y notas se agrupan en su propio bloque
 * con un aviso. No es decoración: quien rellena esto tiene que saber que está
 * escribiendo datos de categoría especial, porque es la persona que decide qué
 * se guarda y qué no.
 *
 * Es un formulario nativo con `action`: funciona sin JavaScript, y los campos
 * conservan lo escrito al volver de un error porque el servidor los repinta con
 * `defaultValue`.
 */
export function FormularioMiembro({
  accion,
  miembro,
  ministerios,
  liderazgo = [],
  puedeSacarLideres = false,
  puedeVerSensibles,
  error,
}: {
  accion: (formData: FormData) => Promise<void>;
  miembro?: FichaMiembro;
  ministerios: { id: string; nombre: string }[];
  /** Dónde es responsable o colíder. Solo al editar: en un alta no hay. */
  liderazgo?: { ministerioId: string; rolEquipo: RolEquipo }[];
  /** Pastor o `gestionar_ministerios`: puede sacarle también de donde lidera. */
  puedeSacarLideres?: boolean;
  puedeVerSensibles: boolean;
  error?: string;
}) {
  const ministeriosActuales = new Set(miembro?.ministerios.map((m) => m.id));
  const rolEn = new Map(
    liderazgo
      .filter((l) => l.rolEquipo !== 'voluntario')
      .map((l) => [l.ministerioId, l.rolEquipo]),
  );
  const hayFijos =
    !puedeSacarLideres && ministerios.some((m) => rolEn.has(m.id));

  return (
    <form action={accion} className="flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}

      <Bloque titulo="Quién es">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" nombre="nombre" requerido>
            <Input
              id="nombre"
              name="nombre"
              required
              autoFocus
              maxLength={120}
              defaultValue={miembro?.nombre}
              placeholder="Lucía"
            />
          </Campo>

          <Campo etiqueta="Apellidos" nombre="apellidos">
            <Input
              id="apellidos"
              name="apellidos"
              maxLength={160}
              defaultValue={miembro?.apellidos ?? ''}
              placeholder="Ferrer Ramos"
            />
          </Campo>

          <Campo etiqueta="Teléfono" nombre="telefono">
            <Input
              id="telefono"
              name="telefono"
              type="tel"
              maxLength={40}
              defaultValue={miembro?.telefono ?? ''}
              placeholder="300 123 4567"
            />
          </Campo>

          <Campo etiqueta="Correo" nombre="email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={miembro?.email ?? ''}
              placeholder="lucia@correo.com"
            />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="En la iglesia">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Situación" nombre="estado">
            <select
              id="estado"
              name="estado"
              defaultValue={miembro?.estado ?? 'visitante'}
              className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            >
              {ESTADOS_ELEGIBLES.map((e) => (
                <option key={e} value={e}>
                  {ESTADOS[e].etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <Campo
            etiqueta="Desde cuándo viene"
            nombre="fechaIngreso"
            ayuda="Si lo dejas vacío, se pone la fecha de hoy."
          >
            <Input
              id="fechaIngreso"
              name="fechaIngreso"
              type="date"
              defaultValue={miembro?.fechaIngreso ?? ''}
            />
          </Campo>
        </div>

        <label className="flex cursor-pointer items-center gap-3 pt-1">
          <input
            type="checkbox"
            name="bautizado"
            defaultChecked={miembro?.bautizado}
          />
          <span className="text-[15px]">Está bautizada o bautizado</span>
        </label>

        <Campo etiqueta="Fecha del bautismo" nombre="fechaBautismo">
          <Input
            id="fechaBautismo"
            name="fechaBautismo"
            type="date"
            defaultValue={miembro?.fechaBautismo ?? ''}
            className="sm:max-w-[240px]"
          />
        </Campo>

        {ministerios.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            <span className="t-label">Ministerios en los que sirve</span>
            <div className="flex flex-wrap gap-2">
              {ministerios.map((m) => {
                const rol = rolEn.get(m.id);
                // Donde lidera, a quien no gobierna los ministerios la casilla
                // se le queda marcada y quieta: desmarcarla haría rebotar el
                // guardado entero. Deshabilitada no viaja en el envío, así que
                // el valor va en un oculto; si no, se leería como desmarcada.
                // La que manda sigue siendo la comprobación de la action.
                const fija = rol !== undefined && !puedeSacarLideres;
                return (
                  <label
                    key={m.id}
                    className={
                      'flex items-center gap-2.5 rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 text-[14px] font-medium ' +
                      (fija ? 'cursor-default' : 'cursor-pointer hover:bg-surface-active')
                    }
                  >
                    <input
                      type="checkbox"
                      name={fija ? undefined : 'ministerios'}
                      value={m.id}
                      defaultChecked={fija || ministeriosActuales.has(m.id)}
                      disabled={fija}
                    />
                    {fija && <input type="hidden" name="ministerios" value={m.id} />}
                    {m.nombre}
                    {rol && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-accent-foreground">
                        {rol === 'responsable' ? 'Responsable' : 'Colíder'}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {hayFijos && (
              <p className="t-label text-muted-foreground">
                Donde es responsable o colíder no se le puede sacar desde aquí.
                Pídeselo al pastor.
              </p>
            )}
          </div>
        )}
      </Bloque>

      {/*
       * Si quien rellena no tiene el permiso, estos campos no se pintan. Que
       * no los pise con vacíos NO lo garantiza esto: no viajar es llegar como
       * null. Lo garantiza `datosProtegidos()` en las actions, que los deja
       * fuera del UPDATE. Este comentario decía lo contrario y era falso.
       */}
      {puedeVerSensibles && (
        <Bloque
          titulo="Datos protegidos"
          nota="Estos datos están especialmente protegidos por la ley. Guarda solo lo que la iglesia necesite de verdad, y cuenta con que cada consulta queda registrada."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Fecha de nacimiento" nombre="fechaNacimiento">
              <Input
                id="fechaNacimiento"
                name="fechaNacimiento"
                type="date"
                defaultValue={miembro?.sensibles?.fechaNacimiento ?? ''}
              />
            </Campo>

            <Campo etiqueta="Estado civil" nombre="estadoCivil">
              <Input
                id="estadoCivil"
                name="estadoCivil"
                maxLength={60}
                defaultValue={miembro?.sensibles?.estadoCivil ?? ''}
                placeholder="Casada, soltero…"
              />
            </Campo>

            <Campo etiqueta="Dirección" nombre="direccion">
              <Input
                id="direccion"
                name="direccion"
                maxLength={240}
                defaultValue={miembro?.sensibles?.direccion ?? ''}
              />
            </Campo>

            <Campo etiqueta="Ciudad o barrio" nombre="ciudad">
              <Input
                id="ciudad"
                name="ciudad"
                maxLength={120}
                defaultValue={miembro?.sensibles?.ciudad ?? ''}
              />
            </Campo>
          </div>

          <Campo
            etiqueta="Notas"
            nombre="notas"
            ayuda="Para lo que ayude a acompañarla. Evita datos de salud si no son imprescindibles."
          >
            <textarea
              id="notas"
              name="notas"
              rows={4}
              maxLength={2000}
              defaultValue={miembro?.sensibles?.notas ?? ''}
              className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            />
          </Campo>
        </Bloque>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit">
          {miembro ? 'Guardar los cambios' : 'Añadir a la iglesia'}
        </Button>
        <Button
          variant="ghost"
          render={
            <Link
              href={miembro ? `/panel/miembros?ficha=${miembro.id}` : '/panel/miembros'}
            />
          }
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="t-subtitulo">{titulo}</h2>
        {nota && (
          <p className="text-pretty text-[13px] leading-snug text-muted-foreground">
            {nota}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Campo({
  etiqueta,
  nombre,
  ayuda,
  requerido,
  children,
}: {
  etiqueta: string;
  nombre: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nombre}>
        {etiqueta}
        {!requerido && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            (opcional)
          </span>
        )}
      </Label>
      {children}
      {ayuda && <p className="t-label text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
