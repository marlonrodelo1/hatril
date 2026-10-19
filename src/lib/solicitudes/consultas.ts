import 'server-only';

import { and, asc, count, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';

import { withUser, dbAdmin } from '@/lib/db';
import { iglesias, miembros, solicitudesIngreso } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { ambitoMiembros } from '@/lib/auth/permisos';
import { normalizarTelefono } from '@/lib/telefono/normalizar';

export type SolicitudPendiente = {
  id: string;
  authUserId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  mensaje: string | null;
  /**
   * La casilla de asistencia tal como la dejó. NULL: se envió antes de que
   * `/solicitar` la preguntara. Viaja a la pantalla porque, con `false`, unir
   * la solicitud con una ficha borra lo que esa ficha tuviera apuntado, y eso
   * hay que saberlo antes de elegir.
   */
  aceptaAsistencia: boolean | null;
  createdAt: Date;
};

export async function listarSolicitudesPendientes(
  ctx: UserContext,
): Promise<SolicitudPendiente[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: solicitudesIngreso.id,
        authUserId: solicitudesIngreso.authUserId,
        nombre: solicitudesIngreso.nombre,
        email: solicitudesIngreso.email,
        telefono: solicitudesIngreso.telefono,
        mensaje: solicitudesIngreso.mensaje,
        aceptaAsistencia: solicitudesIngreso.aceptaAsistencia,
        createdAt: solicitudesIngreso.createdAt,
      })
      .from(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      )
      // Las más antiguas primero: lo que no se quiere es que alguien lleve tres
      // semanas esperando mientras se atienden las de ayer.
      .orderBy(asc(solicitudesIngreso.createdAt)),
  );
}

// ============================================================================
// ¿Ya estaba en el fichero?
// ============================================================================
//
// Quien solicita el ingreso muchas veces ya tiene ficha: el pastor lo apuntó
// hace años, y a lo mejor es colíder de un ministerio. Si aprobar crea otra, la
// persona entra con una ficha vacía —sin sus ministerios, sin sus turnos— y el
// fichero se queda con dos. Esto busca la que ya existe para que quien aprueba
// diga «es esta».

export type MotivoCoincidencia = 'correo' | 'telefono';

export type FichaSugerida = {
  id: string;
  nombre: string;
  motivos: MotivoCoincidencia[];
};

/**
 * El correo tal como se compara: sin espacios y sin mayúsculas.
 *
 * El de la solicitud sale de Supabase Auth; el de la ficha lo tecleó el pastor
 * como le vino. «Ana.Ruiz@Gmail.com » y «ana.ruiz@gmail.com» son la misma
 * bandeja, y `miembros` no tiene único por correo que lo haya impedido.
 */
function claveCorreo(correo: string | null): string | null {
  const limpio = correo?.trim().toLowerCase();
  return limpio && limpio.includes('@') ? limpio : null;
}

/**
 * El teléfono tal como se compara: normalizado con el país de la IGLESIA, y
 * solo los dígitos.
 *
 * Volver a normalizar la solicitud no sobra. `/solicitar` la guarda con 'CO'
 * fijo, así que en una iglesia española «612 345 678» llega como `612345678`
 * —no encaja en la regla colombiana y se queda en dígitos— mientras que la
 * ficha, que se guarda con el país de la iglesia, lo tiene como `+34612345678`.
 *
 * El mínimo de dígitos es porque un teléfono mal apuntado («0», «-») coincide
 * con cualquier otro igual de mal apuntado, y eso no dice nada de que sean la
 * misma persona.
 */
function claveTelefono(telefono: string | null, pais: string): string | null {
  const normalizado = normalizarTelefono(telefono, pais);
  if (!normalizado) return null;
  const digitos = normalizado.replace(/\D/g, '');
  return digitos.length >= 8 ? digitos : null;
}

/**
 * Por qué esta ficha puede ser quien solicita. Vacío: no lo es.
 *
 * La usan las dos mitades —sugerir en la pantalla y enlazar en la action— a
 * propósito. El servidor vuelve a pasarla al aprobar, porque un POST fabricado
 * podría traer el id de cualquier ficha; y si fueran dos copias, la primera que
 * se tocara dejaría la pantalla sugiriendo fichas que luego el servidor
 * rechaza.
 */
export function motivosDeCoincidencia(
  solicitud: { email: string | null; telefono: string | null },
  ficha: { email: string | null; telefono: string | null },
  pais: string,
): MotivoCoincidencia[] {
  const motivos: MotivoCoincidencia[] = [];

  const correo = claveCorreo(solicitud.email);
  if (correo && correo === claveCorreo(ficha.email)) motivos.push('correo');

  const telefono = claveTelefono(solicitud.telefono, pais);
  if (telefono && telefono === claveTelefono(ficha.telefono, pais)) {
    motivos.push('telefono');
  }

  return motivos;
}

/**
 * Qué fichas se pueden enlazar con una cuenta. Compartida con la action por lo
 * mismo que `motivosDeCoincidencia`.
 *
 * - Sin cuenta: si ya tiene una, es de otra persona —o de esta misma por otro
 *   camino—, y enlazarla dejaría a dos cuentas entrando como la misma ficha.
 * - Sin baja: enlazar no puede resucitar a quien se fue. Si vuelve, el pastor
 *   decide si reabre su ficha. Se miran las dos marcas por separado aunque
 *   `darDeBaja` ponga ambas, porque una sola basta para que no deba salir.
 */
