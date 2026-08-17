'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePastorAccion } from '@/lib/auth/guard-panel';
import {
  excepcionesSobreDefecto,
  ROLES_IGLESIA,
  type Permiso,
} from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import { iglesiaUsuarios } from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { campoObligatorio, casilla } from '@/lib/api/formulario';

/**
 * Repartir el gobierno de la iglesia.
 *
 * Todo esto es `requirePastorAccion` y no un permiso, y no es una decisión de
 * esta pantalla: la policy `iglesia_usuarios_update_pastor` de la migración
 * `0001` dice exactamente lo mismo en SQL. Que la aplicación y la base de datos
 * coincidan es lo que hace que un descuido aquí arriba no pueda conceder nada
 * que la base no conceda ya.
 *
 * Y por debajo está el trigger `guard_iglesia_usuarios` (HT101): nadie cambia su
 * propio rol, estado ni permisos, ni siquiera el pastor. Se comprueba tres
 * veces —la pantalla no pinta el control, la action lo rechaza, y el trigger lo
 * aborta— porque una server action es un endpoint y la pantalla es solo la
 * primera puerta.
 */

const DESTINO = '/panel/lideres';

function volver(mensaje: string): never {
  redirect(`${DESTINO}?error=` + encodeURIComponent(mensaje));
}

const EsquemaRol = z.object({ rol: z.enum(ROLES_IGLESIA) });

/**
 * Carga la fila y comprueba que sea de esta iglesia y que no sea la propia.
 *
 * El `eq(iglesiaId)` es redundante con la RLS y se pone igual: si algún día esta
 * consulta acabara ejecutándose con `dbAdmin` por error, el id de otra
 * congregación seguiría sin encontrar nada.
 */
async function filaDelEquipo(
  ctx: Awaited<ReturnType<typeof requirePastorAccion>>,
  iglesiaUsuarioId: string,
) {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        rol: iglesiaUsuarios.rol,
        authUserId: iglesiaUsuarios.authUserId,
      })
      .from(iglesiaUsuarios)
      .where(
        and(
          eq(iglesiaUsuarios.id, iglesiaUsuarioId),
          eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  const fila = filas[0];
  if (!fila) volver('Esa persona ya no está en tu iglesia.');

  if (fila.authUserId === ctx.user.id) {
    volver(
      'Tu propio rol y tus permisos no se cambian desde aquí. Nombra pastor a otra persona y que sea ella quien te cambie a ti.',
    );
  }

  return fila;
}

export async function cambiarRol(
  iglesiaUsuarioId: string,
  formData: FormData,
) {
  const ctx = await requirePastorAccion(DESTINO);
  await filaDelEquipo(ctx, iglesiaUsuarioId);

  const parsed = EsquemaRol.safeParse({ rol: campoObligatorio(formData, 'rol') });
  if (!parsed.success) volver('Ese rol no existe.');

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(iglesiaUsuarios)
        // Los permisos se vacían al cambiar de rol, y esto es deliberado.
        //
        // El jsonb guarda EXCEPCIONES a los defectos del rol. Una excepción
        // heredada del rol anterior significa otra cosa bajo el nuevo: «no
        // aprueba solicitudes» es una restricción real para una secretaría y
        // ruido para un miembro. Arrastrarlas produce combinaciones que el
        // pastor nunca eligió y que además no se ven en pantalla.
        .set({ rol: parsed.data.rol, permisos: {} })
        .where(
          and(
            eq(iglesiaUsuarios.id, iglesiaUsuarioId),
            eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          ),
        ),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT101')) {
      volver('No puedes cambiar tu propio rol.');
    }
    throw err;
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=rol`);
}

export async function guardarPermisos(
  iglesiaUsuarioId: string,
  formData: FormData,
) {
  const ctx = await requirePastorAccion(DESTINO);

  try {
    await withUser(ctx.user.id, async (tx) => {
      // El rol se lee de la BASE DE DATOS, no de un campo oculto del formulario.
      //
      // `excepcionesSobreDefecto` compara contra los defectos del rol, así que
      // necesita el rol correcto. Una pestaña abierta desde ayer traería el rol
      // de ayer y guardaría excepciones calculadas contra unos defectos que ya
      // no son los suyos: el pastor creería estar delegando y estaría cerrando.
      const filas = await tx
        .select({
          rol: iglesiaUsuarios.rol,
          authUserId: iglesiaUsuarios.authUserId,
        })
        .from(iglesiaUsuarios)
        .where(
          and(
            eq(iglesiaUsuarios.id, iglesiaUsuarioId),
            eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          ),
        )
        .limit(1);

      const fila = filas[0];
      if (!fila) volver('Esa persona ya no está en tu iglesia.');
      if (fila.authUserId === ctx.user.id) {
        volver('Tus propios permisos no se cambian desde aquí.');
      }

      const excepciones = excepcionesSobreDefecto(fila.rol, (permiso: Permiso) =>
        casilla(formData, permiso),
      );

      await tx
        .update(iglesiaUsuarios)
        .set({ permisos: excepciones })
        .where(
          and(
            eq(iglesiaUsuarios.id, iglesiaUsuarioId),
            eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          ),
        );
    });
  } catch (err) {
    if (esGuardHatril(err, 'HT101')) {
      volver('No puedes cambiar tus propios permisos.');
    }
    throw err;
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=permisos`);
}

