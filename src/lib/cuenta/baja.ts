import 'server-only';

import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import {
  adminUsers,
  bajasCuenta,
  bloqueosComunidad,
  denunciasComunidad,
  iglesiaUsuarios,
  iglesias,
  miembros,
  ministerios,
  notificaciones,
  publicaciones,
  publicacionesComentarios,
  publicacionesComentariosMeGusta,
  publicacionesMeGusta,
  solicitudesIngreso,
  turnoAsignaciones,
  turnos,
} from '@/lib/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { borrarImagenes } from '@/lib/comunidad/imagenes';
import { cuandoEs } from '@/lib/turnos/fecha';
import {
  cuentasQueLlevanElMinisterio,
  emitirNotificaciones,
} from '@/lib/notificaciones/emitir';

/**
 * Borrar una cuenta: pedirlo, arrepentirse y hacerlo de verdad.
 *
 * POR QUÉ `dbAdmin`
 * -----------------
 * Es la baja de una CUENTA, no algo dentro de una iglesia: una cuenta puede
 * estar en varias, la tabla `bajas_cuenta` es de la plataforma, y el borrado
 * final lo hace un cron sin sesión. Es la misma excepción que el alta de una
 * iglesia, al otro extremo de la vida de una cuenta, y está apuntada en la
 * lista de CLAUDE.md. Todo lo de aquí filtra por la cuenta que lo pide; nada
 * viene del formulario salvo la contraseña, que no se guarda.
 *
 * Lo que se borra y lo que no está contado en `bajas_cuenta`
 * (`db/schema/plataforma.ts`).
 */

export const PLAZO_BAJA_DIAS = 30;

export type BajaPendiente = { borrarDesde: Date };

/** El día en que se borraría la cuenta si se pidiera ahora. */
export function fechaDeBorradoSiSePideHoy(): Date {
  return new Date(Date.now() + PLAZO_BAJA_DIAS * 24 * 60 * 60 * 1000);
}

/** La baja de esta cuenta, si la pidió y aún no se ha completado. */
export async function bajaPendiente(
  authUserId: string,
): Promise<BajaPendiente | null> {
  const [fila] = await dbAdmin
    .select({ borrarDesde: bajasCuenta.borrarDesde })
    .from(bajasCuenta)
    .where(
      and(eq(bajasCuenta.authUserId, authUserId), isNull(bajasCuenta.completadaAt)),
    )
    .limit(1);
  return fila ?? null;
}

/**
 * Por qué esta cuenta no se puede borrar todavía, o `null` si se puede.
 *
 * El pastor no, mientras lo sea: su iglesia se quedaría sin nadie que la
 * lleve, y la ficha de cada miembro con ella. Primero deja a otra persona de
 * pastor. Y el super admin tampoco: se quita a mano de `admin_users`, que es
 * una decisión de la plataforma y no un botón.
 */
export async function porQueNoSePuedeBorrar(
  authUserId: string,
): Promise<string | null> {
  const [admin] = await dbAdmin
    .select({ id: adminUsers.authUserId })
    .from(adminUsers)
    .where(eq(adminUsers.authUserId, authUserId))
    .limit(1);
  if (admin) {
    return 'Esta cuenta es de administración de Hatril y no se borra desde aquí.';
  }

  const pastorados = await dbAdmin
    .select({ nombre: iglesias.nombre })
    .from(iglesiaUsuarios)
    .innerJoin(iglesias, eq(iglesias.id, iglesiaUsuarios.iglesiaId))
    .where(
      and(
        eq(iglesiaUsuarios.authUserId, authUserId),
        eq(iglesiaUsuarios.estado, 'activo'),
        eq(iglesiaUsuarios.rol, 'pastor'),
      ),
    );
  if (pastorados.length > 0) {
    return `Eres el pastor de ${pastorados.map((p) => p.nombre).join(' y de ')}. Antes de borrar tu cuenta, nombra pastor a otra persona desde el panel, en Líderes, y que sea ella quien te cambie a ti.`;
  }

  return null;
}

