'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireGestionMinisterioAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { asistencias, reuniones } from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { listaDelEquipo } from '@/lib/asistencia/consultas';
import { campo, campoObligatorio, campos } from '@/lib/api/formulario';

/**
 * La agenda de un ministerio: ensayos, clases, salidas.
 *
 * EL GUARD ES EL DEL MINISTERIO, NO `registrar_asistencia`
 * --------------------------------------------------------
 * Y es deliberado. `registrar_asistencia` abre el histórico de la congregación
 * ENTERA, que es lo más sensible que guarda la plataforma. Esto es otra cosa:
 * quién de tu propio equipo vino al ensayo del jueves, sobre gente cuya ficha el
 * responsable ya ve por serlo.
 *
 * Pedir el permiso global aquí obligaría al pastor a dárselo al líder de
 * alabanza para que pudiera apuntar sus ensayos, y con él se llevaría de propina
 * quién falta al culto en toda la iglesia. Cruzar los dos ejes por comodidad es
 * exactamente lo que `permisos.ts` existe para evitar.
 *
 * Además, un ensayo NO cuenta para `ultima_asistencia`: lo garantiza el trigger
 * de la `0030`, que solo mira las reuniones con `ministerio_id is null`.
 */

const EsquemaReunion = z.object({
  titulo: z
    .string()
    .trim()
    .min(2, 'Ponle un nombre.')
    .max(120, 'Ese nombre es demasiado largo.'),
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

const agenda = (ministerioId: string) =>
  `/panel/ministerios/${ministerioId}/agenda`;

export async function crearReunionDeMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = agenda(ministerioId);

  const parsed = leer(formData);
  if (!parsed.success) volver(parsed.error.issues[0]!.message, `${base}/nueva`);

  const d = parsed.data;

  let id: string;
  try {
    id = await withUser(ctx.user.id, async (tx) => {
      const [creada] = await tx
        .insert(reuniones)
        .values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
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
  } catch (err) {
    // El guard de la aplicación ya comprueba que este ministerio es suyo, así
    // que HT116 aquí solo salta si alguien manda un uuid de otra iglesia a mano.
    // Se traduce igual: un 500 en pantalla no le dice nada a nadie.
    if (esGuardHatril(err, 'HT116')) {
      volver('Ese ministerio no es de tu iglesia.', base);
    }
    throw err;
  }

  revalidatePath(base);
  redirect(`${base}/${id}?guardado=creada`);
}

export async function editarReunionDeMinisterio(
  ministerioId: string,
  reunionId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = agenda(ministerioId);

  const parsed = leer(formData);
  if (!parsed.success) {
    volver(parsed.error.issues[0]!.message, `${base}/${reunionId}/editar`);
  }

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
          // El tercer cinturón, y aquí sí hace falta: sin él, el responsable de
          // alabanza podría editar el ensayo de niños mandando su uuid a mano.
          // La RLS no lo para —las dos filas son de su iglesia— y el guard de
          // arriba solo ha comprobado el ministerio de la URL.
          eq(reuniones.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(base);
  redirect(`${base}/${reunionId}?guardado=editada`);
}

/** Quién del equipo vino. Solo alcanza al equipo, nunca a la congregación. */
export async function guardarListaDelEquipo(
  ministerioId: string,
  reunionId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `${agenda(ministerioId)}/${reunionId}`;

  const presentes = new Set(campos(formData, 'presentes'));
  const equipo = await listaDelEquipo(ctx, reunionId, ministerioId);

  if (equipo.length === 0) {
    volver('Este equipo todavía no tiene a nadie.', destino);
  }

  const filas = equipo.map((p) => ({
    iglesiaId: ctx.iglesia.id,
    reunionId,
    miembroId: p.miembroId,
    presente: presentes.has(p.miembroId),
    origen: 'panel' as const,
    registradoPorMiembroId: ctx.miembroId,
  }));

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .insert(asistencias)
        .values(filas)
        .onConflictDoUpdate({
          target: [asistencias.reunionId, asistencias.miembroId],
          set: {
            presente: sql`excluded.presente`,
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

  // Sin `revalidatePath('/panel/miembros')`, al revés que la lista del culto:
  // un ensayo no toca `ultima_asistencia`, así que la ficha de nadie cambia.
  revalidatePath(agenda(ministerioId));
  redirect(`${destino}?guardado=lista`);
}

export async function borrarReunionDeMinisterio(
  ministerioId: string,
  reunionId: string,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = agenda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(reuniones)
      .where(
        and(
          eq(reuniones.id, reunionId),
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          eq(reuniones.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(base);
  redirect(`${base}?guardado=borrada`);
}
