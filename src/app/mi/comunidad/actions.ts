'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import {
  publicaciones,
  publicacionesComentarios,
  publicacionesMeGusta,
} from '@/lib/db/schema';
import { campo } from '@/lib/api/formulario';
import { autorDePublicacion } from '@/lib/comunidad/consultas';
import {
  cuentaDeMiembro,
  emitirNotificacion,
} from '@/lib/notificaciones/emitir';
import {
  borrarImagenes,
  subirImagenesPublicacion,
  MAX_IMAGENES,
} from '@/lib/comunidad/imagenes';
import {
  MENSAJE_COMENTARIOS_CERRADOS,
  MENSAJE_COMUNIDAD_APAGADA,
  MENSAJE_FOTOS_APAGADAS,
  porQueNoPuedesPublicar,
  puedePublicarEnMuro,
} from '@/lib/comunidad/reglas';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * El muro de la comunidad.
 *
 * QUIÉN PUEDE ESCRIBIR: LO QUE HAYA DECIDIDO LA IGLESIA
 * -----------------------------------------------------
 * Aquí ponía que escribía cualquier miembro y que no había permiso que
 * consultar. Dejó de ser verdad con las migraciones `0026` y `0027`: ahora la
 * congregación elige si el muro está encendido, quién publica (`todos`,
 * `equipo` o solo el `pastor`), si se comenta y si se suben fotos. Se toca en
 * `/panel/comunidad` y viaja en `ctx.iglesia.comunidad`.
 *
 * Lo que NO cambió es que no hay permiso del jsonb para publicar: `moderar_
 * comunidad` existe, pero es para borrar lo de otro, no para escribir.
 *
 * LO QUE DE VERDAD SOSTIENE ESTO NO ESTÁ EN ESTE FICHERO
 * ------------------------------------------------------
 * Está en las policies de la `0015` y la `0027`. Aquí se comprueba lo justo
 * para dar un mensaje decente en castellano; si algo se colara, la base de datos
 * lo rechaza igual porque `autor_miembro_id` tiene que ser
 * `miembro_actual(iglesia_id)` y el INSERT pasa por
 * `comunidad_admite_publicacion()`. Escribir en nombre de otro no es una
 * comprobación que se pueda olvidar en el código.
 */

const DESTINO = '/mi/comunidad';

function volver(mensaje: string): never {
  redirect(`${DESTINO}?error=` + encodeURIComponent(mensaje));
}

/**
 * Publicar exige tener FICHA, no solo cuenta.
 *
 * Una publicación la firma una persona de la congregación. Quien tiene acceso
 * pero todavía no tiene ficha —pasa mientras el alta está a medias— no puede
 * publicar, y la policy lo rechazaría de todas formas: `miembro_actual()`
 * devolvería NULL y la comparación fallaría. Aquí se traduce a algo que se
 * entiende.
 */
function requiereFicha(ctx: UserContext): string {
  if (!ctx.miembroId) {
    volver(
      'Todavía no tienes ficha en la iglesia. Pídele a quien te dio acceso que la cree.',
    );
  }
  return ctx.miembroId;
}

const EsquemaPublicacion = z.object({
  texto: z.string().trim().max(3000).optional().or(z.literal('')),
});

