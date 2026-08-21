'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { asistencias, reuniones } from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { listaParaPasar } from '@/lib/asistencia/consultas';
import { campo, campoObligatorio, campos } from '@/lib/api/formulario';

const DESTINO = '/panel/reuniones';

/**
 * Las reuniones de la congregación y su lista.
 *
 * TODAS LAS ACTIONS PIDEN EL PERMISO, NO SOLO LAS PANTALLAS
 * ---------------------------------------------------------
 * Una server action es un endpoint. El guard del `layout.tsx` protege lo que se
 * pinta; lo que se ejecuta lo protege cada función de aquí, y esconder el botón
 * no protege nada.
 */

const EsquemaReunion = z.object({
  titulo: z
    .string()
    .trim()
    .min(2, 'Ponle un nombre a la reunión.')
    .max(120, 'Ese nombre es demasiado largo.'),
  // `date` de Postgres. Se valida el formato aquí porque el `<input type=date>`
  // lo garantiza en el navegador y una action no puede fiarse del navegador.
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisa la fecha.'),
  hora: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Revisa la hora.')
    .optional()
    .or(z.literal('')),
  lugar: z.string().trim().max(160).optional().or(z.literal('')),
  notas: z.string().trim().max(2000).optional().or(z.literal('')),
});

function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

function leer(formData: FormData) {
  return EsquemaReunion.safeParse({
    titulo: campoObligatorio(formData, 'titulo'),
    fecha: campoObligatorio(formData, 'fecha'),
    hora: campo(formData, 'hora'),
    lugar: campo(formData, 'lugar'),
    notas: campo(formData, 'notas'),
  });
}

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

export async function crearReunion(formData: FormData) {
  const ctx = await requirePermisoAccion('registrar_asistencia', DESTINO);

  const parsed = leer(formData);
  if (!parsed.success) {
    volver(parsed.error.issues[0]!.message, `${DESTINO}/nueva`);
  }

  const d = parsed.data;

  const id = await withUser(ctx.user.id, async (tx) => {
    const [creada] = await tx
      .insert(reuniones)
      .values({
        iglesiaId: ctx.iglesia.id,
        // Sin ministerio: esta pantalla es la de la congregación. Las de un
        // equipo se crean desde su propia agenda, con `ministerio_id`, y solo
        // las de aquí cuentan para el histórico de asistencia.
        ministerioId: null,
        titulo: d.titulo,
        fecha: d.fecha,
        hora: oNulo(d.hora),
        lugar: oNulo(d.lugar),
        notas: oNulo(d.notas),
        creadoPorMiembroId: ctx.miembroId,
      })
      .returning({ id: reuniones.id });

    return creada!.id;
  });

  revalidatePath(DESTINO);
  // Directo a pasar lista: apuntar la reunión sin decir quién vino no sirve de
  // nada, y volver al listado obliga a buscarla para hacer lo único que queda.
  redirect(`${DESTINO}/${id}?guardado=creada`);
}

export async function editarReunion(reunionId: string, formData: FormData) {
  const ctx = await requirePermisoAccion('registrar_asistencia', DESTINO);
  const destino = `${DESTINO}/${reunionId}/editar`;

  const parsed = leer(formData);
  if (!parsed.success) volver(parsed.error.issues[0]!.message, destino);

  const d = parsed.data;

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(reuniones)
      .set({
        titulo: d.titulo,
        fecha: d.fecha,
        hora: oNulo(d.hora),
        lugar: oNulo(d.lugar),
        notas: oNulo(d.notas),
      })
      .where(
        and(
          eq(reuniones.id, reunionId),
          eq(reuniones.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  revalidatePath(DESTINO);
  redirect(`${DESTINO}/${reunionId}?guardado=editada`);
}

/**
 * Pasar lista.
 *
 * SE ESCRIBE UNA FILA POR PERSONA, TAMBIÉN POR LA QUE NO VINO
 * -----------------------------------------------------------
 * El formulario solo envía a quien está marcado —el navegador no manda las
 * casillas vacías—, así que la ausencia hay que deducirla. Y se deduce de la
 * congregación que devuelve la base, NO de un campo oculto con la lista de
 * quién se pintó: un formulario manipulado no puede así colar el uuid de otra
 * iglesia (y si lo intentara, HT116 lo para en la base).
 *
 * El resultado es que cero filas en una reunión significa siempre «no se pasó
 * lista», nunca «no vino nadie». De esa distinción depende que «lleva cinco
 * domingos sin venir» sea verdad.
 */
export async function guardarLista(reunionId: string, formData: FormData) {
  const ctx = await requirePermisoAccion('registrar_asistencia', DESTINO);
  const destino = `${DESTINO}/${reunionId}`;

  const presentes = new Set(campos(formData, 'presentes'));
  const congregacion = await listaParaPasar(ctx, reunionId);

  if (congregacion.length === 0) {
    volver('No hay nadie en el fichero a quien pasar lista.', destino);
  }

  const filas = congregacion.map((p) => ({
    iglesiaId: ctx.iglesia.id,
    reunionId,
    miembroId: p.miembroId,
    presente: presentes.has(p.miembroId),
    // Explicito aunque sea el defecto de la columna: esta pantalla es UNA de las
    // procedencias posibles, y el dia que exista el check-in por QR la marca de
    // esa fila tendra que quedar corregida a `panel` si un ujier la repasa aqui.
    origen: 'panel' as const,
    registradoPorMiembroId: ctx.miembroId,
  }));

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .insert(asistencias)
        .values(filas)
        // Repasar una lista corrige, no duplica. `uq_asistencia_reunion_miembro`
        // es el índice sobre el que cae el conflicto.
        .onConflictDoUpdate({
          target: [asistencias.reunionId, asistencias.miembroId],
          set: {
            presente: sql`excluded.presente`,
            // El origen se reescribe también: quien repasa aquí una fila que
            // vino del QR se hace responsable de ella, y dejarla marcada como
            // autoconfirmada le atribuiría a la persona una marca que puso otro.
            origen: sql`excluded.origen`,
            registradoPorMiembroId: sql`excluded.registrado_por_miembro_id`,
          },
        }),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT116')) {
      volver('Esa reunión o esa persona no son de tu iglesia.', destino);
    }
    throw err;
  }

  // `ultima_asistencia` la mueve un trigger, y sale en la ficha de cada persona
  // y en el listado de miembros: hay que refrescar también esas pantallas.
  revalidatePath(DESTINO);
  revalidatePath('/panel/miembros');
  redirect(`${destino}?guardado=lista`);
}

export async function borrarReunion(reunionId: string) {
  const ctx = await requirePermisoAccion('registrar_asistencia', DESTINO);

  // Las asistencias caen con ella por la clave ajena en cascada, y el trigger de
  // borrado recalcula la última asistencia de cada persona afectada. Sin ese
  // recálculo, borrar el culto del domingo dejaría a media congregación con una
  // fecha que ya no respalda ninguna fila.
  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(reuniones)
      .where(
        and(
          eq(reuniones.id, reunionId),
          eq(reuniones.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  revalidatePath(DESTINO);
  revalidatePath('/panel/miembros');
  redirect(`${DESTINO}?guardado=borrada`);
}
