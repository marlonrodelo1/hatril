'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
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
import type { UserContext } from '@/lib/auth/user-context';

/**
 * El muro de la comunidad.
 *
 * QUIÉN PUEDE ESCRIBIR: CUALQUIER MIEMBRO
 * ---------------------------------------
 * No hay permiso que consultar. `requireIglesiaAccion()` ya exige membresía
 * ACTIVA —quien solicitó el ingreso y espera aprobación no llega aquí—, y
 * dentro de una congregación todos publican igual. Poner un permiso encima
 * sería inventarse una jerarquía que la iglesia no ha pedido.
 *
 * LO QUE DE VERDAD SOSTIENE ESTO NO ESTÁ EN ESTE FICHERO
 * ------------------------------------------------------
 * Está en las policies de la `0015`. Aquí se comprueba lo justo para dar un
 * mensaje decente; si algo se colara, la base de datos lo rechaza igual porque
 * `autor_miembro_id` tiene que ser `miembro_actual(iglesia_id)`. Escribir en
 * nombre de otro no es una comprobación que se pueda olvidar en el código.
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
 * Borrar una publicación: el autor, o el pastor.
 *
 * El pastor no puede EDITAR lo de otro —cambiarle el texto y dejar su nombre
 * debajo es suplantarle— pero sí quitarlo. Es su congregación y responde ella de
 * lo que se publica dentro.
 */
export async function borrarPublicacion(publicacionId: string) {
  const ctx = await requireIglesiaAccion();

  const fila = await autorDePublicacion(ctx, publicacionId);
  if (!fila) volver('Esa publicación ya no existe.');

  const esMia = ctx.miembroId !== null && fila.autorMiembroId === ctx.miembroId;
  if (!esMia && !esPastor(ctx)) {
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

/** Borrar un comentario: su autor, o el pastor. */
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
  if (!esMio && !esPastor(ctx)) {
    volver('Solo puedes borrar tus propios comentarios.');
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(publicacionesComentarios)
      .where(eq(publicacionesComentarios.id, comentarioId)),
  );

  revalidatePath(DESTINO);
}
