import 'server-only';

import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

// `dbAdmin`, y es de los pocos sitios donde toca: el super admin mira TODAS las
// iglesias, y no hay policy que deba dejar eso a un rol de aplicación. La
// contrapartida es que aquí no hay RLS debajo: lo único que separa estas
// consultas de internet es `requireSuperAdmin()` en cada página de `/admin`.
import { dbAdmin } from '@/lib/db';
import {
  adminUsers,
  iglesias,
  iglesiaUsuarios,
  miembros,
  ministerios,
  solicitudesIngreso,
} from '@/lib/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import type { RolIglesia } from '@/lib/auth/permisos';
import {
  leerEstadoSuscripcion,
  type EstadoSuscripcion,
} from '@/lib/suscripcion/estado';

/**
 * Lo que consulta el panel de super admin.
 *
 * QUÉ NO SALE DE AQUÍ, Y ES A PROPÓSITO
 * -------------------------------------
 * Ninguna ficha de miembro. Rogotech trata los datos de cada congregación por
 * encargo suyo (`/terminos`, anexo del art. 28): para operar la plataforma
 * bastan los recuentos. Una lista de nombres de una iglesia en esta pantalla
 * sería un tratamiento de datos del art. 9 sin instrucción de nadie. Las
 * cuentas sí salen —correo y a qué iglesia pertenecen—, porque sin eso no se
 * puede atender a quien escribe diciendo «no puedo entrar».
 */

// ============================================================================
// La situación de una iglesia, contada para quien administra
// ============================================================================

export type Tono = 'exito' | 'aviso' | 'marca' | 'neutro' | 'peligro';

/**
 * Los grupos del filtro del listado. No son las cinco situaciones de
 * `leerEstadoSuscripcion` una a una: al operar la pregunta es «quién paga,
 * quién prueba y a quién hay que llamar», y `termina` es de las de llamar.
 */
export const FILTROS_SITUACION = {
  prueba: 'En prueba',
  pagan: 'Pagan',
  vencidas: 'Vencidas',
  suspendidas: 'Suspendidas',
} as const;

export type FiltroSituacion = keyof typeof FILTROS_SITUACION;

export type Situacion = {
  etiqueta: string;
  tono: Tono;
  grupo: FiltroSituacion;
};

const NOMBRE_PLAN: Record<string, string> = {
  esencial: 'Esencial',
  comunidad: 'Comunidad',
  plus: 'Plus',
};

/**
 * `activa = false` va por delante de todo: es la única palanca que apaga una
 * iglesia entera —`getCurrentUserContext` y la web pública filtran por ella—,
 * y una suspendida que además está «en prueba» no está en prueba de nada.
 */
export function situacionDe(
  iglesia: { activa: boolean; plan: string; trialUntil: Date | null },
  ahora: Date = new Date(),
): Situacion {
  if (!iglesia.activa) {
    return { etiqueta: 'Suspendida', tono: 'peligro', grupo: 'suspendidas' };
  }
  return situacionDeSuscripcion(leerEstadoSuscripcion(iglesia, ahora));
}

function situacionDeSuscripcion(estado: EstadoSuscripcion): Situacion {
  switch (estado.situacion) {
    case 'activa':
      return {
        etiqueta: `Paga · ${NOMBRE_PLAN[estado.plan] ?? estado.plan}`,
        tono: 'exito',
        grupo: 'pagan',
      };
    case 'prueba':
      return {
        etiqueta:
          estado.diasRestantes === 1
            ? 'Prueba · 1 día'
            : `Prueba · ${estado.diasRestantes} días`,
        tono: estado.diasRestantes <= 7 ? 'aviso' : 'marca',
        grupo: 'prueba',
      };
    case 'termina':
      return {
        etiqueta: `Canceló · ${estado.diasRestantes} d`,
        tono: 'aviso',
        grupo: 'vencidas',
      };
    case 'solo_lectura':
      return { etiqueta: 'Vencida · solo lectura', tono: 'aviso', grupo: 'vencidas' };
    case 'bloqueada':
      return { etiqueta: 'Bloqueada', tono: 'peligro', grupo: 'vencidas' };
  }
}

// ============================================================================
// Iglesias
// ============================================================================

export type FilaIglesia = {
  id: string;
  nombre: string;
  slug: string;
  ciudad: string | null;
  pais: string;
  plan: string;
  trialUntil: Date | null;
  activa: boolean;
  webPublica: boolean;
  createdAt: Date;
  personas: number;
  cuentas: number;
  situacion: Situacion;
};

/**
 * Todas las iglesias con sus dos recuentos.
 *
 * Sin paginar ni filtrar en la base, y es una decisión de escala, no un
 * descuido: hoy son tres, y con unos cientos esto sigue siendo una consulta de
 * milisegundos. La situación se calcula en JavaScript con la MISMA función que
 * decide el muro de pago; filtrarla en SQL obligaría a copiar esa lógica en
 * otro idioma, y las dos acabarían discrepando. Cuando haya miles, paginar.
 */
