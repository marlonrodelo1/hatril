'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { exigirModulo, requireGestionMinisterioAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { ninoFamilias, ninosArchivos, ninosCronograma, ninosPublicaciones, ninosSolicitudes } from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { campo, campoObligatorio, campos, casilla } from '@/lib/api/formulario';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import {
  BUCKETS,
  borrarFicheros,
  comprobarFichero,
  extensionDe,
  firmarSubida,
  rutaNueva,
} from '@/lib/ninos/almacen';
import {
  MAX_BYTES_FOTO,
  MAX_BYTES_VIDEO,
  MAX_DURACION_VIDEO_S,
  TIPOS_VIDEO,
} from '@/lib/ninos/limites';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * El tablón de familias: aceptar a las familias, el cronograma, el tablón y el
 * drive.
 *
 * TRES PUERTAS EN CADA ACTION, COMO EL REPARTO
 * -------------------------------------------
 *   1. `requireGestionMinisterioAccion(..., { desdeDentro: true })`: el pastor,
 *      o la responsable y los colíderes de ESTE ministerio.
 *   2. `exigirModulo(..., 'ninos')`: apagado, no se escribe.
 *   3. La RLS por relación de la `0060`, que es la que no se equivoca. Aceptar
 *      familias, por ejemplo, la estrecha a la responsable y al pastor: a un
 *      colíder la base le devuelve HT144 aunque mande el formulario a mano.
 */

const Id = z.string().uuid();
const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Esa fecha no se entiende.');

const base = (ministerioId: string) => `/panel/ministerios/${ministerioId}/ninos`;

function volver(destino: string, mensaje: string): never {
  redirect(`${destino}${destino.includes('?') ? '&' : '?'}error=${encodeURIComponent(mensaje)}`);
}

function hecho(destino: string, clave: string): never {
  revalidatePath(destino.split('?')[0]!);
  redirect(`${destino}${destino.includes('?') ? '&' : '?'}guardado=${clave}`);
}

async function guarda(ministerioId: string): Promise<UserContext> {
  const ctx = await requireGestionMinisterioAccion(ministerioId, '/panel/ministerios', {
    desdeDentro: true,
  });
  await exigirModulo(ctx, ministerioId, 'ninos');
  return ctx;
}

function exigirIds(destino: string, ...ids: string[]): void {
  if (!ids.every((i) => Id.safeParse(i).success)) volver(destino, 'No encuentro eso. Recarga la página.');
}

// ---------------------------------------------------------------------------
// Familias
// ---------------------------------------------------------------------------

/**
 * Aceptar una petición «tengo un hijo aquí». `nino` es `nuevo` o el id del niño
 * que ya existe, si quien lo pide es su otro progenitor.
 *
 * Todo lo hace `aceptar_solicitud_nino()` en una transacción (`0060`): el niño,
 * el vínculo, los permisos tal como los dio el padre, y fuera la petición.
 */
export async function aceptarSolicitud(ministerioId: string, solicitudId: string, formData: FormData) {
  const destino = `${base(ministerioId)}/familias`;
  exigirIds(destino, ministerioId, solicitudId);
  const ctx = await guarda(ministerioId);

  const eleccion = campoObligatorio(formData, 'nino');
  const ninoExistente = eleccion === 'nuevo' ? null : eleccion;
  if (ninoExistente && !Id.safeParse(ninoExistente).success) {
    volver(destino, 'Elige si es un niño nuevo o uno que ya está.');
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.execute(
        sql`select public.aceptar_solicitud_nino(${solicitudId}::uuid, ${ninoExistente}::uuid)`,
      ),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT144')) {
      const texto = String((err as { cause?: { message?: string } }).cause?.message ?? err);
      if (texto.includes('ya no existe')) volver(destino, 'Esa petición ya no existe: la retiró o la resolvió otra persona.');
      if (texto.includes('ya esta vinculado')) volver(destino, 'Esa persona ya está vinculada a ese niño.');
      if (texto.includes('no es de este ministerio')) volver(destino, 'Ese niño no es de este ministerio.');
      if (texto.includes('ya no esta activo')) volver(destino, 'Quien lo pidió ya no está activo en la iglesia.');
      volver(destino, 'Las familias las aceptan la responsable del ministerio o el pastor.');
    }
    if (esGuardHatril(err, 'HT142')) {
      volver(destino, 'Ese niño ya tiene 14 años o más: este ministerio es hasta los 13.');
    }
    throw err;
  }

  hecho(destino, 'aceptada');
}