export async function publicar(formData: FormData) {
  const ctx = await requireIglesiaAccion();
  const miembroId = requiereFicha(ctx);

  /*
   * Las dos comprobaciones de configuración van SEPARADAS y por este orden para
   * poder decir cuál falló. `puedePublicarEnMuro` también mira si está apagada,
   * pero su mensaje habla de quién publica, y a quien se encuentra el muro
   * cerrado eso no le dice nada.
   */
  if (!ctx.iglesia.comunidad.activa) volver(MENSAJE_COMUNIDAD_APAGADA);
  if (!puedePublicarEnMuro(ctx)) volver(porQueNoPuedesPublicar(ctx));

  const parsed = EsquemaPublicacion.safeParse({
    texto: campo(formData, 'texto'),
  });
  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  const ficheros = formData
    .getAll('imagenes')
    .filter((f): f is File => f instanceof File && f.size > 0);

  const texto = parsed.data.texto ?? '';

  // El mismo check que la base de datos (`ck_publicaciones_no_vacia`), aquí
  // solo para poder decirlo en castellano en vez de soltar un error de Postgres.
  if (!texto && ficheros.length === 0) {
    volver('Escribe algo o añade una foto.');
  }

  if (ficheros.length > MAX_IMAGENES) {
    volver(`Puedes subir hasta ${MAX_IMAGENES} fotos en una publicación.`);
  }

  // Con las fotos apagadas la policy rechaza el INSERT entero, así que sin este
  // aviso el texto también se perdería sin que nadie entendiera por qué.
  if (ficheros.length > 0 && !ctx.iglesia.comunidad.fotos) {
    volver(MENSAJE_FOTOS_APAGADAS);
  }

  /*
   * SE CREA LA FILA PRIMERO, Y LUEGO SE SUBEN LAS FOTOS.
   *
   * Al revés haría falta inventar un identificador antes de tener publicación, y
   * las fotos acabarían en una carpeta que quizá nunca llegue a existir si la
   * inserción falla. Así, si la subida falla, se borra la fila y no queda nada
   * a medias: el orden convierte «puede quedar basura» en «no queda basura».
   */
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .insert(publicaciones)
      .values({
        iglesiaId: ctx.iglesia.id,
        autorMiembroId: miembroId,
        texto: texto || null,
        // Sin fotos todavía; el check de arriba ya garantiza que si no hay texto
        // es porque vienen ficheros, y estos se añaden dos líneas más abajo.
        imagenes: [],
      })
      .returning({ id: publicaciones.id }),
  );

  if (!fila) volver('No se pudo publicar. Inténtalo otra vez.');

  if (ficheros.length > 0) {
    const subida = await subirImagenesPublicacion(
      ctx.iglesia.id,
      fila.id,
      ficheros,
      Date.now().toString(36),
    );

    if (!subida.ok) {
      await withUser(ctx.user.id, (tx) =>
        tx.delete(publicaciones).where(eq(publicaciones.id, fila.id)),
      );
      volver(subida.error);
    }

    await withUser(ctx.user.id, (tx) =>
      tx
        .update(publicaciones)
        .set({ imagenes: subida.rutas })
        .where(eq(publicaciones.id, fila.id)),
    );
  }

  revalidatePath(DESTINO);
  redirect(DESTINO);
}

/**
 * Me gusta: se pone y se quita con la misma acción.
 *
 * `on conflict do nothing` en vez de «mirar si ya está y luego insertar». Entre
 * la comprobación y la inserción cabe otra petición de la misma persona —dos
 * pulsaciones seguidas en un móvil con mala cobertura— y ahí saltaría la clave
 * primaria con un error feo. Que lo resuelva la base de datos, que para eso
 * tiene la restricción.
 */
export async function alternarMeGusta(publicacionId: string) {
  const ctx = await requireIglesiaAccion();
  const miembroId = requiereFicha(ctx);

  /*
   * La `0027` es más suelta que esto a propósito: cierra el INSERT con la
   * comunidad apagada, pero deja el DELETE abierto para que nadie quede
   * atrapado en un me gusta que ya no puede retirar. Aquí se cierran los dos,
   * porque la comprobación tendría que ir DENTRO de la transacción —después de
   * saber si toca poner o quitar— y un `redirect()` ahí dentro aborta la
   * transacción a media faena. Con el muro sin pintar tampoco hay corazón que
   * pulsar, así que en la práctica no atrapa a nadie.
   */
  if (!ctx.iglesia.comunidad.activa) volver(MENSAJE_COMUNIDAD_APAGADA);

  // `true` solo cuando se PONE. Al quitarlo no se avisa de nada: nadie quiere
  // enterarse de que a alguien ha dejado de gustarle lo suyo.
  let puesto = false;

  await withUser(ctx.user.id, async (tx) => {
    const borradas = await tx
      .delete(publicacionesMeGusta)
      .where(
        and(
          eq(publicacionesMeGusta.publicacionId, publicacionId),
          eq(publicacionesMeGusta.miembroId, miembroId),
        ),
      )
      .returning({ id: publicacionesMeGusta.publicacionId });

    if (borradas.length === 0) {
      await tx
        .insert(publicacionesMeGusta)
        .values({
          iglesiaId: ctx.iglesia.id,
          publicacionId,
          miembroId,
        })
        .onConflictDoNothing();
      puesto = true;
    }
  });

  if (puesto) {
    await avisarAlAutor(ctx, publicacionId, 'me_gusta_en_publicacion');
  }

  revalidatePath(DESTINO);
}

/**
 * Avisa a quien escribió la publicación.
 *
 * `emitirNotificacion` se salta el aviso cuando el destinatario es quien lo
 * provoca, así que comentarse a uno mismo o darse me gusta no genera nada. Y
 * `cuentaDeMiembro` devuelve `null` para quien tiene ficha y no usa la
 * aplicación, que es media congregación: tampoco es un error.
 */
/**
 * Con qué nombre firma el aviso quien lo provoca.
 *
 * Del `user_metadata` y no de su ficha, que obligaría a otra consulta para poner
 * una palabra. Si no hay nombre —una cuenta creada sin él— sale «Alguien», que
 * es cierto y no deja el aviso a medias.
 */
