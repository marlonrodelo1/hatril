'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  requireGestionMinisterioAccion,
  requirePermisoAccion,
} from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { seguimientoAsignaciones, seguimientoContactos } from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import {
  resultadoContactoEnum,
  viaContactoEnum,
} from '@/lib/db/schema/seguimiento';
import { campo, campoObligatorio } from '@/lib/api/formulario';

/**
 * El seguimiento de personas.
 *
 * DOS GUARDS EN CADA ACTION, NO UNO
 * ---------------------------------
 * `requirePermisoAccion('ver_seguimiento')` dice que esta persona puede tratar
 * datos de por qué la gente deja de venir. `requireGestionMinisterioAccion` dice
 * que manda en ESTE equipo. Hacen falta los dos: con solo el primero, cualquiera
 * con el permiso escribiría en el seguimiento de un ministerio ajeno mandando su
 * uuid; con solo el segundo, el líder de alabanza apuntaría contactos.
 *
 * El layout de la sección comprueba lo mismo para lo que se PINTA. Esto es para
 * lo que se EJECUTA, que es lo que de verdad hay que proteger: una server action
 * es un endpoint y esconder el botón no protege nada.
 */

const DESTINO = '/panel/ministerios';

const base = (ministerioId: string) => `${DESTINO}/${ministerioId}/seguimiento`;

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

/** Los dos guards, siempre juntos y siempre en este orden. */
async function permiso(ministerioId: string) {
  await requirePermisoAccion('ver_seguimiento', DESTINO);
  return requireGestionMinisterioAccion(ministerioId);
}

const EsquemaContacto = z.object({
  miembroId: z.string().uuid('Falta a quién se contactó.'),
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisa la fecha.'),
  // Los valores salen del propio enum de Drizzle y no del catálogo de pantalla.
  // Así el tipo que sale de Zod ya es `ViaContacto`, sin castings, y añadir un
  // valor al enum lo acepta esta validación sola — mientras que el catálogo de
  // etiquetas NO compila hasta que alguien escriba cómo se llama en castellano,
  // que es justo el orden correcto de fricciones.
  via: z.enum(viaContactoEnum.enumValues),
  resultado: z.enum(resultadoContactoEnum.enumValues),
  // El mismo 200 que el CHECK de la base. Aquí para dar un mensaje en castellano
  // en lugar de un 500 con un error de Postgres detrás.
  proximoPaso: z
    .string()
    .trim()
    .max(200, 'El próximo paso es demasiado largo: dos líneas bastan.')
    .optional()
    .or(z.literal('')),
});

export async function registrarContacto(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await permiso(ministerioId);

  const parsed = EsquemaContacto.safeParse({
    miembroId: campoObligatorio(formData, 'miembroId'),
    fecha: campoObligatorio(formData, 'fecha'),
    via: campoObligatorio(formData, 'via'),
    resultado: campoObligatorio(formData, 'resultado'),
    proximoPaso: campo(formData, 'proximoPaso'),
  });

  if (!parsed.success) {
    volver(parsed.error.issues[0]!.message, base(ministerioId));
  }

  const d = parsed.data;
  const destino = `${base(ministerioId)}/${d.miembroId}`;

  // Sin ficha no se puede firmar, y la policy lo rechazaría con un 500 seco.
  // Es un caso real: una cuenta puede existir sin `miembros` asociado.
  const autor = ctx.miembroId;
  if (!autor) {
    volver(
      'Tu cuenta no tiene ficha de miembro, así que no puede firmar un contacto.',
      destino,
    );
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(seguimientoContactos).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        miembroId: d.miembroId,
        // No sale del formulario: lo pone el servidor y la policy lo vuelve a
        // comprobar contra `miembro_actual()`. Nadie firma con la ficha de otro.
        autorMiembroId: autor,
        fecha: d.fecha,
        via: d.via,
        resultado: d.resultado,
        proximoPaso: d.proximoPaso?.trim() || null,
      }),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT118')) {
      volver('Esa persona no es de tu iglesia.', destino);
    }
    throw err;
  }

  revalidatePath(base(ministerioId));
  redirect(`${destino}?guardado=contacto`);
}

/**
 * Poner o cambiar quién acompaña a una persona.
 *
 * `responsable` vacío quita la asignación en vez de fallar: en la pantalla es un
 * desplegable con «Sin asignar» arriba, y elegir esa opción tiene que significar
 * algo. Se hace con baja lógica —`activo = false`— y no con un DELETE, porque el
 * índice único es parcial y el histórico de quién lo llevó antes es justo lo que
 * se quiere mirar cuando alguien pregunta si esto ya se intentó.
 */
export async function asignarAcompanante(
  ministerioId: string,
  miembroId: string,
  formData: FormData,
) {
  const ctx = await permiso(ministerioId);
  const destino = `${base(ministerioId)}/${miembroId}`;

  const responsable = campo(formData, 'responsable');
  const hoy = campoObligatorio(formData, 'hoy');

  if (responsable && !z.string().uuid().safeParse(responsable).success) {
    volver('Revisa a quién le asignas esta persona.', destino);
  }

  try {
    await withUser(ctx.user.id, async (tx) => {
      await tx
        .update(seguimientoAsignaciones)
        .set({ activo: false })
        .where(
          and(
            eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
            eq(seguimientoAsignaciones.ministerioId, ministerioId),
            eq(seguimientoAsignaciones.miembroId, miembroId),
            eq(seguimientoAsignaciones.activo, true),
          ),
        );

      if (!responsable) return;

      await tx.insert(seguimientoAsignaciones).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        miembroId,
        responsableMiembroId: responsable,
        desde: hoy,
      });
    });
  } catch (err) {
    // HT118 cubre el caso útil: elegir a alguien que ya no está en el equipo.
    if (esGuardHatril(err, 'HT118')) {
      volver(
        'Esa persona ya no está en el equipo de este ministerio.',
        destino,
      );
    }
    if (isUniqueViolation(err)) {
      volver('Esa persona ya tiene a alguien acompañándola.', destino);
    }
    throw err;
  }

  revalidatePath(base(ministerioId));
  redirect(`${destino}?guardado=asignado`);
}

/**
 * Borrar un contacto apuntado por error.
 *
 * Existe porque la tabla NO tiene UPDATE concedido: un contacto es un hecho
 * fechado y reescribirlo dejaría una mentira con fecha. Si se apuntó mal, deja
 * de existir. Y hace falta además para el derecho de supresión.
 */
export async function borrarContacto(
  ministerioId: string,
  miembroId: string,
  contactoId: string,
) {
  const ctx = await permiso(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(seguimientoContactos)
      .where(
        and(
          eq(seguimientoContactos.id, contactoId),
          eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
          eq(seguimientoContactos.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(base(ministerioId));
  redirect(`${base(ministerioId)}/${miembroId}?guardado=borrado`);
}
