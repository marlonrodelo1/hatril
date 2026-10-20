'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import {
  exigirModulo,
  requireGestionMinisterioAccion,
} from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import {
  ministerioMiembros,
  ministerios,
  turnoAsignaciones,
  turnos,
} from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { campo, campoObligatorio, campos } from '@/lib/api/formulario';
import { conConfigDeModulo } from '@/lib/ministerios/modulos';
import {
  MAX_LARGO_PUESTO,
  limpiarPuestos,
  validarPuestos,
} from '@/lib/turnos/puestos';
import { cuandoEs } from '@/lib/turnos/fecha';
import {
  cuentaDeMiembro,
  emitirNotificaciones,
} from '@/lib/notificaciones/emitir';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Los turnos de un ministerio: en qué cultos sirve el equipo y quién va a cada
 * puesto.
 *
 * EL GUARD ES EL DEL MINISTERIO, COMO EN LA AGENDA
 * ------------------------------------------------
 * Pastor, quien tenga `gestionar_ministerios`, o el responsable y los colíderes
 * de ESTE equipo. No hay permiso propio, y es deliberado: hacer el cuadrante es
 * literalmente el trabajo de quien lleva el equipo, y un permiso más sería una
 * casilla que el pastor tendría que marcar a cada responsable antes de que
 * pudiera hacer lo único para lo que lo nombró.
 *
 * EL TERCER CINTURÓN, EN CADA ACTION
 * ----------------------------------
 * El guard comprueba el ministerio de la URL. Que el turno de la URL sea de ese
 * ministerio lo comprueba cada action en su `where`: sin eso, el responsable de
 * alabanza movería gente en el cuadrante de niños mandando su uuid a mano. La
 * RLS no lo para —las dos filas son de su iglesia—.
 */

const turnosDe = (ministerioId: string) =>
  `/panel/ministerios/${ministerioId}/turnos`;

/**
 * Las dos puertas de cada action de este fichero: quién manda en ESTE equipo,
 * y que la herramienta de turnos esté encendida. La segunda la cubría solo el
 * `layout.tsx`, que no corre en una server action.
 */
async function guarda(ministerioId: string) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  await exigirModulo(ctx, ministerioId, 'turnos');
  return ctx;
}

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

const Fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisa la fecha.');

const Hora = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, 'Revisa la hora.')
  .optional()
  .or(z.literal(''));

const Titulo = z
  .string()
  .trim()
  .min(2, 'Ponle un nombre al culto.')
  .max(120, 'Ese nombre es demasiado largo.');

const EsquemaTurno = z.object({
  titulo: Titulo,
  fecha: Fecha,
  hora: Hora,
  notas: z.string().trim().max(1000, 'Las notas son demasiado largas.').optional().or(z.literal('')),
});

/**
 * El turno de la URL, si es de ESTE ministerio. Ver «el tercer cinturón».
 *
 * Devuelve también lo que necesitan los avisos —el nombre del equipo, la fecha—
 * para no tener que pedirlo dos veces.
 */
async function turnoDelMinisterio(
  ctx: UserContext,
  ministerioId: string,
  turnoId: string,
): Promise<{
  id: string;
  fecha: string;
  hora: string | null;
  ministerioNombre: string;
} | null> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: turnos.id,
        fecha: turnos.fecha,
        hora: turnos.hora,
        ministerioNombre: ministerios.nombre,
      })
      .from(turnos)
      .innerJoin(ministerios, eq(ministerios.id, turnos.ministerioId))
      .where(
        and(
          eq(turnos.id, turnoId),
          eq(turnos.iglesiaId, ctx.iglesia.id),
          eq(turnos.ministerioId, ministerioId),
        ),
      )
      .limit(1),
  );

  return fila ? { ...fila, hora: fila.hora ? fila.hora.slice(0, 5) : null } : null;
}

/**
 * Avisa a cada persona de que le toca servir. Uno por persona y turno, no uno
 * por puesto: quien canta y toca la guitarra el mismo domingo recibe un aviso,
 * no dos.
 */
async function avisarAsignados(
  ctx: UserContext,
  turno: { id: string; fecha: string; hora: string | null; ministerioNombre: string },
  personas: { miembroId: string; puestos: string[] }[],
): Promise<void> {
  const cuentas = await Promise.all(
    personas.map((p) => cuentaDeMiembro(ctx.iglesia.id, p.miembroId)),
  );

  await emitirNotificaciones(
    personas.map((p, i) => ({
      iglesiaId: ctx.iglesia.id,
      destinatarioAuthUserId: cuentas[i] ?? null,
      tipo: 'turno_asignado' as const,
      datos: {
        ministerio: turno.ministerioNombre,
        fecha: cuandoEs(turno.fecha, turno.hora),
        puesto: p.puestos.join(', '),
      },
      enlace: `/mi/agenda/turno/${turno.id}`,
      // Si el responsable se pone a sí mismo, no hace falta que le avisen.
      provocadoPor: ctx.user.id,
    })),
  );
}

