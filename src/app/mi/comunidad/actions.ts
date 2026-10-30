'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import {
  bloqueosComunidad,
  denunciasComunidad,
  publicaciones,
  publicacionesComentarios,
  publicacionesComentariosMeGusta,
  publicacionesMeGusta,
} from '@/lib/db/schema';
import { motivoDenunciaEnum } from '@/lib/db/schema/enums';
import { campo } from '@/lib/api/formulario';
import { esGuardHatril } from '@/lib/db/error';
import {
  autorDeComentario,
  autorDePublicacion,
} from '@/lib/comunidad/consultas';
import {
  cuentaDeMiembro,
  cuentasQueModeran,
  emitirNotificacion,
  emitirNotificaciones,
  tieneBloqueado,
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

  // Si el autor tiene bloqueado a quien comenta o da me gusta, no se le avisa:
  // el aviso sería ver lo que bloquear prometió dejar de enseñarle.
  if (
    ctx.miembroId &&
    (await tieneBloqueado(publicacion.autorMiembroId, ctx.miembroId))
  ) {
    return;
  }

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
  /**
   * A qué comentario responde, si responde a alguno. Viaja en un campo oculto
   * del formulario, así que llega del navegador: llega de quien quiera escribir
   * lo que quiera.
   *
   * Que el UUID sea de otra publicación —o de otra iglesia— no lo puede saber
   * Zod, y por eso no se comprueba aquí: lo rechaza HT120 en la base, que es
   * quien puede mirar la fila del padre. Repetir la comprobación en este fichero
   * serían una consulta más y una segunda verdad que puede quedarse atrás.
   */
  respuestaA: z.uuid().optional(),
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
    respuestaA: campo(formData, 'respuestaA'),
  });
  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(publicacionesComentarios).values({
        iglesiaId: ctx.iglesia.id,
        publicacionId,
        autorMiembroId: miembroId,
        texto: parsed.data.texto,
        respuestaAId: parsed.data.respuestaA ?? null,
      }),
    );
  } catch (err) {
    // HT120: la respuesta apunta a un comentario de otra publicación, a uno que
    // ya no existe, o a otra respuesta. Lo normal es lo segundo —alguien borró
    // el comentario mientras se escribía la respuesta— y merece una frase, no
    // una pantalla de error.
    if (esGuardHatril(err, 'HT120')) {
      volver(
        'Ese comentario ya no está. Recarga la pantalla y vuelve a intentarlo.',
      );
    }
    throw err;
  }

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
 * Me gusta en un COMENTARIO.
 *
 * Gemela de `alternarMeGusta`, y con las mismas dos decisiones: se pone y se
 * quita con la misma acción, y el `on conflict do nothing` deja que la clave
 * primaria resuelva el doble toque en vez de mirar antes si ya estaba.
 *
 * SIN AVISO, Y NO ES UN OLVIDO
 * ----------------------------
 * Los seis tipos de aviso viven en un enum de Postgres y sus textos en
 * `notificaciones/textos.ts`, así que «le ha gustado tu comentario» es una
 * migración más un texto más. Y aunque fuera gratis: la campana ya recibe un
 * aviso por cada me gusta de publicación, y sumarle uno por cada me gusta de
 * comentario en un muro activo un domingo la convierte en ruido que nadie mira.
 * Queda apuntado en ESTADO.md en vez de colarse aquí a medias.
 */
export async function alternarMeGustaComentario(comentarioId: string) {
  const ctx = await requireIglesiaAccion();
  const miembroId = requiereFicha(ctx);

  if (!ctx.iglesia.comunidad.activa) volver(MENSAJE_COMUNIDAD_APAGADA);

  await withUser(ctx.user.id, async (tx) => {
    const borradas = await tx
      .delete(publicacionesComentariosMeGusta)
      .where(
        and(
          eq(publicacionesComentariosMeGusta.comentarioId, comentarioId),
          eq(publicacionesComentariosMeGusta.miembroId, miembroId),
        ),
      )
      .returning({ id: publicacionesComentariosMeGusta.comentarioId });

    if (borradas.length === 0) {
      await tx
        .insert(publicacionesComentariosMeGusta)
        .values({
          iglesiaId: ctx.iglesia.id,
          comentarioId,
          miembroId,
        })
        .onConflictDoNothing();
    }
  });

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

  if (!esMia) {
    await avisarDeLoRetirado(ctx, fila.autorMiembroId, 'publicacion', fila.texto);
  }

  revalidatePath(DESTINO);
}