/**
 * Pedir la baja. Desactiva al momento y deja el borrado para dentro de treinta
 * días.
 *
 * Desactivar es pasar sus membresías a `baja`: la RLS (`pertenece_a_iglesia()`
 * exige `activo`) deja de abrirle nada, en todas sus iglesias a la vez. Y sus
 * turnos pendientes pasan a «no puede», con el mismo aviso que si lo hubiera
 * dicho él: quien lleva el equipo se entera ahora y no el domingo.
 */
export async function pedirBajaDeCuenta(authUserId: string): Promise<{ borrarDesde: Date }> {
  const borrarDesde = fechaDeBorradoSiSePideHoy();

  const activas = await dbAdmin
    .select({
      id: iglesiaUsuarios.id,
      iglesiaId: iglesiaUsuarios.iglesiaId,
      miembroId: iglesiaUsuarios.miembroId,
    })
    .from(iglesiaUsuarios)
    .where(
      and(
        eq(iglesiaUsuarios.authUserId, authUserId),
        eq(iglesiaUsuarios.estado, 'activo'),
      ),
    );

  const fichas = activas.flatMap((a) =>
    a.miembroId ? [{ iglesiaId: a.iglesiaId, miembroId: a.miembroId }] : [],
  );

  const hoy = new Date().toISOString().slice(0, 10);

  const turnosSoltados = await dbAdmin.transaction(async (tx) => {
    await tx
      .insert(bajasCuenta)
      .values({
        authUserId,
        borrarDesde,
        membresias: activas.map((a) => a.id),
      })
      // Si ya la había pedido —dos toques, o una pestaña vieja— se queda la
      // primera fecha: pedirla otra vez no alarga el plazo.
      .onConflictDoNothing();

    if (activas.length > 0) {
      await tx
        .update(iglesiaUsuarios)
        .set({ estado: 'baja' })
        .where(inArray(iglesiaUsuarios.id, activas.map((a) => a.id)));
    }

    if (fichas.length === 0) return [];

    return tx
      .update(turnoAsignaciones)
      .set({ respuesta: 'no_puede', respondidoAt: new Date() })
      .where(
        and(
          inArray(turnoAsignaciones.miembroId, fichas.map((f) => f.miembroId)),
          inArray(turnoAsignaciones.respuesta, ['pendiente', 'confirmado']),
          // Solo lo que está por venir: los turnos pasados son historia del
          // equipo, y reescribirlos diría que faltó a algo a lo que fue.
          sql`${turnoAsignaciones.turnoId} in (select id from turnos where fecha >= ${hoy})`,
        ),
      )
      .returning({
        turnoId: turnoAsignaciones.turnoId,
        iglesiaId: turnoAsignaciones.iglesiaId,
        miembroId: turnoAsignaciones.miembroId,
      });
  });

  await avisarDeTurnosSoltados(turnosSoltados);

  return { borrarDesde };
}

/** Un aviso por turno a quien lleva el equipo, como el «no puedo» de siempre. */
async function avisarDeTurnosSoltados(
  soltados: { turnoId: string; iglesiaId: string; miembroId: string }[],
) {
  const porTurno = [...new Map(soltados.map((s) => [s.turnoId, s])).values()];
  if (porTurno.length === 0) return;

  const datos = await dbAdmin
    .select({
      turnoId: turnos.id,
      fecha: turnos.fecha,
      hora: turnos.hora,
      ministerioId: turnos.ministerioId,
      ministerio: ministerios.nombre,
    })
    .from(turnos)
    .innerJoin(ministerios, eq(ministerios.id, turnos.ministerioId))
    .where(inArray(turnos.id, porTurno.map((t) => t.turnoId)));

  const nombres = await dbAdmin
    .select({ id: miembros.id, nombre: miembros.nombre, apellidos: miembros.apellidos })
    .from(miembros)
    .where(inArray(miembros.id, porTurno.map((t) => t.miembroId)));

  for (const t of porTurno) {
    const d = datos.find((x) => x.turnoId === t.turnoId);
    if (!d) continue;
    const yo = nombres.find((n) => n.id === t.miembroId);
    const cuentas = await cuentasQueLlevanElMinisterio(t.iglesiaId, d.ministerioId);

    await emitirNotificaciones(
      cuentas.map((cuenta) => ({
        iglesiaId: t.iglesiaId,
        destinatarioAuthUserId: cuenta,
        tipo: 'turno_no_puede' as const,
        datos: {
          quien: [yo?.nombre, yo?.apellidos].filter(Boolean).join(' ') || 'Alguien',
          ministerio: d.ministerio,
          fecha: cuandoEs(d.fecha, d.hora ? d.hora.slice(0, 5) : null),
        },
        enlace: `/panel/ministerios/${d.ministerioId}/turnos/${t.turnoId}`,
      })),
    );
  }
}

