import Link from 'next/link';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReunionDetalle } from '@/lib/asistencia/consultas';

/**
 * Alta y edición de una reunión de la congregación.
 *
 * NO HAY SELECTOR DE MINISTERIO
 * -----------------------------
 * Esta pantalla crea reuniones de la iglesia entera, y solo esas cuentan para el
 * histórico de asistencia. Las de un equipo —el ensayo del jueves, la clase de
 * los niños— se crean desde la agenda de su propio ministerio, que es donde el
 * responsable está mirando cuando las apunta.
 *
 * Un desplegable aquí con «(ninguno)» y catorce ministerios pondría al pastor a
 * decidir algo cuyas consecuencias no se ven en la pantalla: elegir «Alabanza»
 * sacaría esa reunión del cómputo de asistencia sin decirlo en ningún sitio.
 */
export function FormularioReunion({
  accion,
  reunion,
  error,
  hoy,
  cancelarHref,
  etiquetas,
}: {
  accion: (formData: FormData) => Promise<void>;
  reunion?: ReunionDetalle;
  error?: string;
  /** Hoy EN LA IGLESIA, `YYYY-MM-DD`. El servidor puede estar en otro huso. */
  hoy: string;
  /** A dónde vuelve «Cancelar». La agenda de un ministerio no vuelve a Reuniones. */
  cancelarHref: string;
  /**
   * Los textos que cambian entre un culto y un ensayo. El formulario es el
   * mismo —una reunión es una reunión—, pero «Culto del domingo» de marcador de
   * posición en la pantalla de alabanza haría dudar de si se está en el sitio
   * correcto.
   */
  etiquetas?: { titulo?: string; ejemploTitulo?: string; ejemploLugar?: string };
}) {
  const t = {
    titulo: etiquetas?.titulo ?? 'Qué reunión es',
    ejemploTitulo: etiquetas?.ejemploTitulo ?? 'Culto del domingo',
    ejemploLugar: etiquetas?.ejemploLugar ?? 'El templo',
  };
  return (
    <form action={accion} className="flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titulo">{t.titulo}</Label>
          <Input
            id="titulo"
            name="titulo"
            required
            autoFocus
            maxLength={120}
            defaultValue={reunion?.titulo}
            placeholder={t.ejemploTitulo}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha">Día</Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              required
              defaultValue={reunion?.fecha ?? hoy}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hora">
              Hora
              <span className="ml-1.5 font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Input
              id="hora"
              name="hora"
              type="time"
              // Postgres devuelve `time` como `10:00:00`; el input solo admite
              // `HH:MM` y con los segundos se queda vacío sin decir nada.
              defaultValue={reunion?.hora?.slice(0, 5) ?? ''}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lugar">
            Dónde
            <span className="ml-1.5 font-normal text-muted-foreground">
              (opcional)
            </span>
          </Label>
          <Input
            id="lugar"
            name="lugar"
            maxLength={160}
            defaultValue={reunion?.lugar ?? ''}
            placeholder={t.ejemploLugar}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notas">
            Notas
            <span className="ml-1.5 font-normal text-muted-foreground">
              (opcional)
            </span>
          </Label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            maxLength={2000}
            defaultValue={reunion?.notas ?? ''}
            placeholder="Predicó el pastor invitado. Se recogió la ofrenda para el viaje de los jóvenes."
            className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
          />
          {/* El aviso va aquí y no en una política que nadie abre: es el momento
              en que alguien está a punto de escribirlo. */}
          <p className="t-label text-muted-foreground">
            Cómo fue el encuentro, no cómo está la gente. Lo que le pasa a una
            persona concreta tiene su sitio en su seguimiento, no aquí.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit">
          {reunion ? 'Guardar los cambios' : 'Apuntar la reunión'}
        </Button>
        <Button variant="ghost" render={<Link href={cancelarHref} />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