/** Rechazar: se borra la petición entera. La RLS lo deja a la responsable y al pastor. */
export async function rechazarSolicitud(ministerioId: string, solicitudId: string) {
  const destino = `${base(ministerioId)}/familias`;
  exigirIds(destino, ministerioId, solicitudId);
  const ctx = await guarda(ministerioId);

  const borradas = await withUser(ctx.user.id, (tx) =>
    tx
      .delete(ninosSolicitudes)
      .where(
        and(
          eq(ninosSolicitudes.id, solicitudId),
          eq(ninosSolicitudes.iglesiaId, ctx.iglesia.id),
          eq(ninosSolicitudes.ministerioId, ministerioId),
        ),
      )
      .returning({ id: ninosSolicitudes.id }),
  );
  if (borradas.length === 0) {
    volver(destino, 'No se ha rechazado: o ya no existe, o solo pueden hacerlo la responsable y el pastor.');
  }

  hecho(destino, 'rechazada');
}

/**
 * Quitar el vínculo de una familia con un niño. Al irse la última, el niño se
 * borra solo y sus permisos quedan retirados (`al_romper_vinculo_nino`).
 */
export async function quitarFamilia(ministerioId: string, ninoId: string, miembroId: string) {
  const destino = `${base(ministerioId)}/familias`;
  exigirIds(destino, ministerioId, ninoId, miembroId);
  const ctx = await guarda(ministerioId);

  const quitadas = await withUser(ctx.user.id, (tx) =>
    tx
      .delete(ninoFamilias)
      .where(
        and(
          eq(ninoFamilias.iglesiaId, ctx.iglesia.id),
          eq(ninoFamilias.ministerioId, ministerioId),
          eq(ninoFamilias.ninoId, ninoId),
          eq(ninoFamilias.miembroId, miembroId),
        ),
      )
      .returning({ ninoId: ninoFamilias.ninoId }),
  );
  if (quitadas.length === 0) {
    volver(destino, 'No se ha quitado: o ya no estaba, o solo pueden hacerlo la responsable y el pastor.');
  }

  hecho(destino, 'quitada');
}

// ---------------------------------------------------------------------------
// Cronograma
// ---------------------------------------------------------------------------

const EsquemaClase = z.object({
  fecha: Fecha,
  tema: z
    .string()
    .trim()
    .min(1, 'Escribe el tema de la clase.')
    .max(120, 'El tema es demasiado largo: 120 letras como mucho.'),
  puntos: z.string().trim().max(2000, 'Los puntos son demasiado largos: 2.000 letras como mucho.').optional(),
  maestro: z.string().uuid().optional(),
});

function leerClase(formData: FormData) {
  return EsquemaClase.safeParse({
    fecha: campoObligatorio(formData, 'fecha'),
    tema: campoObligatorio(formData, 'tema'),
    puntos: campo(formData, 'puntos'),
    maestro: campo(formData, 'maestro'),
  });
}

export async function crearClase(ministerioId: string, formData: FormData) {
  const destino = `${base(ministerioId)}/cronograma`;
  exigirIds(destino, ministerioId);
  const ctx = await guarda(ministerioId);

  const leido = leerClase(formData);
  if (!leido.success) volver(destino, leido.error.issues[0]!.message);
  const d = leido.data;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(ninosCronograma).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        fecha: d.fecha,
        tema: d.tema,
        puntos: d.puntos ?? null,
        maestroMiembroId: d.maestro ?? null,
        creadoPorMiembroId: ctx.miembroId,
      }),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT142')) volver(destino, 'Quien da la clase no es de esta iglesia.');
    throw err;
  }

  hecho(destino, 'clase');
}

