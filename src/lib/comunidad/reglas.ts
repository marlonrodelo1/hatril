import type { UserContext } from '@/lib/auth/user-context';

/**
 * Qué deja hacer en el muro la configuración de esta iglesia.
 *
 * QUIÉN MANDA DE VERDAD: LA BASE DE DATOS
 * ---------------------------------------
 * Las policies de la `0027` son las que rechazan. Este fichero existe para que
 * la interfaz no ofrezca lo que la base va a rechazar —un botón que siempre da
 * error es peor que no tener botón— y para que la server action pueda decirlo en
 * castellano en vez de dejar salir un error de Postgres en inglés.
 *
 * Si las dos mitades llegaran a discrepar, gana la base de datos: aquí sobraría
 * un formulario pintado de más, no un permiso concedido de más.
 *
 * POR QUÉ NO VIVE EN `mi/comunidad/actions.ts`
 * --------------------------------------------
 * Porque un fichero `'use server'` solo puede exportar funciones async. Sacar de
 * ahí una constante o un predicado rompe el build entero, y el typecheck no lo
 * caza porque es una regla de Next y no de TypeScript: aparece al abrir la
 * pantalla. Está contado en `ESTADO.md`.
 *
 * Y lo necesitan las dos mitades: la página, para decidir qué pinta, y las
 * actions, para rechazar pronto. Dos copias de esta regla acabarían enseñando un
 * publicador a quien no puede publicar.
 */

export const MENSAJE_COMUNIDAD_APAGADA =
  'La comunidad está apagada ahora mismo. Lo que se publicó sigue guardado, pero no se puede escribir hasta que la enciendan.';

export const MENSAJE_COMENTARIOS_CERRADOS =
  'Los comentarios están cerrados en esta congregación.';

export const MENSAJE_FOTOS_APAGADAS =
  'Esta congregación no admite fotos en el muro. Puedes publicar el texto sin ellas.';

/**
 * ¿Puede ESTA persona publicar?
 *
 * Las mismas tres condiciones que `comunidad_admite_publicacion()` en la `0027`,
 * más la ficha, que allí comprueba la propia policy con `miembro_actual()`. La
 * ficha se mira aquí también porque sin ella no hay nada que firme la
 * publicación, y quien la ve pintada y no la tiene se lleva el error al enviar.
 */
export function puedePublicarEnMuro(ctx: UserContext): boolean {
  const { activa, quienPublica } = ctx.iglesia.comunidad;

  if (!activa) return false;
  if (!ctx.miembroId) return false;

  switch (quienPublica) {
    case 'todos':
      return true;
    case 'equipo':
      return ctx.rol !== 'miembro';
    case 'pastor':
      return ctx.rol === 'pastor';
  }
}

/**
 * Por qué no, dicho sin regañar.
 *
 * Se cuenta quién publica en esta congregación y qué sí puede hacer quien lee,
 * porque «no puedes publicar» a secas suena a castigo cuando en realidad es una
 * decisión de la iglesia sobre su propio muro.
 *
 * Sirve para la línea de la pantalla y para el error de la action: un solo texto
 * y no dos que se separen.
 */
export function porQueNoPuedesPublicar(ctx: UserContext): string {
  const { activa, quienPublica, comentarios } = ctx.iglesia.comunidad;

  if (!activa) return MENSAJE_COMUNIDAD_APAGADA;

  if (!ctx.miembroId) {
    return 'Todavía no tienes ficha en la iglesia, así que no puedes publicar. Pídesela a quien te dio acceso.';
  }

  // `todos` no llega aquí con ficha: con ficha ya habría devuelto `true` arriba,
  // y sin ella la ha atendido la rama anterior.
  const quien =
    quienPublica === 'pastor'
      ? 'En esta congregación publica el pastor.'
      : 'En esta congregación publican el pastor, los líderes, la tesorería y la secretaría.';

  const tuyo = comentarios
    ? 'Tú puedes comentar y dar me gusta a lo que se publique.'
    : 'Tú puedes dar me gusta a lo que se publique.';

  return `${quien} ${tuyo}`;
}
