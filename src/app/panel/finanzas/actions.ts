'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireFinanzasAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { arqueos, cajas, fondos, movimientos } from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { parsearDinero } from '@/lib/format/dinero';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Las acciones de la caja.
 *
 * Todas exigen `gestionar_finanzas` y la herramienta encendida
 * (`requireFinanzasAccion`). El pastor pasa el permiso siempre, por
 * `requirePermisoAccion`, que ya comprueba `esPastor` antes que el mapa; la
 * herramienta apagada, no.
 *
 * Los errores se devuelven con `redirect('?error=')`, que es la convención del
 * repo: una action que redirige al fallar es indistinguible del éxito para
 * quien la invoca, así que el mensaje tiene que viajar en la URL.
 */

const DESTINO = '/panel/finanzas';
const DESTINO_LIBRO = '/panel/finanzas/movimientos';

function volver(destino: string, mensaje: string): never {
  redirect(`${destino}?error=` + encodeURIComponent(mensaje));
}

async function requireFinanzas(destino = DESTINO): Promise<UserContext> {
  return requireFinanzasAccion(destino);
}

/** Fondos y cajas: gobierno, solo el pastor (ver más abajo). */
async function requirePastorFinanzas(destino: string): Promise<UserContext> {
  return requireFinanzasAccion(destino, { soloPastor: true });
}

/**
 * Activar finanzas: siembra el fondo General y una caja de Efectivo.
 *
 * Sin esto, la primera pantalla que ve el tesorero es un formulario que NO SE
 * PUEDE ENVIAR, porque `fondo_id` y `caja_id` son obligatorios y no existe
 * ninguno. Un formulario que rebota sin explicación se lee como un producto
 * roto, no como una configuración que falta.
 *
 * `onConflictDoNothing` en lugar de comprobar antes: dos pulsaciones seguidas
 * del botón —que pasa, porque la primera tarda— chocarían contra
 * `uq_fondos_general` con un 23505 crudo.
 */
export async function activarFinanzas(): Promise<void> {
  const ctx = await requireFinanzas();

  try {
    await withUser(ctx.user.id, async (tx) => {
      await tx
        .insert(fondos)
        .values({
          iglesiaId: ctx.iglesia.id,
          nombre: 'General',
          esGeneral: true,
          orden: 0,
        })
        .onConflictDoNothing();

      await tx
        .insert(cajas)
        .values({
          iglesiaId: ctx.iglesia.id,
          nombre: 'Efectivo',
          tipo: 'efectivo',
        })
        .onConflictDoNothing();
    });
  } catch (e) {
    if (isUniqueViolation(e)) redirect(DESTINO);
    throw e;
  }

  revalidatePath(DESTINO);
  redirect(DESTINO);
}

/**
 * El importe llega como lo teclea una persona: «250.000», «250,50», «$ 250000».
 * `parsearDinero` decide qué separador es decimal y cuál agrupa; aquí solo se
 * comprueba que salga algo y que sea positivo.
 */
