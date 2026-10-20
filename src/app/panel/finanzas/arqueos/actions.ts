'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireFinanzasAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { arqueos, cajas, fondos } from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { parsearDinero } from '@/lib/format/dinero';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * El arqueo del culto, a dos personas.
 *
 * Las tres actions piden lo mismo que el resto de la caja —`gestionar_finanzas`
 * o ser pastor, y Finanzas encendida— y ADEMÁS una ficha propia: quien cuenta y
 * quien confirma quedan apuntados por su ficha, y sin ella la base no deja
 * hacer ninguna de las dos cosas (HT130). Se comprueba aquí antes para dar un
 * mensaje que se entienda.
 *
 * Que quien confirma no sea quien contó NO se comprueba aquí: lo hace la base,
 * con la sesión de quien escribe, y aquí solo se traduce su error. Si lo
 * comprobara la action, un POST fabricado se lo saltaría.
 */

const DESTINO = '/panel/finanzas/arqueos';
const DESTINO_NUEVO = `${DESTINO}/nuevo`;

function volver(destino: string, mensaje: string): never {
  redirect(`${destino}?error=` + encodeURIComponent(mensaje));
}

async function requireConFicha(destino: string): Promise<UserContext & { miembroId: string }> {
  const ctx = await requireFinanzasAccion(destino);
  if (!ctx.miembroId) {
    volver(
      destino,
      'Para contar o confirmar un arqueo necesitas tener ficha en la iglesia: queda apuntado quién lo hizo.',
    );
  }
  return ctx as UserContext & { miembroId: string };
}

/**
 * ¿Siguen vivos el fondo y la caja a donde irá el dinero?
 *
 * Un arqueo puede esperar días, y en ese tiempo el pastor puede archivar el
 * fondo o la caja. Confirmado así, sus ingresos caerían en algo que ya no sale
 * en «Saldo por fondo» ni en «Saldo por caja», y los saldos dejarían de
 * cuadrar con el libro. `archivarFondo` y `archivarCaja` no dejan archivar
 * con arqueos esperando; esto cubre el formulario abierto desde antes y lo que
 * se archivó antes de ese cambio.
 */
async function destinoVivo(
  ctx: UserContext,
  fondoId: string,
  cajaId: string,
): Promise<boolean> {
  return withUser(ctx.user.id, async (tx) => {
    const [fondo] = await tx
      .select({ id: fondos.id })
      .from(fondos)
      .where(
        and(
          eq(fondos.id, fondoId),
          eq(fondos.iglesiaId, ctx.iglesia.id),
          eq(fondos.activo, true),
        ),
      )
      .limit(1);
    const [caja] = await tx
      .select({ id: cajas.id })
      .from(cajas)
      .where(
        and(
          eq(cajas.id, cajaId),
          eq(cajas.iglesiaId, ctx.iglesia.id),
          eq(cajas.activo, true),
        ),
      )
      .limit(1);
    return Boolean(fondo && caja);
  });
}

/**
 * Un importe que puede venir vacío: «0» es un valor válido (un culto sin
 * diezmos), y en el móvil se deja el campo en blanco antes que escribir un cero.
 */
const Importe = z
  .string()
  .optional()
  .transform((v) => (v ? parsearDinero(v) : '0'))
  .refine((v) => v !== null && Number(v) >= 0, 'Escribe los importes en números.');

const EsquemaArqueo = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha del culto.'),
    totalDiezmos: Importe,
    totalOfrendas: Importe,
    fondoId: z.string().uuid('Elige un fondo.'),
    cajaId: z.string().uuid('Elige una caja.'),
  })
  .refine((d) => Number(d.totalDiezmos) + Number(d.totalOfrendas) > 0, {
    message: 'Escribe lo que se contó: los diezmos, las ofrendas o los dos.',
  });

