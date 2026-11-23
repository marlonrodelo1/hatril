import 'server-only';

import * as acepta from '@/app/acepta/actions';
import * as agenda from '@/app/mi/agenda/actions';
import * as avisos from '@/app/mi/avisos/actions';
import * as comunidad from '@/app/mi/comunidad/actions';
import * as cuenta from '@/app/mi/cuenta/actions';
import * as cuentaBorrar from '@/app/mi/cuenta/borrar/actions';
import * as cuentaDonativos from '@/app/mi/cuenta/donativos/actions';
import * as equipoAgenda from '@/app/mi/equipo/[id]/agenda/actions';
import * as equipoGrupos from '@/app/mi/equipo/[id]/grupos/actions';
import * as equipoGrupo from '@/app/mi/equipo/[id]/grupos/[grupoId]/actions';
import * as equipoNinos from '@/app/mi/equipo/[id]/ninos/actions';
import * as equipoRepertorio from '@/app/mi/equipo/[id]/repertorio/actions';
import * as equipoSeguimiento from '@/app/mi/equipo/[id]/seguimiento/actions';
import * as equipoTurnos from '@/app/mi/equipo/[id]/turnos/actions';
import * as hijos from '@/app/mi/hijos/actions';

/**
 * Las server actions que la app empaquetada puede llamar, y SOLO esas.
 *
 * POR QUÉ LA APP LLAMA A LAS ACTIONS DE LA WEB
 * --------------------------------------------
 * Los componentes del área del miembro (`src/app/mi/**`) usan sus actions
 * como `action` de formulario: publicar, dar me gusta, comentar, responder un
 * turno… La app reaprovecha esos componentes tal cual, y para que no haya
 * dos lógicas, sus actions son LAS MISMAS funciones: `POST /api/v1/app/accion`
 * las ejecuta aquí, con la sesión del token (`usuarioActual`). Es el truco de
 * `enLaApp()` (`ministerios/en-la-app/acciones.ts`), que ya ejecuta las del
 * panel desde la app de la web.
 *
 * NO ABRE NADA NUEVO
 * ------------------
 * Una server action ya es un endpoint público: Next la expone a cualquier
 * navegador con sesión, con los argumentos que le mande. Por eso cada una
 * lleva dentro su guarda (`requireIglesiaAccion`, `exigirModulo`…) y valida
 * sus argumentos. Llamarla desde aquí no se salta nada de eso. Lo único que
 * no pasa es la comprobación de origen de Next, que protege de que otra web
 * use la COOKIE de alguien; con un token Bearer, que el navegador nunca pone
 * solo, no hay nada de qué protegerse.
 *
 * LA LISTA ES CERRADA
 * -------------------
 * Solo los módulos de aquí, y de cada uno solo sus funciones exportadas. Una
 * action nueva en uno de estos ficheros queda disponible para la app, que es
 * lo que se quiere (la web y la app con las mismas puertas). Un fichero de
 * actions nuevo no, hasta que se añada aquí y a `test:puertas:app`. Las del
 * panel (`src/app/panel/**`) no están ni deben estar: el panel no va en la app.
 *
 * La clave es la ruta del fichero dentro de `src/app`, sin `/actions.ts`: la
 * misma que calcula la app al sustituir el módulo (`movil/vite.config.ts`).
 */
type Accion = (...args: never[]) => Promise<unknown>;

export const MODULOS_DE_ACCIONES: Record<string, Record<string, unknown>> = {
  acepta,
  'mi/agenda': agenda,
  'mi/avisos': avisos,
  'mi/comunidad': comunidad,
  'mi/cuenta': cuenta,
  'mi/cuenta/borrar': cuentaBorrar,
  'mi/cuenta/donativos': cuentaDonativos,
  'mi/equipo/[id]/agenda': equipoAgenda,
  // Las células: la guía de la red, y el reporte y los temas de cada célula.
  'mi/equipo/[id]/grupos': equipoGrupos,
  'mi/equipo/[id]/grupos/[grupoId]': equipoGrupo,
  'mi/equipo/[id]/ninos': equipoNinos,
  'mi/equipo/[id]/repertorio': equipoRepertorio,
  'mi/equipo/[id]/seguimiento': equipoSeguimiento,
  'mi/equipo/[id]/turnos': equipoTurnos,
  // Las familias del ministerio de Niños: solo en la app (`plan-ninos.md` §6).
  'mi/hijos': hijos,
};

/** La action de `modulo#nombre`, o `null` si no está en la lista. */
export function accionDeLaApp(id: string): Accion | null {
  const [modulo, nombre, ...resto] = id.split('#');
  if (!modulo || !nombre || resto.length) return null;
  if (!Object.hasOwn(MODULOS_DE_ACCIONES, modulo)) return null;
  const exportados = MODULOS_DE_ACCIONES[modulo]!;
  if (!Object.hasOwn(exportados, nombre)) return null;
  const fn = exportados[nombre];
  return typeof fn === 'function' ? (fn as Accion) : null;
}