/**
 * Quitar el acceso a la aplicación.
 *
 * `estado = 'baja'` y no un DELETE. Corta el acceso de inmediato —las policies
 * exigen `activo`, así que en el siguiente clic esta persona ya no ve nada— y
 * conserva el rastro de que estuvo.
 *
 * Es distinto de rechazar una solicitud, que sí borra la fila: allí la persona
 * nunca llegó a pertenecer a la iglesia.
 *
 * La FICHA DE MIEMBRO NO SE TOCA. Quitar el acceso a la aplicación y dar de baja
 * a alguien de la congregación son dos actos distintos, y confundirlos haría que
 * revocar una contraseña borrase a una persona del fichero de su iglesia.
 */
export async function quitarAcceso(iglesiaUsuarioId: string) {
  await cambiarEstado(iglesiaUsuarioId, 'baja', 'quitado');
}

/**
 * Devolver el acceso.
 *
 * No es un lujo, es obligatorio: el unique `(iglesia_id, auth_user_id)` impide
 * que quien tiene fila vuelva a solicitar el ingreso desde el directorio. Sin
 * este botón, alguien dado de baja por error se queda sin ninguna puerta —el
 * formulario de solicitud choca contra el índice y `/mi` no sabe explicarle qué
 * le pasa.
 */
export async function devolverAcceso(iglesiaUsuarioId: string) {
  await cambiarEstado(iglesiaUsuarioId, 'activo', 'devuelto');
}

async function cambiarEstado(
  iglesiaUsuarioId: string,
  estado: 'activo' | 'baja',
  confirmacion: string,
) {
  const ctx = await requirePastorAccion(DESTINO);
  const fila = await filaDelEquipo(ctx, iglesiaUsuarioId);

  // Una iglesia sin pastor no la puede arreglar nadie desde dentro: al siguiente
  // clic no queda un solo `es_pastor()` que devuelva true y la pantalla de Equipo
  // deja de ser accesible para todos. Antes hay que cambiarle el rol.
  if (fila.rol === 'pastor' && estado === 'baja') {
    volver(
      'No puedes quitarle el acceso a un pastor. Cámbiale antes el rol a otra cosa.',
    );
  }

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(iglesiaUsuarios)
        .set({ estado })
        .where(
          and(
            eq(iglesiaUsuarios.id, iglesiaUsuarioId),
            eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          ),
        ),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT101')) {
      volver('No puedes quitarte el acceso a ti mismo.');
    }
    throw err;
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=${confirmacion}`);
}