export async function crearArqueo(formData: FormData): Promise<void> {
  const ctx = await requireConFicha(DESTINO_NUEVO);

  const datos = EsquemaArqueo.safeParse({
    fecha: campoObligatorio(formData, 'fecha'),
    totalDiezmos: campo(formData, 'totalDiezmos'),
    totalOfrendas: campo(formData, 'totalOfrendas'),
    fondoId: campoObligatorio(formData, 'fondoId'),
    cajaId: campoObligatorio(formData, 'cajaId'),
  });
  if (!datos.success) {
    volver(DESTINO_NUEVO, datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const d = datos.data;

  if (!(await destinoVivo(ctx, d.fondoId, d.cajaId))) {
    volver(
      DESTINO_NUEVO,
      'Ese fondo o esa caja ya no están activos. Vuelve a abrir el formulario y elige otros.',
    );
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(arqueos).values({
        iglesiaId: ctx.iglesia.id,
        fecha: d.fecha,
        totalDiezmos: d.totalDiezmos!,
        totalOfrendas: d.totalOfrendas!,
        fondoId: d.fondoId,
        cajaId: d.cajaId,
        contadoPorMiembroId: ctx.miembroId,
      }),
    );
  } catch (e) {
    // Ninguno de los dos le pasa a quien usa la pantalla: los desplegables
    // solo traen lo de su iglesia y la ficha es la suya. Si salen, alguien ha
    // tocado el formulario; se traducen igual.
    if (esGuardHatril(e, 'HT129')) {
      volver(DESTINO_NUEVO, 'Ese fondo o esa caja no son de tu iglesia.');
    }
    if (esGuardHatril(e, 'HT130')) {
      volver(DESTINO_NUEVO, 'El arqueo tiene que contarlo quien tiene la sesión abierta.');
    }
    throw e;
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=contado`);
}

/**
 * Confirmar: la hora la pone la base, y los ingresos también, en la misma
 * sentencia (`arqueo_genera_ingresos`, `0044`). Aquí solo se dice quién.
 */
export async function confirmarArqueo(formData: FormData): Promise<void> {
  const id = campoObligatorio(formData, 'id');
  const ctx = await requireConFicha(DESTINO);
  if (!z.string().uuid().safeParse(id).success) volver(DESTINO, 'Ese arqueo no existe.');

  const [pendiente] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ fondoId: arqueos.fondoId, cajaId: arqueos.cajaId })
      .from(arqueos)
      .where(
        and(
          eq(arqueos.id, id),
          eq(arqueos.iglesiaId, ctx.iglesia.id),
          isNull(arqueos.confirmadoAt),
        ),
      )
      .limit(1),
  );
  if (pendiente && !(await destinoVivo(ctx, pendiente.fondoId, pendiente.cajaId))) {
    volver(
      DESTINO,
      'El fondo o la caja de este arqueo se archivó mientras esperaba. Descártalo y vuelve a contarlo con otro destino.',
    );
  }

  let filas: { id: string }[] = [];
  try {
    filas = await withUser(ctx.user.id, (tx) =>
      tx
        .update(arqueos)
        .set({ confirmadoPorMiembroId: ctx.miembroId, confirmadoAt: new Date() })
        .where(
          and(
            eq(arqueos.id, id),
            eq(arqueos.iglesiaId, ctx.iglesia.id),
            isNull(arqueos.confirmadoAt),
          ),
        )
        .returning({ id: arqueos.id }),
    );
  } catch (e) {
    // HT131 es lo mismo visto por cuenta y no por ficha (`0045`): para quien
    // lo lee, es que lo contó él.
    if (esGuardHatril(e, 'HT130') || esGuardHatril(e, 'HT131')) {
      volver(
        DESTINO,
        'No puedes confirmar un arqueo que has contado tú: tiene que hacerlo otra persona que lleve la caja, o el pastor.',
      );
    }
    throw e;
  }

  // Fuera del `try`: `redirect()` funciona lanzando.
  if (filas.length === 0) {
    volver(DESTINO, 'Ese arqueo ya estaba confirmado o se descartó.');
  }

  revalidatePath(DESTINO);
  revalidatePath('/panel/finanzas');
  revalidatePath('/panel/finanzas/movimientos');
  redirect(`${DESTINO}?guardado=confirmado`);
}

/**
 * Descartar uno que espera: no ha movido dinero, así que se borra. Es también
 * la forma de corregirlo —descartar y volver a contar—, porque lo contado no se
 * reescribe (HT130). Lo puede hacer cualquiera que lleve la caja: si quien
 * confirma no está de acuerdo con la cuenta, lo descarta y se vuelve a contar.
 */
export async function descartarArqueo(formData: FormData): Promise<void> {
  const id = campoObligatorio(formData, 'id');
  const ctx = await requireFinanzasAccion(DESTINO);
  if (!z.string().uuid().safeParse(id).success) volver(DESTINO, 'Ese arqueo no existe.');

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .delete(arqueos)
      .where(
        and(
          eq(arqueos.id, id),
          eq(arqueos.iglesiaId, ctx.iglesia.id),
          isNull(arqueos.confirmadoAt),
        ),
      )
      .returning({ id: arqueos.id }),
  );

  if (filas.length === 0) {
    volver(DESTINO, 'Ese arqueo ya está confirmado: se corrige apuntando un ajuste en el libro.');
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=descartado`);
}
