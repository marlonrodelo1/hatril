import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { iglesiaUsuarios, miembros } from '@/lib/db/schema';
import {
  resolverPermisos,
  type MapaPermisos,
  type RolIglesia,
} from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import { lideresDeMinisterios } from '@/lib/ministerios/consultas';

/**
 * Quién tiene cuenta en esta iglesia y qué puede hacer.
 *
 * Va por `withUser` como todo lo demás: la policy `iglesia_usuarios_select_equipo`
 * ya deja a cualquier miembro activo ver el equipo de SU congregación, así que no
 * hay ninguna razón para abrir la puerta de servicio.
 *
 * EL CORREO SALE DE `miembros`, NO DE `auth.users`
 * ------------------------------------------------
 * Es tentador sacarlo de la cuenta de Supabase, que es donde está el bueno. Pero
 * el esquema `auth` no tiene grants para `hatril_app`, así que habría que usar
 * `dbAdmin` — abrir la puerta de servicio para pintar una columna de una lista.
 * A cambio, una cuenta sin ficha aparece sin correo, y eso se dice en pantalla.
 */

export type FilaEquipo = {
  iglesiaUsuarioId: string;
  authUserId: string;
  /**
   * Su ficha de miembro, para poder saltar a ella desde aquí.
   *
   * Puede ser `null`: una cuenta aprobada sin ficha todavía es un estado real.
   * Cuando lo es, la tarjeta no ofrece el enlace en lugar de llevar a un 404.
   */
  miembroId: string | null;
  nombre: string;
  email: string | null;
  rol: RolIglesia;
  permisos: MapaPermisos;
  /** Solo 'activo' o 'baja': los 'pendiente' viven en `/panel/solicitudes`. */
  estado: 'activo' | 'baja';
  /** Para no ofrecerle a nadie controles sobre sí mismo. Ver el trigger HT101. */
  esTuCuenta: boolean;
  /** Ministerios donde es responsable o colíder. */
  lidera: { id: string; nombre: string }[];
};

export async function listarEquipo(ctx: UserContext): Promise<FilaEquipo[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: iglesiaUsuarios.id,
        authUserId: iglesiaUsuarios.authUserId,
        rol: iglesiaUsuarios.rol,
        permisos: iglesiaUsuarios.permisos,
        estado: iglesiaUsuarios.estado,
        miembroId: iglesiaUsuarios.miembroId,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        email: miembros.email,
      })
      .from(iglesiaUsuarios)
      // LEFT y no INNER: una cuenta puede no tener ficha todavía. Con INNER
      // desaparecería de esta pantalla justo la persona a la que hay que
      // configurar, y el pastor no entendería por qué no la ve.
      .leftJoin(miembros, eq(miembros.id, iglesiaUsuarios.miembroId))
      .where(
        and(
          eq(iglesiaUsuarios.iglesiaId, ctx.iglesia.id),
          inArray(iglesiaUsuarios.estado, ['activo', 'baja']),
        ),
      )
      .orderBy(asc(miembros.nombre)),
  );

  const miembroIds = filas
    .map((f) => f.miembroId)
    .filter((id): id is string => id !== null);

  const lideraPorMiembro = await lideresDeMinisterios(ctx, miembroIds);

  return filas
    .map((f) => ({
      iglesiaUsuarioId: f.id,
      authUserId: f.authUserId,
      miembroId: f.miembroId,
      nombre:
        [f.nombre, f.apellidos].filter(Boolean).join(' ') || 'Cuenta sin ficha',
      email: f.email,
      rol: f.rol,
      // Se resuelve aquí y no en la pantalla: lo que el pastor tiene que ver
      // marcado es el permiso EFECTIVO, no las excepciones crudas del jsonb.
      permisos: resolverPermisos(f.rol, f.permisos),
      estado: f.estado as 'activo' | 'baja',
      esTuCuenta: f.authUserId === ctx.user.id,
      lidera: f.miembroId ? (lideraPorMiembro.get(f.miembroId) ?? []) : [],
    }))
    // El pastor primero: es quien manda y quien está mirando la pantalla. Dentro
    // de cada grupo se conserva el orden por nombre que trajo la consulta.
    .sort((a, b) => Number(b.rol === 'pastor') - Number(a.rol === 'pastor'));
}