/** Borrar un comentario: su autor, o quien modera. Igual que el de arriba. */
export async function borrarComentario(comentarioId: string) {
  const ctx = await requireIglesiaAccion();

  const fila = await autorDeComentario(ctx, comentarioId);
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

  if (!esMio) {
    await avisarDeLoRetirado(ctx, fila.autorMiembroId, 'comentario', fila.texto);
  }

  revalidatePath(DESTINO);
}

/**
 * A quien le han quitado algo, se le dice. Sin decir quién: ver el comentario
 * de `contenido_retirado` en el enum de avisos.
 *
 * Quitarle algo a alguien sin avisar le deja buscando su publicación y
 * pensando que ha fallado la aplicación; avisándole, al menos sabe que fue una
 * decisión y puede preguntar.
 */
async function avisarDeLoRetirado(
  ctx: UserContext,
  autorMiembroId: string,
  que: 'publicacion' | 'comentario',
  texto: string | null,
) {
  await emitirNotificacion({
    iglesiaId: ctx.iglesia.id,
    destinatarioAuthUserId: await cuentaDeMiembro(ctx.iglesia.id, autorMiembroId),
    provocadoPor: ctx.user.id,
    tipo: 'contenido_retirado',
    datos: { que, ...(texto ? { extracto: texto.slice(0, 120) } : {}) },
    enlace: DESTINO,
  });
}

// ===========================================================================
// DENUNCIAR Y BLOQUEAR
//
// Las tres van con `sinMuro`. El muro de suscripción corta lo que se escribe
// cuando la iglesia ya no puede escribir, pero durante la gracia el muro se
// sigue leyendo, y lo que se lee se tiene que poder denunciar y bloquear: son
// las dos herramientas con las que una persona se protege, y dejarla sin ellas
// porque su iglesia devolvió un recibo no tiene defensa.
// ===========================================================================

const EsquemaDenuncia = z.object({
  tipo: z.enum(['publicacion', 'comentario'], {
    error: 'Eso no se puede denunciar.',
  }),
  id: z.uuid({ error: 'Eso no se puede denunciar.' }),
  motivo: z.enum(motivoDenunciaEnum.enumValues, {
    error: 'Elige qué pasa con lo que denuncias.',
  }),
  detalle: z
    .string()
    .trim()
    .max(1000, 'Cuéntalo en menos de 1000 letras.')
    .optional(),
});

export async function denunciar(formData: FormData) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  const miembroId = requiereFicha(ctx);

  const parsed = EsquemaDenuncia.safeParse({
    tipo: campo(formData, 'tipo'),
    id: campo(formData, 'id'),
    motivo: campo(formData, 'motivo'),
    detalle: campo(formData, 'detalle'),
  });
  if (!parsed.success) volver(parsed.error.issues[0]!.message);
  const { tipo, id, motivo } = parsed.data;
  const detalle = parsed.data.detalle || null;

  const objeto =
    tipo === 'publicacion'
      ? await autorDePublicacion(ctx, id)
      : await autorDeComentario(ctx, id);
  if (!objeto) volver('Eso ya no está en el muro.');

  if (objeto.autorMiembroId === miembroId) {
    volver('Esto es tuyo: si no quieres que esté, bórralo.');
  }

  let nueva = false;
  try {
    const filas = await withUser(ctx.user.id, (tx) =>
      tx
        .insert(denunciasComunidad)
        .values({
          iglesiaId: ctx.iglesia.id,
          denuncianteMiembroId: miembroId,
          publicacionId: tipo === 'publicacion' ? id : null,
          comentarioId: tipo === 'comentario' ? id : null,
          motivo,
          detalle,
        })
        // La misma persona dos veces sobre lo mismo: los índices únicos de la
        // `0053` la paran, y a quien denuncia se le cuenta igual que ha llegado.
        .onConflictDoNothing()
        .returning({ id: denunciasComunidad.id }),
    );
    nueva = filas.length > 0;
  } catch (err) {
    if (esGuardHatril(err, 'HT136')) volver('Eso ya no está en el muro.');
    throw err;
  }

  if (nueva) {
    const cuentas = await cuentasQueModeran(ctx.iglesia.id);
    await emitirNotificaciones(
      cuentas.map((cuenta) => ({
        iglesiaId: ctx.iglesia.id,
        destinatarioAuthUserId: cuenta,
        provocadoPor: ctx.user.id,
        tipo: 'denuncia_en_comunidad' as const,
        datos: {
          que: tipo,
          ...(objeto.texto ? { extracto: objeto.texto.slice(0, 120) } : {}),
        },
        enlace: COLA,
      })),
    );
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}/denuncia-enviada?autor=${objeto.autorMiembroId}`);
}

export async function bloquear(miembroBloqueado: string) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  const miembroId = requiereFicha(ctx);

  if (!z.uuid().safeParse(miembroBloqueado).success) {
    volver('No encontramos a esa persona.');
  }
  if (miembroBloqueado === miembroId) volver('No puedes bloquearte a ti.');

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .insert(bloqueosComunidad)
        .values({
          iglesiaId: ctx.iglesia.id,
          bloqueadorMiembroId: miembroId,
          bloqueadoMiembroId: miembroBloqueado,
        })
        .onConflictDoNothing(),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT137')) volver('No encontramos a esa persona.');
    throw err;
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?bloqueado=1`);
}

