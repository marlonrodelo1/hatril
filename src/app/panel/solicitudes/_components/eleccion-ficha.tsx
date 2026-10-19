import { ShieldAlert } from 'lucide-react';

import type {
  FichaSugerida,
  MotivoCoincidencia,
} from '@/lib/solicitudes/consultas';

/**
 * «¿Ya está en el fichero?», dentro del formulario de aprobar.
 *
 * Radios con `required` y NINGUNO marcado de salida. Enlazar con la ficha
 * equivocada es peor que preguntar: la cuenta de una persona pasaría a entrar
 * con la ficha, los ministerios y los turnos de otra, y eso no tiene pantalla
 * para deshacerse. Marcar la primera por defecto convertiría «Aprobar» en
 * «enlazar con la más probable» sin que nadie lo haya decidido.
 *
 * Va dentro del mismo `<form>` que el `bind` del id para que funcione sin
 * JavaScript: el navegador no deja enviar sin elegir, y la elección viaja junto
 * a la solicitud.
 *
 * LA COINCIDENCIA NO ES UNA PRUEBA, Y LA PANTALLA NO PUEDE SUGERIR QUE LO ES
 * --------------------------------------------------------------------------
 * El correo es el de la cuenta, que `/crear-cuenta` da por confirmado sin
 * mandar nada, y el teléfono lo teclea quien solicita. Cualquiera que sepa el
 * correo de Ana puede abrir una cuenta con él y pedir entrar: si quien aprueba
 * lee «coincide el correo» como «es Ana», le entrega la ficha de Ana con sus
 * ministerios. Por eso los dos nombres van uno junto al otro —el que escribió
 * y el del fichero, que es lo primero que se nota si no cuadra— y el aviso
 * pide comprobarlo en persona antes de unir.
 */
export function EleccionDeFicha({
  nombre,
  aceptaAsistencia,
  fichas,
}: {
  nombre: string;
  aceptaAsistencia: boolean | null;
  fichas: FichaSugerida[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="t-label mb-1">¿Ya está en el fichero?</legend>

      <p className="mb-1 text-pretty text-[13px] leading-snug text-muted-foreground">
        {fichas.length === 1
          ? 'Hay una ficha sin cuenta con el mismo correo o teléfono que esta solicitud.'
          : `Hay ${fichas.length} fichas sin cuenta con el mismo correo o teléfono que esta solicitud.`}
      </p>

      {/* Con icono y no solo con color, como pide el sistema para todo lo que
          avisa de un riesgo. */}
      <div className="mb-1 flex items-start gap-2.5 rounded-lg bg-badge-warning-bg px-3.5 py-3 text-[13px] leading-snug text-badge-warning-fg">
        <ShieldAlert className="mt-px size-4 shrink-0" strokeWidth={1.9} />
        <span className="text-pretty">
          Que coincidan no prueba que sea la misma persona: el correo y el
          teléfono los escribe quien pide entrar, y nadie los ha comprobado.
          Antes de unirlas, comprueba en persona que es quien dice ser. Al
          unirlas entra con todo lo que tiene esa ficha, también sus
          ministerios.
          {/* Solo con un «no» explícito. Con NULL —solicitud anterior a la
              casilla— aprobar no toca su asistencia, y avisar de un borrado
              que no va a pasar enseñaría a no leer este recuadro. */}
          {aceptaAsistencia === false &&
            ' Además, no ha dado permiso para que se apunte su asistencia: al unirlas se borra lo que esa ficha tenga en asistencia y seguimiento.'}
        </span>
      </div>

      {fichas.map((f) => (
        <Opcion
          key={f.id}
          valor={f.id}
          titulo="Es la misma persona: unirla con esta ficha"
          comparacion={{ solicitud: nombre, ficha: f.nombre }}
          detalle={textoMotivos(f.motivos)}
        />
      ))}

      <Opcion
        valor="nueva"
        titulo="Es otra persona"
        detalle="Crear una ficha nueva"
      />
    </fieldset>
  );
}

function Opcion({
  valor,
  titulo,
  comparacion,
  detalle,
}: {
  valor: string;
  titulo: string;
  comparacion?: { solicitud: string; ficha: string };
  detalle: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground">
      <input
        type="radio"
        name="ficha"
        value={valor}
        required
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[14.5px] font-semibold">{titulo}</span>

        {/* En dos columnas desde `sm`, para que se lean a la vez; en el móvil,
            una encima de otra, que a media pantalla un nombre largo partido en
            tres líneas no se compara con nada. */}
        {comparacion && (
          <span className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            <Nombre etiqueta="Pide entrar como" valor={comparacion.solicitud} />
            <Nombre etiqueta="En el fichero" valor={comparacion.ficha} />
          </span>
        )}

        <span className="text-[13px] leading-snug text-muted-foreground">
          {detalle}
        </span>
      </span>
    </label>
  );
}

function Nombre({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[12px] text-muted-foreground">{etiqueta}</span>
      <span className="break-words text-[14px] font-medium">{valor}</span>
    </span>
  );
}

/**
 * Se dice POR QUÉ coincide y no solo que coincide: un teléfono compartido —el
 * fijo de una familia— no pesa lo mismo que un correo, y quien aprueba tiene
 * que poder distinguirlo antes de elegir.
 */
function textoMotivos(motivos: MotivoCoincidencia[]): string {
  const correo = motivos.includes('correo');
  const telefono = motivos.includes('telefono');
  if (correo && telefono) return 'Coinciden el correo y el teléfono';
  if (correo) return 'Coincide el correo';
  return 'Coincide el teléfono';
}