export async function editarClase(ministerioId: string, entradaId: string, formData: FormData) {
  const destino = `${base(ministerioId)}/cronograma`;
  exigirIds(destino, ministerioId, entradaId);
  const ctx = await guarda(ministerioId);

  const leido = leerClase(formData);
  if (!leido.success) volver(`${destino}/${entradaId}`, leido.error.issues[0]!.message);
  const d = leido.data;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(ninosCronograma)
        .set({
          fecha: d.fecha,
          tema: d.tema,
          puntos: d.puntos ?? null,
          maestroMiembroId: d.maestro ?? null,
        })
        .where(
          and(
            eq(ninosCronograma.id, entradaId),
            eq(ninosCronograma.iglesiaId, ctx.iglesia.id),
            eq(ninosCronograma.ministerioId, ministerioId),
          ),
        ),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT142')) volver(`${destino}/${entradaId}`, 'Quien da la clase no es de esta iglesia.');
    throw err;
  }

  hecho(destino, 'clase');
}

export async function borrarClase(ministerioId: string, entradaId: string) {
  const destino = `${base(ministerioId)}/cronograma`;
  exigirIds(destino, ministerioId, entradaId);
  const ctx = await guarda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(ninosCronograma)
      .where(
        and(
          eq(ninosCronograma.id, entradaId),
          eq(ninosCronograma.iglesiaId, ctx.iglesia.id),
          eq(ninosCronograma.ministerioId, ministerioId),
        ),
      ),
  );

  hecho(destino, 'clase-borrada');
}

// ---------------------------------------------------------------------------
// Tablón
// ---------------------------------------------------------------------------

const EsquemaTexto = z
  .string()
  .trim()
  .min(1, 'Cuenta en una frase lo que se hizo.')
  .max(1000, 'El texto es demasiado largo: 1.000 letras como mucho.');

const estaPublicacion = (ctx: UserContext, ministerioId: string, publicacionId: string) =>
  and(
    eq(ninosPublicaciones.id, publicacionId),
    eq(ninosPublicaciones.iglesiaId, ctx.iglesia.id),
    eq(ninosPublicaciones.ministerioId, ministerioId),
  );

/** Un borrador nuevo. Se publica después, con sus fotos, desde su página. */
export async function crearPublicacion(ministerioId: string, formData: FormData) {
  const destino = base(ministerioId);
  exigirIds(destino, ministerioId);
  const ctx = await guarda(ministerioId);

  const fecha = Fecha.safeParse(campoObligatorio(formData, 'fecha'));
  const texto = EsquemaTexto.safeParse(campoObligatorio(formData, 'texto'));
  if (!fecha.success) volver(destino, fecha.error.issues[0]!.message);
  if (!texto.success) volver(destino, texto.error.issues[0]!.message);
  // Lo de un día que todavía no ha pasado no se cuenta: se publica cuando pase.
  if (fecha.data > hoyEnLaIglesia(ctx.iglesia.timezone)) {
    volver(destino, 'Esa fecha todavía no ha llegado. El tablón cuenta lo que ya se hizo.');
  }

  const [creada] = await withUser(ctx.user.id, (tx) =>
    tx
      .insert(ninosPublicaciones)
      .values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        fecha: fecha.data,
        texto: texto.data,
        autorMiembroId: ctx.miembroId,
      })
      .returning({ id: ninosPublicaciones.id }),
  );

  hecho(`${destino}/publicacion/${creada!.id}`, 'creada');
}