export async function desbloquear(miembroBloqueado: string) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  const miembroId = requiereFicha(ctx);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(bloqueosComunidad)
      .where(
        and(
          eq(bloqueosComunidad.iglesiaId, ctx.iglesia.id),
          eq(bloqueosComunidad.bloqueadorMiembroId, miembroId),
          eq(bloqueosComunidad.bloqueadoMiembroId, miembroBloqueado),
        ),
      ),
  );

  revalidatePath(DESTINO);
  revalidatePath('/mi/cuenta/bloqueados');
  redirect('/mi/cuenta/bloqueados?desbloqueado=1');
}

// ===========================================================================
// LA COLA DE QUIEN MODERA
// ===========================================================================

const COLA = `${DESTINO}/denuncias`;

function exigirModerar(ctx: UserContext) {
  if (!puedeModerarComunidad(ctx)) {
    redirect(
      `${COLA}?error=` +
        encodeURIComponent('Solo quien modera la comunidad puede hacer esto.'),
    );
  }
}

/**
 * Quitar del muro lo denunciado. Es el mismo borrado que el «…» del muro —con
 * su aviso al autor—, pero vuelve a la cola y no al muro.
 *
 * Las denuncias se van con lo denunciado por la clave ajena: no hay nada más
 * que cerrar.
 */
export async function quitarDenunciado(
  tipo: 'publicacion' | 'comentario',
  id: string,
) {
  const ctx = await requireIglesiaAccion();
  exigirModerar(ctx);

  if (tipo === 'publicacion') {
    const fila = await autorDePublicacion(ctx, id);
    if (fila) {
      await withUser(ctx.user.id, (tx) =>
        tx
          .delete(publicaciones)
          .where(
            and(
              eq(publicaciones.id, id),
              eq(publicaciones.iglesiaId, ctx.iglesia.id),
            ),
          ),
      );
      await borrarImagenes(fila.imagenes);
      if (fila.autorMiembroId !== ctx.miembroId) {
        await avisarDeLoRetirado(ctx, fila.autorMiembroId, 'publicacion', fila.texto);
      }
    }
  } else {
    const fila = await autorDeComentario(ctx, id);
    if (fila) {
      await withUser(ctx.user.id, (tx) =>
        tx
          .delete(publicacionesComentarios)
          .where(
            and(
              eq(publicacionesComentarios.id, id),
              eq(publicacionesComentarios.iglesiaId, ctx.iglesia.id),
            ),
          ),
      );
      if (fila.autorMiembroId !== ctx.miembroId) {
        await avisarDeLoRetirado(ctx, fila.autorMiembroId, 'comentario', fila.texto);
      }
    }
  }

  revalidatePath(DESTINO);
  revalidatePath(COLA);
  redirect(`${COLA}?hecho=quitado`);
}

/**
 * Dejarlo estar. Las denuncias se cierran como descartadas y lo denunciado
 * sigue en el muro, salvo para quien lo denunció, que lo sigue sin ver.
 */
export async function dejarDenunciado(
  tipo: 'publicacion' | 'comentario',
  id: string,
) {
  const ctx = await requireIglesiaAccion();
  exigirModerar(ctx);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(denunciasComunidad)
      .set({
        estado: 'descartada',
        revisadaAt: new Date(),
        revisadaPorAuthUserId: ctx.user.id,
      })
      .where(
        and(
          eq(denunciasComunidad.iglesiaId, ctx.iglesia.id),
          eq(denunciasComunidad.estado, 'pendiente'),
          tipo === 'publicacion'
            ? eq(denunciasComunidad.publicacionId, id)
            : eq(denunciasComunidad.comentarioId, id),
        ),
      ),
  );

  revalidatePath(COLA);
  redirect(`${COLA}?hecho=dejado`);
}