const EsquemaMovimiento = z.object({
  tipo: z.enum(['ingreso', 'gasto'], { message: 'Di si el dinero entra o sale.' }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha.'),
  importe: z
    .string()
    .min(1, 'Escribe el importe.')
    .refine((v) => {
      const n = parsearDinero(v);
      return n !== null && Number(n) > 0;
    }, 'El importe tiene que ser un número mayor que cero.'),
  concepto: z
    .string()
    .min(2, 'Escribe qué fue.')
    .max(200, 'El concepto es demasiado largo.'),
  fondoId: z.string().uuid('Elige un fondo.'),
  cajaId: z.string().uuid('Elige una caja.'),
  metodoPago: z.enum(['efectivo', 'transferencia', 'tarjeta', 'otro']),
  tipoIngreso: z.enum(['diezmo', 'ofrenda', 'donacion', 'otro']).optional(),
  referencia: z.string().max(100).optional(),
});

function leerMovimiento(formData: FormData) {
  return EsquemaMovimiento.safeParse({
    tipo: campoObligatorio(formData, 'tipo'),
    fecha: campoObligatorio(formData, 'fecha'),
    importe: campoObligatorio(formData, 'importe'),
    concepto: campoObligatorio(formData, 'concepto'),
    fondoId: campoObligatorio(formData, 'fondoId'),
    cajaId: campoObligatorio(formData, 'cajaId'),
    metodoPago: campo(formData, 'metodoPago') ?? 'efectivo',
    tipoIngreso: campo(formData, 'tipoIngreso'),
    referencia: campo(formData, 'referencia'),
  });
}

/**
 * Traduce los guards de Postgres a algo que un tesorero entienda.
 *
 * HT110 y HT111 no le pueden pasar a nadie que use la pantalla —los
 * desplegables solo traen fondos y cajas de su iglesia—, así que si aparecen es
 * que alguien ha manipulado el formulario. Aun así se traducen: un error crudo
 * de Postgres en pantalla asusta más que el propio fallo.
 */
function traducirError(e: unknown, destino: string): never {
  if (esGuardHatril(e, 'HT110')) {
    volver(destino, 'Ese fondo o esa caja no son de tu iglesia.');
  }
  if (esGuardHatril(e, 'HT111')) {
    volver(destino, 'Un movimiento no puede cambiar de iglesia.');
  }
  if (esGuardHatril(e, 'HT130')) {
    volver(
      destino,
      'Este ingreso sale de un arqueo confirmado y no se cambia. Si hay un error, apunta un ajuste aparte.',
    );
  }
  throw e;
}

export async function crearMovimiento(formData: FormData): Promise<void> {
  const ctx = await requireFinanzas(`${DESTINO_LIBRO}/nuevo`);
  const datos = leerMovimiento(formData);

  if (!datos.success) {
    volver(
      `${DESTINO_LIBRO}/nuevo`,
      datos.error.issues[0]?.message ?? 'Revisa los datos.',
    );
  }

  const d = datos.data;

  // El CHECK `ck_movimientos_tipo_ingreso` es una equivalencia: un ingreso
  // EXIGE tipo y un gasto lo PROHÍBE. Si el formulario manda el tipo de ingreso
  // con «sale» marcado —y lo manda, porque el campo sigue en el DOM—, la
  // inserción se caería con un error de restricción que no dice nada.
  const tipoIngreso = d.tipo === 'ingreso' ? (d.tipoIngreso ?? 'ofrenda') : null;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(movimientos).values({
        iglesiaId: ctx.iglesia.id,
        tipo: d.tipo,
        fecha: d.fecha,
        importe: parsearDinero(d.importe)!,
        concepto: d.concepto,
        fondoId: d.fondoId,
        cajaId: d.cajaId,
        metodoPago: d.metodoPago,
        referencia: d.referencia ?? null,
        tipoIngreso,
        registradoPorMiembroId: ctx.miembroId,
      }),
    );
  } catch (e) {
    traducirError(e, `${DESTINO_LIBRO}/nuevo`);
  }

  revalidatePath(DESTINO);
  revalidatePath(DESTINO_LIBRO);
  redirect(DESTINO_LIBRO);
}

export async function editarMovimiento(formData: FormData): Promise<void> {
  const id = campoObligatorio(formData, 'id');
  const destino = `${DESTINO_LIBRO}/${id}`;
  const ctx = await requireFinanzas(destino);

  const datos = leerMovimiento(formData);
  if (!datos.success) {
    volver(destino, datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  const d = datos.data;
  const tipoIngreso = d.tipo === 'ingreso' ? (d.tipoIngreso ?? 'ofrenda') : null;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(movimientos)
        .set({
          tipo: d.tipo,
          fecha: d.fecha,
          importe: parsearDinero(d.importe)!,
          concepto: d.concepto,
          fondoId: d.fondoId,
          cajaId: d.cajaId,
          metodoPago: d.metodoPago,
          referencia: d.referencia ?? null,
          tipoIngreso,
        })
        // El `iglesia_id` en el WHERE es redundante con la RLS y se pone igual:
        // si algún día alguien llama a esto con `dbAdmin` por error, el filtro
        // sigue estando.
        .where(
          and(eq(movimientos.id, id), eq(movimientos.iglesiaId, ctx.iglesia.id)),
        ),
    );
  } catch (e) {
    traducirError(e, destino);
  }

  revalidatePath(DESTINO);
  revalidatePath(DESTINO_LIBRO);
  redirect(DESTINO_LIBRO);
}

/**
 * Borrar de verdad, sin contra-asiento.
 *
 * En la v1 no hay cierre de periodo que proteger, así que un movimiento mal
 * metido se borra y ya está. Cuando llegue el cierre, borrar dentro de un mes
 * cuadrado tendrá que convertirse en un asiento de corrección: descuadrar un
 * periodo ya firmado por la asamblea es otra cosa.
 */