export async function editarPublicacion(ministerioId: string, publicacionId: string, formData: FormData) {
  const destino = `${base(ministerioId)}/publicacion/${publicacionId}`;
  exigirIds(destino, ministerioId, publicacionId);
  const ctx = await guarda(ministerioId);

  const texto = EsquemaTexto.safeParse(campoObligatorio(formData, 'texto'));
  if (!texto.success) volver(destino, texto.error.issues[0]!.message);

  // La fecha solo viaja mientras es un borrador: publicada, no se mueve (HT143).
  const fechaCruda = campo(formData, 'fecha');
  const fecha = fechaCruda ? Fecha.safeParse(fechaCruda) : null;
  if (fecha && !fecha.success) volver(destino, fecha.error.issues[0]!.message);
  if (fecha?.success && fecha.data > hoyEnLaIglesia(ctx.iglesia.timezone)) {
    volver(destino, 'Esa fecha todavía no ha llegado. El tablón cuenta lo que ya se hizo.');
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(ninosPublicaciones)
        .set({ texto: texto.data, ...(fecha?.success ? { fecha: fecha.data } : {}) })
        .where(estaPublicacion(ctx, ministerioId, publicacionId)),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT143')) volver(destino, 'Ya está publicada: su fecha no se puede cambiar. Retírala antes si hace falta.');
    throw err;
  }

  hecho(destino, 'editada');
}

/**
 * Publicar. Con fotos o vídeos, pide la casilla de que solo salen niños que
 * pueden salir: Hatril no sabe quién sale en cada foto —ni debe saberlo—, y es
 * el último momento en que alguien mira antes de que lo vean las familias.
 */
export async function publicar(ministerioId: string, publicacionId: string, formData: FormData) {
  const destino = `${base(ministerioId)}/publicacion/${publicacionId}`;
  exigirIds(destino, ministerioId, publicacionId);
  const ctx = await guarda(ministerioId);

  const error = await withUser(ctx.user.id, async (tx) => {
    const [conArchivos] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(ninosArchivos)
      .where(
        and(
          eq(ninosArchivos.publicacionId, publicacionId),
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          eq(ninosArchivos.ministerioId, ministerioId),
        ),
      );
    if ((conArchivos?.n ?? 0) > 0 && !casilla(formData, 'revisado')) {
      return 'Antes de publicar, marca que has mirado las fotos: solo pueden salir los niños de la lista.';
    }

    const hechas = await tx
      .update(ninosPublicaciones)
      .set({ publicadaAt: new Date() })
      .where(and(estaPublicacion(ctx, ministerioId, publicacionId), isNull(ninosPublicaciones.publicadaAt)))
      .returning({ id: ninosPublicaciones.id });
    return hechas.length === 0 ? 'Ya estaba publicada, o ya no existe.' : null;
  });
  if (error) volver(destino, error);

  hecho(destino, 'publicada');
}

export async function retirarPublicacion(ministerioId: string, publicacionId: string) {
  const destino = `${base(ministerioId)}/publicacion/${publicacionId}`;
  exigirIds(destino, ministerioId, publicacionId);
  const ctx = await guarda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ninosPublicaciones)
      .set({ publicadaAt: null })
      .where(estaPublicacion(ctx, ministerioId, publicacionId)),
  );

  hecho(destino, 'retirada');
}

/** Borrar la publicación. Sus archivos se quedan en el drive (`set null`). */
export async function borrarPublicacion(ministerioId: string, publicacionId: string) {
  const destino = base(ministerioId);
  exigirIds(destino, ministerioId, publicacionId);
  const ctx = await guarda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx.delete(ninosPublicaciones).where(estaPublicacion(ctx, ministerioId, publicacionId)),
  );

  hecho(destino, 'borrada');
}

/** Añadir a la publicación archivos del drive que no van en ninguna otra. */
export async function adjuntarArchivos(ministerioId: string, publicacionId: string, formData: FormData) {
  const destino = `${base(ministerioId)}/publicacion/${publicacionId}`;
  exigirIds(destino, ministerioId, publicacionId);
  const ctx = await guarda(ministerioId);

  const ids = z.array(Id).max(40).safeParse(campos(formData, 'archivos'));
  if (!ids.success || ids.data.length === 0) volver(destino, 'Marca al menos una foto o un vídeo del drive.');

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ninosArchivos)
      .set({ publicacionId })
      .where(
        and(
          inArray(ninosArchivos.id, ids.data),
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          eq(ninosArchivos.ministerioId, ministerioId),
          isNull(ninosArchivos.publicacionId),
        ),
      ),
  );

  hecho(destino, 'adjuntados');
}