function nombreDe(ctx: UserContext): string {
  return (
    (ctx.user.user_metadata?.nombre as string | undefined) ??
    ctx.user.email?.split('@')[0] ??
    'Alguien'
  );
}

async function avisarAlAutor(
  ctx: UserContext,
  publicacionId: string,
  tipo: 'comentario_en_publicacion' | 'me_gusta_en_publicacion',
  extracto?: string,
) {
  const publicacion = await autorDePublicacion(ctx, publicacionId);
  if (!publicacion) return;

  const destinatario = await cuentaDeMiembro(
    ctx.iglesia.id,
    publicacion.autorMiembroId,
  );

  await emitirNotificacion({
    iglesiaId: ctx.iglesia.id,
    destinatarioAuthUserId: destinatario,
    provocadoPor: ctx.user.id,
    tipo,
    datos: {
      quien: nombreDe(ctx),
      ...(extracto ? { extracto } : {}),
    },
    enlace: DESTINO,
  });
}

const EsquemaComentario = z.object({
  texto: z.string().trim().min(1, 'Escribe algo antes de enviar.').max(1000),
});

export async function comentar(publicacionId: string, formData: FormData) {
  const ctx = await requireIglesiaAccion();
  const miembroId = requiereFicha(ctx);

  // Comentar no depende de `comunidad_quien_publica`: quien no publica sí
  // comenta, y es justo lo que se le promete en la línea de la pantalla.
  if (!ctx.iglesia.comunidad.activa) volver(MENSAJE_COMUNIDAD_APAGADA);
  if (!ctx.iglesia.comunidad.comentarios) volver(MENSAJE_COMENTARIOS_CERRADOS);

  const parsed = EsquemaComentario.safeParse({
    texto: campo(formData, 'texto'),
  });
  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  await withUser(ctx.user.id, (tx) =>
    tx.insert(publicacionesComentarios).values({
      iglesiaId: ctx.iglesia.id,
      publicacionId,
      autorMiembroId: miembroId,
      texto: parsed.data.texto,
    }),
  );

  // El extracto va en el aviso para que se entienda sin abrirlo. Cortado a 120:
  // es un aviso, no el comentario.
  await avisarAlAutor(
    ctx,
    publicacionId,
    'comentario_en_publicacion',
    parsed.data.texto.slice(0, 120),
  );

  revalidatePath(DESTINO);
}

/**
 * Borrar una publicación: el autor, o quien modera.
 *
 * Quien modera no puede EDITAR lo de otro —cambiarle el texto y dejar su nombre
 * debajo es suplantarle— pero sí quitarlo. Es su congregación y responde ella de
 * lo que se publica dentro.
 *
 * Antes era «el autor o el pastor», con la comparación de rol escrita a mano.
 * Desde la `0027` también modera quien tenga el permiso `moderar_comunidad`, y
 * la policy `publicaciones_delete_autor_o_moderador` ya lo acepta: sin este
 * cambio, esa persona vería el botón de borrar —la pantalla sí mira el permiso—
 * y esta action se lo negaría.
 *
 * Se borra a la vez que la comunidad esté apagada o encendida: apagar es dejar
 * de escribir, no impedir que alguien retire lo suyo.
 */
export async function borrarPublicacion(publicacionId: string) {
  const ctx = await requireIglesiaAccion();

  const fila = await autorDePublicacion(ctx, publicacionId);
  if (!fila) volver('Esa publicación ya no existe.');

  const esMia = ctx.miembroId !== null && fila.autorMiembroId === ctx.miembroId;
  if (!esMia && !puedeModerarComunidad(ctx)) {
    volver('Solo puedes borrar tus propias publicaciones.');
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(publicaciones)
      .where(
        and(
          eq(publicaciones.id, publicacionId),
          eq(publicaciones.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  // Después de borrar la fila, nunca antes: si el borrado de la fila falla, las
  // fotos siguen donde estaban y la publicación sigue entera.
  await borrarImagenes(fila.imagenes);

  revalidatePath(DESTINO);
}

/** Borrar un comentario: su autor, o quien modera. Igual que el de arriba. */
export async function borrarComentario(comentarioId: string) {
  const ctx = await requireIglesiaAccion();

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ autorMiembroId: publicacionesComentarios.autorMiembroId })
      .from(publicacionesComentarios)
      .where(
        and(
          eq(publicacionesComentarios.id, comentarioId),
          eq(publicacionesComentarios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  if (!fila) volver('Ese comentario ya no existe.');

  const esMio = ctx.miembroId !== null && fila.autorMiembroId === ctx.miembroId;
  if (!esMio && !puedeModerarComunidad(ctx)) {
    volver('Solo puedes borrar tus propios comentarios.');
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(publicacionesComentarios)
      .where(eq(publicacionesComentarios.id, comentarioId)),
  );

  revalidatePath(DESTINO);
}