/**
 * Arrepentirse: vuelven las membresías que estaban activas al pedirla, y nada
 * más. Si mientras tanto el pastor dio a alguna de baja de verdad, esa se queda
 * como está. Los turnos no vuelven solos: ya se avisó a quien lleva el equipo,
 * y puede que lo haya cubierto otra persona.
 */
export async function recuperarCuenta(authUserId: string): Promise<boolean> {
  return dbAdmin.transaction(async (tx) => {
    const [fila] = await tx
      .select({ membresias: bajasCuenta.membresias })
      .from(bajasCuenta)
      .where(
        and(eq(bajasCuenta.authUserId, authUserId), isNull(bajasCuenta.completadaAt)),
      )
      .limit(1);
    if (!fila) return false;

    if (fila.membresias.length > 0) {
      await tx
        .update(iglesiaUsuarios)
        .set({ estado: 'activo' })
        .where(
          and(
            inArray(iglesiaUsuarios.id, fila.membresias),
            eq(iglesiaUsuarios.authUserId, authUserId),
            eq(iglesiaUsuarios.estado, 'baja'),
          ),
        );
    }

    await tx.delete(bajasCuenta).where(eq(bajasCuenta.authUserId, authUserId));
    return true;
  });
}

/**
 * Las bajas a las que ya les ha llegado el día. Las llama el cron.
 *
 * Una a una y cada una en su `try`: si una falla —Supabase Auth no responde,
 * por ejemplo—, se queda sin `completada_at` y el cron de mañana la vuelve a
 * intentar, sin llevarse por delante a las demás.
 */
export async function completarBajasVencidas(): Promise<{
  hechas: number;
  fallidas: number;
}> {
  const vencidas = await dbAdmin
    .select({ authUserId: bajasCuenta.authUserId })
    .from(bajasCuenta)
    .where(
      and(isNull(bajasCuenta.completadaAt), lte(bajasCuenta.borrarDesde, new Date())),
    );

  let hechas = 0;
  let fallidas = 0;
  for (const v of vencidas) {
    try {
      await borrarCuentaDeVerdad(v.authUserId);
      hechas++;
    } catch (err) {
      fallidas++;
      console.error('[bajas] no se pudo completar', { authUserId: v.authUserId, err });
    }
  }
  return { hechas, fallidas };
}