export async function listarIglesias(): Promise<FilaIglesia[]> {
  const [filas, personas, cuentas] = await Promise.all([
    dbAdmin
      .select({
        id: iglesias.id,
        nombre: iglesias.nombre,
        slug: iglesias.slug,
        ciudad: iglesias.ciudad,
        pais: iglesias.pais,
        plan: iglesias.plan,
        trialUntil: iglesias.trialUntil,
        activa: iglesias.activa,
        webPublica: iglesias.webPublica,
        createdAt: iglesias.createdAt,
      })
      .from(iglesias)
      .orderBy(desc(iglesias.createdAt)),
    dbAdmin
      .select({ iglesiaId: miembros.iglesiaId, n: count() })
      .from(miembros)
      .where(isNull(miembros.archivadoAt))
      .groupBy(miembros.iglesiaId),
    dbAdmin
      .select({ iglesiaId: iglesiaUsuarios.iglesiaId, n: count() })
      .from(iglesiaUsuarios)
      .where(eq(iglesiaUsuarios.estado, 'activo'))
      .groupBy(iglesiaUsuarios.iglesiaId),
  ]);

  const personasPor = new Map(personas.map((p) => [p.iglesiaId, p.n]));
  const cuentasPor = new Map(cuentas.map((c) => [c.iglesiaId, c.n]));
  const ahora = new Date();

  return filas.map((f) => ({
    ...f,
    personas: personasPor.get(f.id) ?? 0,
    cuentas: cuentasPor.get(f.id) ?? 0,
    situacion: situacionDe(f, ahora),
  }));
}

export type FichaIglesia = {
  iglesia: typeof iglesias.$inferSelect;
  situacion: Situacion;
  personas: number;
  ministeriosActivos: number;
  cuentas: number;
  solicitudesPendientes: number;
  /** Con quién se habla: las cuentas con rol de pastor, y su correo. */
  pastores: { authUserId: string; nombre: string; email: string | null }[];
};

export async function fichaIglesia(id: string): Promise<FichaIglesia | null> {
  const [iglesia] = await dbAdmin
    .select()
    .from(iglesias)
    .where(eq(iglesias.id, id))
    .limit(1);
  if (!iglesia) return null;

  const [[personas], [ministeriosActivos], [cuentas], [solicitudes], pastores] =
    await Promise.all([
      dbAdmin
        .select({ n: count() })
        .from(miembros)
        .where(and(eq(miembros.iglesiaId, id), isNull(miembros.archivadoAt))),
      dbAdmin
        .select({ n: count() })
        .from(ministerios)
        .where(and(eq(ministerios.iglesiaId, id), eq(ministerios.activo, true))),
      dbAdmin
        .select({ n: count() })
        .from(iglesiaUsuarios)
        .where(
          and(
            eq(iglesiaUsuarios.iglesiaId, id),
            eq(iglesiaUsuarios.estado, 'activo'),
          ),
        ),
      dbAdmin
        .select({ n: count() })
        .from(solicitudesIngreso)
        .where(
          and(
            eq(solicitudesIngreso.iglesiaId, id),
            eq(solicitudesIngreso.estado, 'pendiente'),
          ),
        ),
      dbAdmin
        .select({ authUserId: iglesiaUsuarios.authUserId })
        .from(iglesiaUsuarios)
        .where(
          and(
            eq(iglesiaUsuarios.iglesiaId, id),
            eq(iglesiaUsuarios.rol, 'pastor'),
            eq(iglesiaUsuarios.estado, 'activo'),
          ),
        ),
    ]);

  // El correo vive en `auth.users`, que no está en el schema de Drizzle ni debe
  // estarlo. Una llamada por pastor: casi siempre es uno, a veces dos.
  const supabase = createAdminClient();
  const conCorreo = await Promise.all(
    pastores.map(async ({ authUserId }) => {
      const { data } = await supabase.auth.admin.getUserById(authUserId);
      return {
        authUserId,
        nombre: data.user ? nombreDeLaCuenta(data.user) : 'Cuenta borrada',
        email: data.user?.email ?? null,
      };
    }),
  );

  return {
    iglesia,
    situacion: situacionDe(iglesia),
    personas: personas?.n ?? 0,
    ministeriosActivos: ministeriosActivos?.n ?? 0,
    cuentas: cuentas?.n ?? 0,
    solicitudesPendientes: solicitudes?.n ?? 0,
    pastores: conCorreo,
  };
}

// ============================================================================
// Cuentas
// ============================================================================

export type MembresiaDeCuenta = {
  iglesiaId: string;
  iglesiaNombre: string;
  rol: RolIglesia;
  estado: string;
};

