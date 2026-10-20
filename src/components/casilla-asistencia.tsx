import { TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO } from '@/lib/rgpd/consentimiento';

const TITULO = 'Que se apunte si vengo y lo que se habla conmigo';

/**
 * La casilla de la asistencia y el seguimiento.
 *
 * UNA SOLA, PARA TODAS LAS PUERTAS
 * --------------------------------
 * Sale en `/acepta`, en `/solicitar` y en `/registro`, y las tres guardan la
 * misma `VERSION_POLITICA_PRIVACIDAD`. Dos redacciones bajo la misma versión
 * harían mentir al registro de consentimientos, y con tres copias a mano eso
 * pasa en cuanto alguien retoca una. Lo único que cambia de una puerta a otra
 * es la consecuencia de no marcarla, que por eso viaja como parámetro.
 *
 * SIN `defaultChecked`, y no es un olvido: el considerando 32 del RGPD dice que
 * el silencio, las casillas ya marcadas y la inacción NO constituyen
 * consentimiento. Y sin `required`: es opcional de verdad.
 *
 * EL NOMBRE ACCESIBLE VA ESCRITO, NO DEDUCIDO
 * -------------------------------------------
 * Con la casilla dentro del `<label>` y nada más, el lector del navegador de
 * revisión la anunciaba como «on», que es su `value` por defecto. `aria-label`
 * con el título visible —el nombre tiene que contener lo que se ve, WCAG
 * 2.5.3— y el texto legal como descripción: quien la oye recibe lo mismo que
 * quien la lee, y en ese orden.
 */
export function CasillaAsistencia({
  consecuencia,
}: {
  consecuencia: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent">
      <input
        type="checkbox"
        name="asistencia"
        aria-label={TITULO}
        aria-describedby="asistencia-texto asistencia-consecuencia"
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14.5px] font-semibold">{TITULO}</span>
        <span
          id="asistencia-texto"
          className="text-pretty text-[13.5px] leading-snug text-muted-foreground"
        >
          {TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO}
        </span>
        <span
          id="asistencia-consecuencia"
          className="text-pretty text-[13px] leading-snug text-muted-foreground"
        >
          {consecuencia}
        </span>
      </span>
    </label>
  );
}
