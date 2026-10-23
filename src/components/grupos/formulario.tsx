import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { horaCorta } from '@/lib/grupos/semanas';
import { DIAS_DEL_FORMULARIO } from '@/app/panel/ministerios/[id]/grupos/constantes';

/**
 * Los campos de un grupo, para crearlo y para editarlo: nombre, zona, día y
 * hora. Sin dirección, a propósito (`schema/grupos.ts`): la ayuda de la zona lo
 * dice, porque es justo ahí donde alguien la escribiría.
 *
 * `Campo` y `Bloque` copiados de miembros hasta la fase 2 de la guía visual.
 */

/** Un `<select>` nativo con el aspecto de `Input`, a 16 px en el móvil (M1). */
export const SELECT =
  'h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 text-[16px] md:text-body outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16';

export function Bloque({
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
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">{titulo}</h2>
        {nota && <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

export function Campo({
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={nombre}>
        {etiqueta}
        {!requerido && (
          <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
        )}
      </Label>
      {children}
      {ayuda && <p className="t-label text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

export function CamposDelGrupo({
  valores,
}: {
  valores?: { nombre: string; zona: string | null; diaSemana: number; hora: string | null };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo
        etiqueta="Nombre"
        nombre="nombre"
        requerido
        ayuda="Es como sale en la lista. Mejor el del barrio o uno propio que el apellido de la familia que acoge."
      >
        <Input
          id="nombre"
          name="nombre"
          required
          maxLength={80}
          defaultValue={valores?.nombre ?? ''}
          placeholder="p. ej. Los Pinos"
          autoComplete="off"
        />
      </Campo>
      <Campo
        etiqueta="Barrio o zona"
        nombre="zona"
        ayuda="Solo el barrio o el sector, nunca la calle: la dirección se la manda el líder a quien vaya a ir."
      >
        <Input
          id="zona"
          name="zona"
          maxLength={60}
          defaultValue={valores?.zona ?? ''}
          placeholder="p. ej. Kennedy"
          autoComplete="off"
        />
      </Campo>
      <Campo etiqueta="Día" nombre="dia" requerido>
        <select
          id="dia"
          name="dia"
          required
          defaultValue={valores ? String(valores.diaSemana) : ''}
          className={SELECT}
        >
          <option value="" disabled>
            Elige el día
          </option>
          {DIAS_DEL_FORMULARIO.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Hora" nombre="hora">
        <Input
          id="hora"
          name="hora"
          type="time"
          defaultValue={horaCorta(valores?.hora ?? null) ?? ''}
        />
      </Campo>
    </div>
  );
}