export async function borrarMovimiento(formData: FormData): Promise<void> {
  const id = campoObligatorio(formData, 'id');
  const ctx = await requireFinanzas(DESTINO_LIBRO);

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .delete(movimientos)
        .where(
          and(eq(movimientos.id, id), eq(movimientos.iglesiaId, ctx.iglesia.id)),
        ),
    );
  } catch (e) {
    // La ficha de un ingreso de arqueo no pinta el botón; esto es para el POST
    // que llegue igual.
    traducirError(e, `${DESTINO_LIBRO}/${id}`);
  }

  revalidatePath(DESTINO);
  revalidatePath(DESTINO_LIBRO);
  redirect(DESTINO_LIBRO);
}

/** La fecha de hoy en la iglesia, para prellenar el formulario de alta. */
export async function fechaDeHoy(timezone: string): Promise<string> {
  return hoyEnLaIglesia(timezone);
}

// ===========================================================================
// Fondos y cajas
//
// Gobierno, no operativa: crear un fondo es decidir cómo se estructura el
// dinero de la congregación, y eso es del pastor. El tesorero apunta en los que
// existan. Por eso estas usan `requirePastorFinanzas` y no el permiso.
// ===========================================================================

const DESTINO_AJUSTES = '/panel/finanzas/ajustes';

const EsquemaFondo = z.object({
  nombre: z
    .string()
    .min(2, 'Escribe un nombre para el fondo.')
    .max(60, 'El nombre es demasiado largo.'),
});

const EsquemaCaja = z.object({
  nombre: z
    .string()
    .min(2, 'Escribe un nombre para la caja.')
    .max(60, 'El nombre es demasiado largo.'),
  tipo: z.enum(['efectivo', 'banco', 'billetera', 'pasarela'], {
    message: 'Elige de qué tipo es.',
  }),
});

export async function crearFondo(formData: FormData): Promise<void> {
  const ctx = await requirePastorFinanzas(DESTINO_AJUSTES);
  const datos = EsquemaFondo.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
  });
  if (!datos.success) {
    volver(DESTINO_AJUSTES, datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(fondos).values({
        iglesiaId: ctx.iglesia.id,
        nombre: datos.data.nombre,
        // Nunca general: el general lo crea la activación y solo puede haber
        // uno, garantizado por `uq_fondos_general`.
        esGeneral: false,
      }),
    );
  } catch (e) {
    // `uq_fondos_nombre` no distingue mayúsculas: «misiones» y «Misiones»
    // chocan, que es justo lo que evita partir los totales en dos.
    if (isUniqueViolation(e)) {
      volver(DESTINO_AJUSTES, 'Ya tienes un fondo con ese nombre.');
    }
    throw e;
  }

  revalidatePath(DESTINO_AJUSTES);
  redirect(DESTINO_AJUSTES);
}

export async function crearCaja(formData: FormData): Promise<void> {
  const ctx = await requirePastorFinanzas(DESTINO_AJUSTES);
  const datos = EsquemaCaja.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    tipo: campoObligatorio(formData, 'tipo'),
  });
  if (!datos.success) {
    volver(DESTINO_AJUSTES, datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(cajas).values({
        iglesiaId: ctx.iglesia.id,
        nombre: datos.data.nombre,
        tipo: datos.data.tipo,
      }),
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      volver(DESTINO_AJUSTES, 'Ya tienes una caja con ese nombre.');
    }
    throw e;
  }

  revalidatePath(DESTINO_AJUSTES);
  redirect(DESTINO_AJUSTES);
}

/**
 * Archivar, no borrar.
 *
 * Un fondo con movimientos no se puede borrar sin descuadrar el libro —la FK es
 * `restrict` y Postgres lo impediría—, y una campaña de construcción terminada
 * tiene que seguir sumando en el histórico aunque ya no salga en el desplegable
 * del formulario. `activo = false` hace exactamente eso.
 *
 * El fondo general no se archiva: sin él, un ingreso sin designar no tiene
 * dónde caer y el formulario de alta se queda sin valor por defecto.
 */
export async function archivarFondo(formData: FormData): Promise<void> {
  const id = campoObligatorio(formData, 'id');
  const ctx = await requirePastorFinanzas(DESTINO_AJUSTES);

  if (await hayArqueosEsperando(ctx, { fondoId: id })) {
    volver(DESTINO_AJUSTES, ESPERAN_ARQUEOS);
  }

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .update(fondos)
      .set({ activo: false })
      .where(
        and(
          eq(fondos.id, id),
          eq(fondos.iglesiaId, ctx.iglesia.id),
          eq(fondos.esGeneral, false),
        ),
      )
      .returning({ id: fondos.id }),
  );

  if (filas.length === 0) {
    volver(DESTINO_AJUSTES, 'El fondo general no se puede archivar.');
  }

  revalidatePath(DESTINO_AJUSTES);
  redirect(DESTINO_AJUSTES);
}

