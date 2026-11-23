import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO,
  TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS,
} from '@/lib/rgpd/consentimiento';

/**
 * Los dos permisos de la solicitud, el tercer paso.
 *
 * Componente de servidor a propósito: los textos legales viven en un módulo
 * `server-only`, y así viajan ya escritos dentro del HTML. Los pasos (que son
 * de cliente) los reciben hechos, como `children`.
 *
 * EL TEXTO LEGAL NO CAMBIA NI UNA COMA
 * ------------------------------------
 * Lo que cambia es cómo se enseña. Antes eran dos párrafos largos al final de
 * un formulario de dos pantallazos, y en el móvil asustaban (pieza «Unirse» del
 * rediseño, 17-nov). Ahora se ve un resumen de una línea y «Qué significa»
 * despliega el texto entero, que es el de siempre y sale de las mismas
 * constantes que `/acepta` y `/registro`.
 *
 * Con `<details>` y no con un botón de JavaScript: el texto completo tiene que
 * estar en la página desde el principio (es lo que se acepta), y se tiene que
 * poder leer sin JavaScript. Va fuera del `<label>`: dentro, pulsar «Qué
 * significa» también marcaría la casilla.
 *
 * Para un lector de pantalla, el nombre de cada casilla es lo que se ve (el
 * resumen, WCAG 2.5.3) y su descripción, el texto legal entero aunque esté
 * plegado: quien la oye recibe lo mismo que quien la despliega.
 */
export function Permisos() {
  return (
    <div className="flex flex-col gap-3">
      {/* El mismo consentimiento del art. 9 que en el alta de iglesia:
          vincularse a una congregación es lo que revela la confesión
          religiosa, y da igual por qué puerta se entre. */}
      <Permiso
        id="consentimiento"
        requerido
        titulo="Que Hatril guarde mis datos"
        resumen="Para que la congregación pueda organizarse."
      >
        {TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}{' '}
        <Link
          href="/privacidad"
          target="_blank"
          className="font-semibold text-accent-foreground underline underline-offset-2 hover:text-accent-foreground"
        >
          Política de privacidad
        </Link>
        .
      </Permiso>

      {/*
       * El texto de `CasillaAsistencia`, el de `/acepta`, y NO otro parecido:
       * la versión que se guarda con la solicitud es la de ese texto. Sin esta
       * casilla, aprobar dejaba a la persona con la política vigente aceptada
       * y sin ella, que es justo lo que `miembrosSinPermisoDeAsistencia` lee
       * como «dijo que no».
       *
       * No se usa el componente porque enseña el texto entero siempre. Lo que
       * no se toca es lo que lo hace la misma casilla: la constante del texto,
       * el `name`, sin `defaultChecked` (considerando 32: una casilla marcada
       * de antemano no es consentimiento) y sin `required`, porque es opcional
       * de verdad.
       */}
      <Permiso
        id="asistencia"
        opcional
        titulo="Que se apunte si vengo"
        resumen="Y lo que se habla conmigo si alguien del equipo me contacta."
      >
        {TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO}{' '}
        Puedes unirte igual sin marcarla. Entonces no sales en las listas de
        asistencia ni de seguimiento de la iglesia, y si ya tenían algo apuntado
        de ti en ellas, se borra.
      </Permiso>
    </div>
  );
}

function Permiso({
  id,
  titulo,
  resumen,
  requerido = false,
  opcional = false,
  children,
}: {
  /** También es el `name`: lo que lee `solicitar/actions.ts`. */
  id: 'consentimiento' | 'asistencia';
  titulo: string;
  resumen: string;
  requerido?: boolean;
  opcional?: boolean;
  /** El texto legal entero. */
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-xl border border-border bg-surface p-4 transition-colors duration-150 has-checked:border-primary has-checked:bg-accent motion-reduce:transition-none">
      <input
        type="checkbox"
        id={id}
        name={id}
        required={requerido}
        aria-describedby={`${id}-legal`}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
          <span className="text-body font-semibold">
            {titulo}
            {opcional && (
              <span className="font-medium text-muted-foreground"> (opcional)</span>
            )}
          </span>
          <span className="text-label text-pretty text-muted-foreground">{resumen}</span>
        </label>
        <details className="group">
          <summary className="w-fit cursor-pointer list-none rounded-sm text-label font-semibold text-accent-foreground underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/20 [&::-webkit-details-marker]:hidden">
            Qué significa
          </summary>
          <p
            id={`${id}-legal`}
            className="pt-2 text-label leading-relaxed text-pretty text-muted-foreground"
          >
            {children}
          </p>
        </details>
      </div>
    </div>
  );
}
