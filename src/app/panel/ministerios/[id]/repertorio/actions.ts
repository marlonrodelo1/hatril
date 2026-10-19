'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireGestionMinisterioAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { canciones, turnoCanciones } from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation, pgErrorCode } from '@/lib/db/error';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { EsquemaEnlace, normalizarEnlace } from '@/lib/repertorio/enlaces';
import { turnoEsDelMinisterio } from '@/lib/turnos/consultas';

/**
 * El repertorio de un equipo y la lista de canciones de cada culto.
 *
 * El guard es el del ministerio, como en la agenda y los turnos: elegir qué se
 * toca el domingo es el trabajo de quien lleva el equipo, y un permiso propio
 * sería una casilla más que marcar antes de poder hacerlo.
 *
 * Y el tercer cinturón en cada action: la canción o el turno de la URL tienen
 * que ser de ESTE ministerio. La RLS no lo distingue —todo es de la misma
 * iglesia— y HT124 solo garantiza que canción y turno sean del mismo equipo,
 * no que ese equipo sea el que esta persona lleva.
 */

const repertorioDe = (ministerioId: string) =>
  `/panel/ministerios/${ministerioId}/repertorio`;

const turnoDe = (ministerioId: string, turnoId: string) =>
  `/panel/ministerios/${ministerioId}/turnos/${turnoId}`;

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

const Tono = z
  .string()
  .trim()
  .max(12, 'El tono es demasiado largo. Basta con «G» o «Re menor».')
  .optional();

const EsquemaCancion = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, 'Escribe el título de la canción.')
    .max(120, 'Ese título es demasiado largo.'),
  autor: z.string().trim().max(120, 'Ese nombre es demasiado largo.').optional(),
  tono: Tono,
  enlaceAudio: EsquemaEnlace,
  enlacePartitura: EsquemaEnlace,
  notas: z.string().trim().max(500, 'Las notas son demasiado largas.').optional(),
});

function leerCancion(formData: FormData) {
  return EsquemaCancion.safeParse({
    titulo: campoObligatorio(formData, 'titulo'),
    autor: campo(formData, 'autor'),
    tono: campo(formData, 'tono'),
    enlaceAudio: normalizarEnlace(campo(formData, 'enlaceAudio')),
    enlacePartitura: normalizarEnlace(campo(formData, 'enlacePartitura')),
    notas: campo(formData, 'notas'),
  });
}

// ===========================================================================
// El repertorio
// ===========================================================================

export async function crearCancion(ministerioId: string, formData: FormData) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = repertorioDe(ministerioId);

  const leido = leerCancion(formData);
  if (!leido.success) volver(leido.error.issues[0]!.message, `${base}/nueva`);
  const d = leido.data;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(canciones).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        titulo: d.titulo,
        autor: oNulo(d.autor),
        tono: oNulo(d.tono),
        enlaceAudio: oNulo(d.enlaceAudio),
        enlacePartitura: oNulo(d.enlacePartitura),
        notas: oNulo(d.notas),
      }),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver(
        'Esa canción ya está en el repertorio. Búscala en la lista.',
        `${base}/nueva`,
      );
    }
    if (esGuardHatril(err, 'HT124')) volver('Ese ministerio no es de tu iglesia.', base);
    throw err;
  }

  revalidatePath(base);
  // De vuelta a la lista y no a la ficha: al empezar se meten diez canciones
  // seguidas, y cada vuelta por la ficha sería un clic más por canción.
  redirect(`${base}?guardado=creada`);
}

export async function editarCancion(
  ministerioId: string,
  cancionId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `${repertorioDe(ministerioId)}/${cancionId}`;

  const leido = leerCancion(formData);
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);
  const d = leido.data;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(canciones)
        .set({
          titulo: d.titulo,
          autor: oNulo(d.autor),
          tono: oNulo(d.tono),
          enlaceAudio: oNulo(d.enlaceAudio),
          enlacePartitura: oNulo(d.enlacePartitura),
          notas: oNulo(d.notas),
        })
        .where(
          and(
            eq(canciones.id, cancionId),
            eq(canciones.iglesiaId, ctx.iglesia.id),
            eq(canciones.ministerioId, ministerioId),
          ),
        ),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver('Ya hay otra canción con ese título y ese autor.', destino);
    }
    throw err;
  }

  revalidatePath(repertorioDe(ministerioId));
  redirect(`${destino}?guardado=editada`);
}

/** Archivar o devolver al repertorio. Una sola action con el valor al lado. */
export async function archivarCancion(
  ministerioId: string,
  cancionId: string,
  archivar: boolean,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `${repertorioDe(ministerioId)}/${cancionId}`;

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(canciones)
      .set({ archivada: archivar })
      .where(
        and(
          eq(canciones.id, cancionId),
          eq(canciones.iglesiaId, ctx.iglesia.id),
          eq(canciones.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(repertorioDe(ministerioId));
  redirect(`${destino}?guardado=${archivar ? 'archivada' : 'recuperada'}`);
}

/**
 * Borrar una canción que NUNCA salió en una lista.
 *
 * Si salió, la base lo impide —la clave ajena de `turno_canciones` es NO
 * ACTION— y se le dice que la archive. Borrarla se llevaría ese domingo de la
 * historia del equipo.
 */
export async function borrarCancion(ministerioId: string, cancionId: string) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = repertorioDe(ministerioId);

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .delete(canciones)
        .where(
          and(
            eq(canciones.id, cancionId),
            eq(canciones.iglesiaId, ctx.iglesia.id),
            eq(canciones.ministerioId, ministerioId),
          ),
        ),
    );
  } catch (err) {
    if (pgErrorCode(err) === '23503') {
      volver(
        'Esta canción ya ha salido en alguna lista y borrarla se llevaría esos domingos. Archívala: deja de salir al elegir y no se pierde nada.',
        `${base}/${cancionId}`,
      );
    }
    throw err;
  }

  revalidatePath(base);
  redirect(`${base}?guardado=borrada`);
}