/**
 * ¿Hay arqueos sin confirmar que van a este fondo o a esta caja?
 *
 * Archivarlo con uno esperando haría que, al confirmarlo, sus ingresos cayeran
 * en algo que ya no sale en los saldos. Primero se confirma o se descarta.
 */
const ESPERAN_ARQUEOS =
  'Hay un arqueo esperando confirmación que va aquí. Confírmalo o descártalo antes de archivar.';

async function hayArqueosEsperando(
  ctx: UserContext,
  destino: { fondoId?: string; cajaId?: string },
): Promise<boolean> {
  if (!z.string().uuid().safeParse(destino.fondoId ?? destino.cajaId).success) {
    return false;
  }
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: arqueos.id })
      .from(arqueos)
      .where(
        and(
          eq(arqueos.iglesiaId, ctx.iglesia.id),
          isNull(arqueos.confirmadoAt),
          destino.fondoId
            ? eq(arqueos.fondoId, destino.fondoId)
            : eq(arqueos.cajaId, destino.cajaId!),
        ),
      )
      .limit(1),
  );
  return filas.length > 0;
}

/**
 * Vincular un fondo a un ministerio, o desvincularlo con el valor vacío.
 *
 * Es lo que le enseña el fondo a quien lleva ese ministerio, así que es
 * gobierno y va con el pastor, como crear el fondo. El general no se vincula
 * (`ck_fondos_general_sin_ministerio`): es el dinero de toda la iglesia.
 *
 * Tres cosas las garantiza la base y aquí solo se traducen: un fondo vivo por
 * ministerio (`uq_fondos_ministerio`), el ministerio de esta iglesia (HT128) y
 * el general fuera.
 */
const EsquemaVinculo = z.object({
  id: z.string().uuid('Ese fondo no existe.'),
  ministerioId: z.union([z.literal(''), z.string().uuid('Elige un ministerio.')]),
});

export async function vincularFondo(formData: FormData): Promise<void> {
  const ctx = await requirePastorFinanzas(DESTINO_AJUSTES);
  const datos = EsquemaVinculo.safeParse({
    id: campoObligatorio(formData, 'id'),
    ministerioId: campo(formData, 'ministerioId') ?? '',
  });
  if (!datos.success) {
    volver(DESTINO_AJUSTES, datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  const { id, ministerioId } = datos.data;
  let filas: { id: string }[] = [];

  try {
    filas = await withUser(ctx.user.id, (tx) =>
      tx
        .update(fondos)
        .set({ ministerioId: ministerioId || null })
        .where(
          and(
            eq(fondos.id, id),
            eq(fondos.iglesiaId, ctx.iglesia.id),
            eq(fondos.esGeneral, false),
            eq(fondos.activo, true),
          ),
        )
        .returning({ id: fondos.id }),
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      volver(
        DESTINO_AJUSTES,
        'Ese ministerio ya tiene un fondo. Desvincula antes el otro.',
      );
    }
    if (esGuardHatril(e, 'HT128')) {
      volver(DESTINO_AJUSTES, 'Ese ministerio no es de tu iglesia.');
    }
    throw e;
  }

  // Fuera del `try`: `redirect()` funciona lanzando, y el `catch` se lo comería.
  if (filas.length === 0) {
    volver(DESTINO_AJUSTES, 'El fondo general no se vincula a ningún ministerio.');
  }

  revalidatePath(DESTINO_AJUSTES);
  if (ministerioId) revalidatePath(`/panel/ministerios/${ministerioId}`, 'layout');
  redirect(`${DESTINO_AJUSTES}?guardado=${ministerioId ? 'vinculado' : 'desvinculado'}`);
}

export async function archivarCaja(formData: FormData): Promise<void> {
  const id = campoObligatorio(formData, 'id');
  const ctx = await requirePastorFinanzas(DESTINO_AJUSTES);

  if (await hayArqueosEsperando(ctx, { cajaId: id })) {
    volver(DESTINO_AJUSTES, ESPERAN_ARQUEOS);
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(cajas)
      .set({ activo: false })
      .where(and(eq(cajas.id, id), eq(cajas.iglesiaId, ctx.iglesia.id))),
  );

  revalidatePath(DESTINO_AJUSTES);
  redirect(DESTINO_AJUSTES);
}