export function condicionFichaEnlazable(iglesiaId: string) {
  return and(
    eq(miembros.iglesiaId, iglesiaId),
    isNull(miembros.authUserId),
    isNull(miembros.archivadoAt),
    ne(miembros.estado, 'baja'),
  );
}

/**
 * Las fichas que pueden ser cada solicitud pendiente, por id de solicitud.
 *
 * SUGERIR ES ENSEÑAR FICHAS DEL FICHERO
 * -------------------------------------
 * Por eso solo se calcula para quien ya ve la congregación entera.
 * `aprobar_solicitudes` se puede dar suelto —alguien que recibe a los nuevos—,
 * y a esa persona una sugerencia le enseñaría que «Ana Ruiz, con este teléfono,
 * está en el fichero», que es justo lo que su ámbito no le deja ver. Sin
 * sugerencias, aprobar crea una ficha nueva, como hacía siempre.
 *
 * Una sola consulta para todas las solicitudes, recortada en SQL por correo o
 * teléfono, y el veredicto final en `motivosDeCoincidencia`. El recorte de SQL
 * compara dígitos de lo que ya está guardado: las fichas se escriben siempre
 * normalizadas con el país de la iglesia, así que no hace falta más.
 */
export async function sugerirFichas(
  ctx: UserContext,
  solicitudes: Pick<SolicitudPendiente, 'id' | 'email' | 'telefono'>[],
): Promise<Map<string, FichaSugerida[]>> {
  const sugerencias = new Map<string, FichaSugerida[]>();

  if (ambitoMiembros(ctx).tipo !== 'iglesia') return sugerencias;

  const pais = ctx.iglesia.pais;
  const correos = [
    ...new Set(
      solicitudes
        .map((s) => claveCorreo(s.email))
        .filter((c): c is string => c !== null),
    ),
  ];
  const telefonos = [
    ...new Set(
      solicitudes
        .map((s) => claveTelefono(s.telefono, pais))
        .filter((t): t is string => t !== null),
    ),
  ];

  const porDonde = [
    correos.length > 0
      ? inArray(sql`lower(btrim(${miembros.email}))`, correos)
      : undefined,
    telefonos.length > 0
      ? inArray(
          sql`regexp_replace(${miembros.telefono}, '[^0-9]', '', 'g')`,
          telefonos,
        )
      : undefined,
  ].filter((c) => c !== undefined);

  // Sin nada con lo que comparar no se consulta. No es solo ahorro: un `or()`
  // vacío desaparece del `where`, y la consulta devolvería el fichero entero.
  if (porDonde.length === 0) return sugerencias;

  const candidatas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        email: miembros.email,
        telefono: miembros.telefono,
      })
      .from(miembros)
      .where(and(condicionFichaEnlazable(ctx.iglesia.id), or(...porDonde)))
      .orderBy(asc(miembros.nombre), asc(miembros.apellidos)),
  );

  for (const s of solicitudes) {
    const fichas: FichaSugerida[] = [];

    for (const f of candidatas) {
      const motivos = motivosDeCoincidencia(s, f, pais);
      if (motivos.length === 0) continue;
      // Ni el correo ni el teléfono de la ficha viajan a la pantalla: basta con
      // decir que coinciden con los de la solicitud, que ya están a la vista.
      fichas.push({
        id: f.id,
        nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
        motivos,
      });
    }

    // Primero la que coincide en las dos cosas. Un teléfono compartido —el
    // fijo de una familia— puede traer a varias, y la más probable va arriba.
    fichas.sort((a, b) => b.motivos.length - a.motivos.length);

    if (fichas.length > 0) sugerencias.set(s.id, fichas);
  }

  return sugerencias;
}

/**
 * Cuántas hay sin revisar. Alimenta el contador del menú.
 *
 * Se ejecuta en CADA render del panel, así que es una consulta de un solo
 * número sobre un índice `(iglesia_id, estado)`.
 */
export async function contarSolicitudesPendientes(
  ctx: UserContext,
): Promise<number> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ total: count() })
      .from(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      ),
  );

  return Number(fila?.total ?? 0);
}

/**
 * La solicitud viva de una persona, con el nombre de la iglesia.
 *
 * Para la pantalla de «tu solicitud está en revisión». Va por `dbAdmin` porque
 * quien pregunta todavía no pertenece a ninguna iglesia: con `withUser`, la
 * policy `solicitudes_select_propia` sí la dejaría ver su fila, pero el JOIN
 * con `iglesias` no devolvería nada —`hatril_app` solo ve iglesias a las que
 * pertenece o que están en el directorio—, y la pantalla saldría sin nombre.
 *
 * Se filtra por `auth_user_id`, así que solo devuelve lo suyo.
 */
export async function solicitudDeUsuario(authUserId: string) {
  const filas = await dbAdmin
    .select({
      id: solicitudesIngreso.id,
      estado: solicitudesIngreso.estado,
      motivoRechazo: solicitudesIngreso.motivoRechazo,
      createdAt: solicitudesIngreso.createdAt,
      iglesiaNombre: iglesias.nombre,
      iglesiaSlug: iglesias.slug,
      iglesiaCiudad: iglesias.ciudad,
    })
    .from(solicitudesIngreso)
    .innerJoin(iglesias, eq(iglesias.id, solicitudesIngreso.iglesiaId))
    .where(eq(solicitudesIngreso.authUserId, authUserId))
    .orderBy(asc(solicitudesIngreso.createdAt))
    .limit(1);

  return filas[0] ?? null;
}