// ===========================================================================
// La lista de un culto
// ===========================================================================

const EsquemaElegir = z.object({
  cancionId: z.string().uuid('Elige una canción del repertorio.'),
  tono: Tono,
});

export async function agregarCancionAlTurno(
  ministerioId: string,
  turnoId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = turnoDe(ministerioId, turnoId);

  const leido = EsquemaElegir.safeParse({
    cancionId: campoObligatorio(formData, 'cancionId'),
    tono: campo(formData, 'tono'),
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);

  if (!(await turnoEsDelMinisterio(ctx, turnoId, ministerioId))) {
    volver('Ese turno ya no existe.', `/panel/ministerios/${ministerioId}/turnos`);
  }

  try {
    await withUser(ctx.user.id, async (tx) => {
      // Al final de la lista. `max()+1` dentro de la misma transacción: dos
      // responsables añadiendo a la vez podrían empatar, y no pasa nada —se
      // ordena por `orden` y después por `created_at`—.
      const [ultima] = await tx
        .select({ orden: sql<number>`coalesce(max(${turnoCanciones.orden}), 0)` })
        .from(turnoCanciones)
        .where(eq(turnoCanciones.turnoId, turnoId));

      await tx.insert(turnoCanciones).values({
        iglesiaId: ctx.iglesia.id,
        turnoId,
        cancionId: leido.data.cancionId,
        orden: Number(ultima?.orden ?? 0) + 1,
        tono: oNulo(leido.data.tono),
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) volver('Esa canción ya está en la lista.', destino);
    if (esGuardHatril(err, 'HT124')) {
      volver('Esa canción no es del repertorio de este equipo.', destino);
    }
    throw err;
  }

  revalidatePath(destino);
  redirect(`${destino}?guardado=cancion#canciones`);
}

export async function quitarCancionDelTurno(
  ministerioId: string,
  turnoId: string,
  filaId: string,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = turnoDe(ministerioId, turnoId);

  if (!(await turnoEsDelMinisterio(ctx, turnoId, ministerioId))) {
    volver('Ese turno ya no existe.', `/panel/ministerios/${ministerioId}/turnos`);
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(turnoCanciones)
      .where(
        and(
          eq(turnoCanciones.id, filaId),
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          eq(turnoCanciones.turnoId, turnoId),
        ),
      ),
  );

  revalidatePath(destino);
  redirect(`${destino}?guardado=cancion-quitada#canciones`);
}

/**
 * Sube o baja una canción un puesto en la lista.
 *
 * Se renumera la lista entera en el orden nuevo en vez de intercambiar dos
 * números: con huecos o empates en `orden` —dos que se añadieron a la vez, una
 * que se quitó—, intercambiar con «la de al lado» puede no mover nada.
 */
export async function moverCancion(
  ministerioId: string,
  turnoId: string,
  filaId: string,
  direccion: 'arriba' | 'abajo',
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = turnoDe(ministerioId, turnoId);

  if (!(await turnoEsDelMinisterio(ctx, turnoId, ministerioId))) {
    volver('Ese turno ya no existe.', `/panel/ministerios/${ministerioId}/turnos`);
  }

  await withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({ id: turnoCanciones.id })
      .from(turnoCanciones)
      .where(
        and(
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          eq(turnoCanciones.turnoId, turnoId),
        ),
      )
      .orderBy(asc(turnoCanciones.orden), asc(turnoCanciones.createdAt));

    const ids = filas.map((f) => f.id);
    const i = ids.indexOf(filaId);
    const j = direccion === 'arriba' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;

    [ids[i], ids[j]] = [ids[j]!, ids[i]!];

    for (const [posicion, id] of ids.entries()) {
      await tx
        .update(turnoCanciones)
        .set({ orden: posicion + 1 })
        .where(and(eq(turnoCanciones.id, id), eq(turnoCanciones.turnoId, turnoId)));
    }
  });

  revalidatePath(destino);
  redirect(`${destino}#canciones`);
}

/** El tono de ESE domingo. Vacío vuelve al de la canción. */
export async function cambiarTonoDelDia(
  ministerioId: string,
  turnoId: string,
  filaId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = turnoDe(ministerioId, turnoId);

  const leido = Tono.safeParse(campo(formData, 'tono'));
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);

  if (!(await turnoEsDelMinisterio(ctx, turnoId, ministerioId))) {
    volver('Ese turno ya no existe.', `/panel/ministerios/${ministerioId}/turnos`);
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(turnoCanciones)
      .set({ tono: oNulo(leido.data) })
      .where(
        and(
          eq(turnoCanciones.id, filaId),
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          eq(turnoCanciones.turnoId, turnoId),
        ),
      ),
  );

  revalidatePath(destino);
  redirect(`${destino}?guardado=tono#canciones`);
}