// ===========================================================================
// Los cultos en los que sirve el equipo
// ===========================================================================

/**
 * Varios cultos de golpe, desde la lista de «Planificar».
 *
 * Cada casilla viaja como `fecha|hora|título`. El título va al final y se
 * reconstruye con todo lo que sobra, porque el nombre de un culto es texto libre
 * del horario y puede llevar una barra dentro.
 *
 * Los que ya existían no fallan: `on conflict do nothing` sobre la restricción
 * única. Planificar dos veces el mismo mes —un doble clic, dos colíderes a la
 * vez— deja el mes planificado una sola vez.
 */
export async function planificarTurnos(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const base = turnosDe(ministerioId);

  const marcados = campos(formData, 'cultos');
  if (marcados.length === 0) {
    volver('Marca al menos un culto.', `${base}/planificar`);
  }

  const filas: (typeof turnos.$inferInsert)[] = [];

  // Tope a la lista: la pantalla ofrece seis semanas, y lo que pase de ahí no
  // ha salido de ella.
  for (const valor of marcados.slice(0, 60)) {
    const [fecha = '', hora = '', ...resto] = valor.split('|');
    const leido = EsquemaTurno.safeParse({
      titulo: resto.join('|'),
      fecha,
      hora,
    });
    if (!leido.success) {
      volver(leido.error.issues[0]!.message, `${base}/planificar`);
    }

    filas.push({
      iglesiaId: ctx.iglesia.id,
      ministerioId,
      titulo: leido.data.titulo,
      fecha: leido.data.fecha,
      hora: oNulo(leido.data.hora),
      creadoPorMiembroId: ctx.miembroId,
    });
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(turnos).values(filas).onConflictDoNothing(),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT122')) {
      volver('Ese ministerio no es de tu iglesia.', base);
    }
    throw err;
  }

  revalidatePath(base);
  redirect(`${base}?guardado=planificados`);
}

/** Un culto que no está en el horario: una vigilia, un culto especial. */
export async function crearTurno(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const base = turnosDe(ministerioId);

  const leido = EsquemaTurno.safeParse({
    titulo: campoObligatorio(formData, 'titulo'),
    fecha: campoObligatorio(formData, 'fecha'),
    hora: campo(formData, 'hora'),
    notas: campo(formData, 'notas'),
  });
  if (!leido.success) {
    volver(leido.error.issues[0]!.message, `${base}/planificar`);
  }

  const d = leido.data;
  let id: string | undefined;

  try {
    id = await withUser(ctx.user.id, async (tx) => {
      const [creado] = await tx
        .insert(turnos)
        .values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          titulo: d.titulo,
          fecha: d.fecha,
          hora: oNulo(d.hora),
          notas: oNulo(d.notas),
          creadoPorMiembroId: ctx.miembroId,
        })
        .returning({ id: turnos.id });
      return creado?.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver(
        'El equipo ya tiene un turno ese día a esa hora. Ábrelo desde la lista.',
        `${base}/planificar`,
      );
    }
    if (esGuardHatril(err, 'HT122')) {
      volver('Ese ministerio no es de tu iglesia.', base);
    }
    throw err;
  }

  revalidatePath(base);
  redirect(`${base}/${id}?guardado=creado`);
}