export async function quitarDePublicacion(ministerioId: string, publicacionId: string, archivoId: string) {
  const destino = `${base(ministerioId)}/publicacion/${publicacionId}`;
  exigirIds(destino, ministerioId, publicacionId, archivoId);
  const ctx = await guarda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ninosArchivos)
      .set({ publicacionId: null })
      .where(
        and(
          eq(ninosArchivos.id, archivoId),
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          eq(ninosArchivos.ministerioId, ministerioId),
          eq(ninosArchivos.publicacionId, publicacionId),
        ),
      ),
  );

  hecho(destino, 'quitado-de-publicacion');
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

const EsquemaSubida = z.object({
  tipo: z.enum(['foto', 'video']),
  mime: z.string().max(60),
  bytes: z.number().int().positive(),
  fecha: Fecha,
  duracionS: z.number().int().positive().max(MAX_DURACION_VIDEO_S).nullable(),
  mimeMiniatura: z.enum(['image/webp', 'image/jpeg']).nullable(),
});

export type PreparadaSubida =
  | {
      ok: true;
      id: string;
      bucket: string;
      fichero: { ruta: string; token: string };
      miniatura: { bucket: string; ruta: string; token: string } | null;
    }
  | { ok: false; error: string };

/**
 * Apunta el archivo y devuelve las URL de subida de un solo uso.
 *
 * La llama el componente de subida, no un formulario: devuelve datos en vez de
 * redirigir. Las guardas sí redirigen si no hay permiso, y el navegador sigue
 * esa redirección: no hay nada que subir.
 */
export async function prepararSubida(
  ministerioId: string,
  datos: z.input<typeof EsquemaSubida>,
): Promise<PreparadaSubida> {
  if (!Id.safeParse(ministerioId).success) return { ok: false, error: 'No encuentro ese ministerio.' };
  const ctx = await guarda(ministerioId);

  const leido = EsquemaSubida.safeParse(datos);
  if (!leido.success) return { ok: false, error: 'Ese archivo no se puede subir.' };
  const d = leido.data;

  const esVideo = d.tipo === 'video';
  if (esVideo ? !(TIPOS_VIDEO as readonly string[]).includes(d.mime) : !['image/webp', 'image/jpeg'].includes(d.mime)) {
    return { ok: false, error: esVideo ? 'Los vídeos, en MP4 o MOV.' : 'Las fotos, en JPG o WebP.' };
  }
  if (d.bytes > (esVideo ? MAX_BYTES_VIDEO : MAX_BYTES_FOTO)) {
    return {
      ok: false,
      error: esVideo
        ? 'El vídeo pesa más de 100 MB. Grábalo en 1080p o recórtalo a un minuto.'
        : 'La foto pesa más de 5 MB.',
    };
  }
  if (d.fecha > hoyEnLaIglesia(ctx.iglesia.timezone)) {
    return { ok: false, error: 'Esa fecha todavía no ha llegado.' };
  }

  const extension = extensionDe(d.mime)!;
  const { ruta, miniatura: base } = rutaNueva(ctx.iglesia.id, ministerioId, d.fecha, extension);
  const rutaMiniatura = d.mimeMiniatura
    ? base.replace(/\.min\.webp$/, `.min.${extensionDe(d.mimeMiniatura)}`)
    : null;

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .insert(ninosArchivos)
      .values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        tipo: d.tipo,
        ruta,
        miniaturaRuta: rutaMiniatura,
        bytes: d.bytes,
        duracionS: esVideo ? d.duracionS : null,
        fecha: d.fecha,
        subidoPorMiembroId: ctx.miembroId,
      })
      .returning({ id: ninosArchivos.id }),
  );

  const firmas = await firmarSubida(d.tipo, ruta, rutaMiniatura);
  if (!firmas) {
    await withUser(ctx.user.id, (tx) => tx.delete(ninosArchivos).where(eq(ninosArchivos.id, fila!.id)));
    return { ok: false, error: 'No se ha podido preparar la subida. Vuelve a intentarlo.' };
  }

  return {
    ok: true,
    id: fila!.id,
    bucket: BUCKETS[d.tipo],
    fichero: firmas.fichero,
    miniatura: firmas.miniatura ? { bucket: BUCKETS.foto, ...firmas.miniatura } : null,
  };
}