async function borrarCuentaDeVerdad(authUserId: string) {
  const membresias = await dbAdmin
    .select({ miembroId: iglesiaUsuarios.miembroId })
    .from(iglesiaUsuarios)
    .where(eq(iglesiaUsuarios.authUserId, authUserId));

  // Las fichas enlazadas por cualquiera de los dos lados: la membresía apunta a
  // la ficha (`miembro_id`) y la ficha a la cuenta (`auth_user_id`).
  const enlazadas = await dbAdmin
    .select({ id: miembros.id })
    .from(miembros)
    .where(eq(miembros.authUserId, authUserId));

  const fichas = [
    ...new Set([
      ...membresias.flatMap((m) => (m.miembroId ? [m.miembroId] : [])),
      ...enlazadas.map((m) => m.id),
    ]),
  ];

  const fotosDelMuro = await dbAdmin.transaction(async (tx) => {
    let fotos: string[] = [];

    if (fichas.length > 0) {
      const suyas = await tx
        .select({ imagenes: publicaciones.imagenes })
        .from(publicaciones)
        .where(inArray(publicaciones.autorMiembroId, fichas));
      fotos = suyas.flatMap((p) => p.imagenes ?? []);

      // Lo suyo en el muro. Los comentarios de otros en sus publicaciones se van
      // con ellas por la clave ajena.
      await tx.delete(publicaciones).where(inArray(publicaciones.autorMiembroId, fichas));
      await tx
        .delete(publicacionesComentarios)
        .where(inArray(publicacionesComentarios.autorMiembroId, fichas));
      await tx
        .delete(publicacionesMeGusta)
        .where(inArray(publicacionesMeGusta.miembroId, fichas));
      await tx
        .delete(publicacionesComentariosMeGusta)
        .where(inArray(publicacionesComentariosMeGusta.miembroId, fichas));
      await tx
        .delete(denunciasComunidad)
        .where(inArray(denunciasComunidad.denuncianteMiembroId, fichas));
      await tx
        .delete(bloqueosComunidad)
        .where(
          or(
            inArray(bloqueosComunidad.bloqueadorMiembroId, fichas),
            inArray(bloqueosComunidad.bloqueadoMiembroId, fichas),
          ),
        );

      // La ficha se queda en su iglesia, sin cuenta y sin foto. La foto subida
      // vive en el bucket privado como ruta; las URL viejas de la demo, no.
      const caras = await tx
        .select({ foto: miembros.fotoUrl })
        .from(miembros)
        .where(inArray(miembros.id, fichas));
      fotos.push(
        ...caras.flatMap((c) => (c.foto && !/^https?:\/\//i.test(c.foto) ? [c.foto] : [])),
      );

      await tx
        .update(miembros)
        .set({ authUserId: null, fotoUrl: null })
        .where(inArray(miembros.id, fichas));
    }

    await tx.delete(iglesiaUsuarios).where(eq(iglesiaUsuarios.authUserId, authUserId));
    await tx.delete(solicitudesIngreso).where(eq(solicitudesIngreso.authUserId, authUserId));
    await tx
      .delete(notificaciones)
      .where(eq(notificaciones.destinatarioAuthUserId, authUserId));

    await tx
      .update(bajasCuenta)
      .set({ completadaAt: new Date(), membresias: [] })
      .where(eq(bajasCuenta.authUserId, authUserId));

    return fotos;
  });

  // Después de la base, como al borrar una publicación: si Storage falla quedan
  // unos ficheros huérfanos en un bucket privado, no una cuenta a medias. Van
  // juntas las del muro y la de perfil: las dos viven en el mismo bucket.
  await borrarImagenes(fotosDelMuro);

  // Lo último, y fuera de la transacción porque es otro servicio. Si falla, la
  // excepción sube, `completarBajasVencidas` la apunta, y la fila ya marcada
  // como completada no se reintenta: por eso se deshace la marca.
  const { error } = await createAdminClient().auth.admin.deleteUser(authUserId);
  if (error && !/not.?found/i.test(error.message)) {
    await dbAdmin
      .update(bajasCuenta)
      .set({ completadaAt: null })
      .where(eq(bajasCuenta.authUserId, authUserId));
    throw error;
  }
}

/** Para el aviso de la pantalla: cuántos turnos por venir tiene esta cuenta. */
export async function turnosPorVenir(authUserId: string): Promise<number> {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fila] = await dbAdmin
    .select({ n: sql<number>`count(distinct ${turnoAsignaciones.turnoId})::int` })
    .from(turnoAsignaciones)
    .innerJoin(turnos, eq(turnos.id, turnoAsignaciones.turnoId))
    .innerJoin(
      iglesiaUsuarios,
      and(
        eq(iglesiaUsuarios.miembroId, turnoAsignaciones.miembroId),
        eq(iglesiaUsuarios.authUserId, authUserId),
      ),
    )
    .where(
      and(
        gte(turnos.fecha, hoy),
        inArray(turnoAsignaciones.respuesta, ['pendiente', 'confirmado']),
      ),
    );
  return fila?.n ?? 0;
}