export async function editarTurno(
  ministerioId: string,
  turnoId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${turnosDe(ministerioId)}/${turnoId}`;

  const leido = EsquemaTurno.safeParse({
    titulo: campoObligatorio(formData, 'titulo'),
    fecha: campoObligatorio(formData, 'fecha'),
    hora: campo(formData, 'hora'),
    notas: campo(formData, 'notas'),
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);

  const d = leido.data;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(turnos)
        .set({
          titulo: d.titulo,
          fecha: d.fecha,
          hora: oNulo(d.hora),
          notas: oNulo(d.notas),
        })
        .where(
          and(
            eq(turnos.id, turnoId),
            eq(turnos.iglesiaId, ctx.iglesia.id),
            eq(turnos.ministerioId, ministerioId),
          ),
        ),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver('El equipo ya tiene otro turno ese día a esa hora.', destino);
    }
    throw err;
  }

  revalidatePath(turnosDe(ministerioId));
  redirect(`${destino}?guardado=editado`);
}

export async function borrarTurno(ministerioId: string, turnoId: string) {
  const ctx = await guarda(ministerioId);
  const base = turnosDe(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(turnos)
      .where(
        and(
          eq(turnos.id, turnoId),
          eq(turnos.iglesiaId, ctx.iglesia.id),
          eq(turnos.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(base);
  redirect(`${base}?guardado=borrado`);
}

// ===========================================================================
// Quién va a cada puesto
// ===========================================================================

const EsquemaAsignar = z.object({
  puesto: z
    .string()
    .trim()
    .min(1, 'Elige el puesto.')
    .max(MAX_LARGO_PUESTO, 'Ese puesto tiene un nombre demasiado largo.'),
  miembroId: z.string().uuid('Elige a alguien del equipo.'),
});

export async function asignarAlTurno(
  ministerioId: string,
  turnoId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${turnosDe(ministerioId)}/${turnoId}`;

  const leido = EsquemaAsignar.safeParse({
    puesto: campoObligatorio(formData, 'puesto'),
    miembroId: campoObligatorio(formData, 'miembroId'),
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);

  const { puesto, miembroId } = leido.data;

  const turno = await turnoDelMinisterio(ctx, ministerioId, turnoId);
  if (!turno) volver('Ese turno ya no existe.', turnosDe(ministerioId));

  let esNuevaEnElTurno = false;

  try {
    esNuevaEnElTurno = await withUser(ctx.user.id, async (tx) => {
      // Antes de insertar, para saber si es su primer puesto en este turno: el
      // aviso es uno por persona y turno, no uno por puesto.
      const previas = await tx
        .select({ id: turnoAsignaciones.id })
        .from(turnoAsignaciones)
        .where(
          and(
            eq(turnoAsignaciones.turnoId, turnoId),
            eq(turnoAsignaciones.miembroId, miembroId),
          ),
        )
        .limit(1);

      const insertadas = await tx
        .insert(turnoAsignaciones)
        .values({
          iglesiaId: ctx.iglesia.id,
          turnoId,
          miembroId,
          puesto,
          asignadoPorMiembroId: ctx.miembroId,
        })
        // Ya estaba en ese puesto: es un doble clic, no un error que contar.
        .onConflictDoNothing()
        .returning({ id: turnoAsignaciones.id });

      return previas.length === 0 && insertadas.length > 0;
    });
  } catch (err) {
    // HT122 aquí casi siempre es lo mismo: alguien a quien sacaron del equipo
    // mientras el desplegable seguía abierto en otra pestaña.
    if (esGuardHatril(err, 'HT122')) {
      volver('Esa persona no está en el equipo de este ministerio.', destino);
    }
    throw err;
  }

  if (esNuevaEnElTurno) {
    await avisarAsignados(ctx, turno, [{ miembroId, puestos: [puesto] }]);
  }

  revalidatePath(turnosDe(ministerioId));
  redirect(`${destino}?guardado=asignado`);
}

export async function quitarDelTurno(
  ministerioId: string,
  turnoId: string,
  asignacionId: string,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${turnosDe(ministerioId)}/${turnoId}`;

  const turno = await turnoDelMinisterio(ctx, ministerioId, turnoId);
  if (!turno) volver('Ese turno ya no existe.', turnosDe(ministerioId));

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(turnoAsignaciones)
      .where(
        and(
          eq(turnoAsignaciones.id, asignacionId),
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          // El tercer cinturón: la fila tiene que ser de ESTE turno, que ya se
          // comprobó que es de este ministerio.
          eq(turnoAsignaciones.turnoId, turnoId),
        ),
      ),
  );

  revalidatePath(turnosDe(ministerioId));
  redirect(`${destino}?guardado=quitado`);
}

const EsquemaRespuesta = z.enum(['pendiente', 'confirmado', 'no_puede'], {
  error: 'Elige una respuesta.',
});

/**
 * El responsable marca la respuesta de alguien.
 *
 * Existe porque mucha gente del equipo no usa la aplicación: el bajista dice
 * «sí, ahí estaré» en el grupo de WhatsApp, y si nadie pudiera apuntarlo, su
 * puesto se quedaría «sin contestar» todas las semanas. Se marcan todos sus
 * puestos de ese turno a la vez, igual que cuando contesta la propia persona.
 *
 * NO avisa a nadie: quien lo marca es justo quien recibiría el aviso.
 */
export async function marcarRespuesta(
  ministerioId: string,
  turnoId: string,
  miembroId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${turnosDe(ministerioId)}/${turnoId}`;

  const leido = EsquemaRespuesta.safeParse(campoObligatorio(formData, 'respuesta'));
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);

  const turno = await turnoDelMinisterio(ctx, ministerioId, turnoId);
  if (!turno) volver('Ese turno ya no existe.', turnosDe(ministerioId));

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(turnoAsignaciones)
      .set({
        respuesta: leido.data,
        respondidoAt: leido.data === 'pendiente' ? null : new Date(),
      })
      .where(
        and(
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(turnoAsignaciones.turnoId, turnoId),
          eq(turnoAsignaciones.miembroId, miembroId),
        ),
      ),
  );

  revalidatePath(turnosDe(ministerioId));
  redirect(`${destino}?guardado=respuesta`);
}