export type FilaCuenta = {
  id: string;
  email: string | null;
  nombre: string;
  createdAt: Date;
  ultimoAcceso: Date | null;
  esSuperAdmin: boolean;
  membresias: MembresiaDeCuenta[];
};

/**
 * Tope de lo que se lee de `auth.users` de una vez.
 *
 * La API de administración de Supabase no busca por correo: devuelve páginas.
 * Con una sola de mil, el buscador filtra en memoria y no hace falta más
 * mientras haya menos de mil cuentas. El día que haya más, la pantalla lo dice
 * (`incompleta`) en vez de esconder en silencio a quien no cupo.
 */
const MAX_CUENTAS = 1000;

async function membresiasDe(
  ids: string[],
): Promise<Map<string, MembresiaDeCuenta[]>> {
  const mapa = new Map<string, MembresiaDeCuenta[]>();
  if (ids.length === 0) return mapa;

  const filas = await dbAdmin
    .select({
      authUserId: iglesiaUsuarios.authUserId,
      iglesiaId: iglesiaUsuarios.iglesiaId,
      iglesiaNombre: iglesias.nombre,
      rol: iglesiaUsuarios.rol,
      estado: iglesiaUsuarios.estado,
    })
    .from(iglesiaUsuarios)
    .innerJoin(iglesias, eq(iglesias.id, iglesiaUsuarios.iglesiaId))
    .where(inArray(iglesiaUsuarios.authUserId, ids));

  for (const { authUserId, ...m } of filas) {
    const lista = mapa.get(authUserId) ?? [];
    lista.push(m);
    mapa.set(authUserId, lista);
  }
  return mapa;
}

async function superAdmins(): Promise<Set<string>> {
  const filas = await dbAdmin
    .select({ authUserId: adminUsers.authUserId })
    .from(adminUsers);
  return new Set(filas.map((f) => f.authUserId));
}

function aFila(
  user: User,
  membresias: Map<string, MembresiaDeCuenta[]>,
  admins: Set<string>,
): FilaCuenta {
  return {
    id: user.id,
    email: user.email ?? null,
    nombre: nombreDeLaCuenta(user, 'Sin nombre'),
    createdAt: new Date(user.created_at),
    ultimoAcceso: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null,
    esSuperAdmin: admins.has(user.id),
    membresias: membresias.get(user.id) ?? [],
  };
}

export async function listarCuentas(
  busqueda?: string,
): Promise<{ filas: FilaCuenta[]; total: number; incompleta: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: MAX_CUENTAS,
  });
  if (error) throw new Error(`No se pudieron leer las cuentas: ${error.message}`);

  const q = busqueda?.trim().toLowerCase();
  const usuarios = q
    ? data.users.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          nombreDeLaCuenta(u, '').toLowerCase().includes(q),
      )
    : data.users;

  const [membresias, admins] = await Promise.all([
    membresiasDe(usuarios.map((u) => u.id)),
    superAdmins(),
  ]);

  const filas = usuarios
    .map((u) => aFila(u, membresias, admins))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // `total` viene en la respuesta de la API aunque el tipo lo marque opcional
  // según la versión; sin él, lo mínimo que sabemos es lo que se ha leído.
  const total = 'total' in data && typeof data.total === 'number'
    ? data.total
    : data.users.length;

  return { filas, total, incompleta: total > data.users.length };
}

export async function fichaCuenta(id: string): Promise<FilaCuenta | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data.user) return null;

  const [membresias, admins] = await Promise.all([
    membresiasDe([id]),
    superAdmins(),
  ]);
  return aFila(data.user, membresias, admins);
}

// ============================================================================
// Inicio
// ============================================================================

export type ResumenPlataforma = {
  iglesias: FilaIglesia[];
  porGrupo: Record<FiltroSituacion, number>;
  personas: number;
  cuentas: number;
  solicitudesPendientes: number;
};

export async function resumenPlataforma(): Promise<ResumenPlataforma> {
  const supabase = createAdminClient();

  const [lista, [solicitudes], usuarios] = await Promise.all([
    listarIglesias(),
    dbAdmin
      .select({ n: count() })
      .from(solicitudesIngreso)
      .where(eq(solicitudesIngreso.estado, 'pendiente')),
    // Una página de uno: lo que interesa es el `total` que acompaña.
    supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
  ]);

  const porGrupo: Record<FiltroSituacion, number> = {
    prueba: 0,
    pagan: 0,
    vencidas: 0,
    suspendidas: 0,
  };
  for (const i of lista) porGrupo[i.situacion.grupo] += 1;

  const datos = usuarios.data;
  const cuentas =
    datos && 'total' in datos && typeof datos.total === 'number'
      ? datos.total
      : 0;

  return {
    iglesias: lista,
    porGrupo,
    personas: lista.reduce((s, i) => s + i.personas, 0),
    cuentas,
    solicitudesPendientes: solicitudes?.n ?? 0,
  };
}