/**
 * Confirma que el fichero llegó y es lo que se apuntó. Hasta aquí, el archivo
 * no lo ve nadie más que los maestros, y no se puede adjuntar a nada.
 */
export async function confirmarSubida(
  ministerioId: string,
  archivoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Id.safeParse(ministerioId).success || !Id.safeParse(archivoId).success) {
    return { ok: false, error: 'No encuentro ese archivo.' };
  }
  const ctx = await guarda(ministerioId);

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ tipo: ninosArchivos.tipo, ruta: ninosArchivos.ruta, miniatura: ninosArchivos.miniaturaRuta, bytes: ninosArchivos.bytes })
      .from(ninosArchivos)
      .where(
        and(
          eq(ninosArchivos.id, archivoId),
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          eq(ninosArchivos.ministerioId, ministerioId),
        ),
      )
      .limit(1),
  );
  if (!fila) return { ok: false, error: 'No encuentro ese archivo.' };

  const guardado = await comprobarFichero(fila.tipo, fila.ruta);
  const tope = fila.tipo === 'video' ? MAX_BYTES_VIDEO : MAX_BYTES_FOTO;
  const tipoBien =
    fila.tipo === 'video'
      ? (TIPOS_VIDEO as readonly string[]).includes(guardado?.tipoMime ?? '')
      : ['image/webp', 'image/jpeg'].includes(guardado?.tipoMime ?? '');

  if (!guardado || guardado.bytes <= 0 || guardado.bytes > tope || !tipoBien) {
    await withUser(ctx.user.id, (tx) => tx.delete(ninosArchivos).where(eq(ninosArchivos.id, archivoId)));
    await borrarFicheros(fila.tipo, [fila.ruta]);
    if (fila.miniatura) await borrarFicheros('miniatura', [fila.miniatura]);
    return { ok: false, error: 'El archivo no llegó entero. Vuelve a subirlo.' };
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ninosArchivos)
      .set({ confirmadoAt: new Date() })
      .where(and(eq(ninosArchivos.id, archivoId), isNull(ninosArchivos.confirmadoAt))),
  );

  revalidatePath(`${base(ministerioId)}/drive`);
  return { ok: true };
}

/** Borrar del drive: la fila primero y el fichero después (`almacen.ts`). */
export async function borrarArchivo(ministerioId: string, archivoId: string) {
  const destino = `${base(ministerioId)}/drive`;
  exigirIds(destino, ministerioId, archivoId);
  const ctx = await guarda(ministerioId);

  const [borrado] = await withUser(ctx.user.id, (tx) =>
    tx
      .delete(ninosArchivos)
      .where(
        and(
          eq(ninosArchivos.id, archivoId),
          eq(ninosArchivos.iglesiaId, ctx.iglesia.id),
          eq(ninosArchivos.ministerioId, ministerioId),
        ),
      )
      .returning({ tipo: ninosArchivos.tipo, ruta: ninosArchivos.ruta, miniatura: ninosArchivos.miniaturaRuta }),
  );
  if (borrado) {
    await borrarFicheros(borrado.tipo, [borrado.ruta]);
    if (borrado.miniatura) await borrarFicheros('miniatura', [borrado.miniatura]);
  }

  hecho(destino, 'archivo-borrado');
}