/**
 * Copia el cuadrante de otro turno del equipo en este.
 *
 * Las rotaciones se parecen mucho de una semana a la siguiente, y rellenar siete
 * puestos a mano cada domingo es justo el trabajo que hace que alguien vuelva a
 * la hoja de cálculo. Solo se copia a quien SIGUE en el equipo —HT122 rechazaría
 * al resto y tumbaría la copia entera— y todo llega como «sin contestar»: haber
 * confirmado el domingo pasado no es haber confirmado este.
 */
export async function copiarTurno(
  ministerioId: string,
  turnoId: string,
  desdeTurnoId: string,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${turnosDe(ministerioId)}/${turnoId}`;

  const [turno, origen] = await Promise.all([
    turnoDelMinisterio(ctx, ministerioId, turnoId),
    turnoDelMinisterio(ctx, ministerioId, desdeTurnoId),
  ]);
  if (!turno || !origen) volver('Ese turno ya no existe.', turnosDe(ministerioId));

  const nuevas = await withUser(ctx.user.id, async (tx) => {
    const equipo = await tx
      .select({ miembroId: ministerioMiembros.miembroId })
      .from(ministerioMiembros)
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
        ),
      );
    const siguen = equipo.map((e) => e.miembroId);
    if (siguen.length === 0) return [];

    const fuente = await tx
      .select({
        miembroId: turnoAsignaciones.miembroId,
        puesto: turnoAsignaciones.puesto,
      })
      .from(turnoAsignaciones)
      .where(
        and(
          eq(turnoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(turnoAsignaciones.turnoId, desdeTurnoId),
          inArray(turnoAsignaciones.miembroId, siguen),
        ),
      );
    if (fuente.length === 0) return [];

    // Quién estaba ya en el turno de destino: a esa persona no se le vuelve a
    // avisar aunque se le sume un puesto.
    const yaEstaban = new Set(
      (
        await tx
          .select({ miembroId: turnoAsignaciones.miembroId })
          .from(turnoAsignaciones)
          .where(eq(turnoAsignaciones.turnoId, turnoId))
      ).map((f) => f.miembroId),
    );

    const insertadas = await tx
      .insert(turnoAsignaciones)
      .values(
        fuente.map((f) => ({
          iglesiaId: ctx.iglesia.id,
          turnoId,
          miembroId: f.miembroId,
          puesto: f.puesto,
          asignadoPorMiembroId: ctx.miembroId,
        })),
      )
      .onConflictDoNothing()
      .returning({
        miembroId: turnoAsignaciones.miembroId,
        puesto: turnoAsignaciones.puesto,
      });

    return insertadas.filter((f) => !yaEstaban.has(f.miembroId));
  });

  if (nuevas.length === 0) {
    volver('No había nadie que copiar: quien estaba ya no sigue en el equipo.', destino);
  }

  const porPersona = new Map<string, string[]>();
  for (const n of nuevas) {
    porPersona.set(n.miembroId, [...(porPersona.get(n.miembroId) ?? []), n.puesto]);
  }
  await avisarAsignados(
    ctx,
    turno,
    [...porPersona.entries()].map(([miembroId, puestos]) => ({ miembroId, puestos })),
  );

  revalidatePath(turnosDe(ministerioId));
  redirect(`${destino}?guardado=copiado`);
}

// ===========================================================================
// Los puestos del equipo
// ===========================================================================

/**
 * Guarda la lista de puestos, uno por línea.
 *
 * Un textarea y no una lista con botones de añadir y quitar: son nombres
 * cortos que se escriben una vez y se tocan poco, y así funciona sin
 * JavaScript, se reordena moviendo líneas y se pega de un mensaje.
 *
 * Leer y escribir en la MISMA transacción, como `editarMinisterio`: la config
 * vive en el mismo jsonb que los interruptores de las herramientas, y con dos
 * `withUser()` seguidos un guardado simultáneo del formulario de editar se
 * perdería entre medias.
 */
export async function guardarPuestos(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const base = turnosDe(ministerioId);

  const lista = limpiarPuestos((campo(formData, 'puestos') ?? '').split(/\r?\n/));
  const error = validarPuestos(lista);
  if (error) volver(error, base);

  await withUser(ctx.user.id, async (tx) => {
    const [actual] = await tx
      .select({ modulos: ministerios.modulos })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1);

    await tx
      .update(ministerios)
      .set({
        modulos: conConfigDeModulo(actual?.modulos, 'turnos', { puestos: lista }),
      })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      );
  });

  revalidatePath(base);
  redirect(`${base}?guardado=puestos#puestos`);
}
