'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import {
  esPastor,
  puede,
  puedeVerDatosSensibles,
  type ContextoPermisos,
} from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import { withUser } from '@/lib/db';
import { miembros, ministerioMiembros, ministerios } from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import { ESTADOS_ELEGIBLES } from '@/lib/miembros/estados';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { campo, campoObligatorio, campos, casilla } from '@/lib/api/formulario';

/**
 * Alta, edición y baja de personas.
 *
 * EL PERMISO SE COMPRUEBA AQUÍ, NO SOLO EN LA PANTALLA
 * ---------------------------------------------------
 * Que el botón «Añadir miembro» no se pinte para quien no puede no impide nada:
 * una server action es un endpoint, y se puede llamar directamente. Por eso
 * cada acción empieza por `requirePermisoAccion`.
 *
 * Y por debajo sigue estando la RLS: aunque este guard faltara, `withUser` no
 * dejaría escribir en otra iglesia.
 */

const EsquemaMiembro = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre.').max(120),
  apellidos: z.string().trim().max(160).optional().or(z.literal('')),
  email: z
    .union([z.string().trim().toLowerCase().email('Ese correo no parece válido.'), z.literal('')])
    .optional(),
  telefono: z.string().trim().max(40).optional().or(z.literal('')),
  estado: z.enum(ESTADOS_ELEGIBLES as [string, ...string[]]),
  fechaNacimiento: z.string().trim().optional().or(z.literal('')),
  fechaIngreso: z.string().trim().optional().or(z.literal('')),
  direccion: z.string().trim().max(240).optional().or(z.literal('')),
  ciudad: z.string().trim().max(120).optional().or(z.literal('')),
  estadoCivil: z.string().trim().max(60).optional().or(z.literal('')),
  notas: z.string().trim().max(2000).optional().or(z.literal('')),
  bautizado: z.string().optional(),
  fechaBautismo: z.string().trim().optional().or(z.literal('')),
  ministerios: z.array(z.string().uuid()).optional(),
});

/** Cadena vacía → null. En base de datos, «no lo sé» es NULL, no «». */
function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

function leerFormulario(formData: FormData) {
  return EsquemaMiembro.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    apellidos: campo(formData, 'apellidos'),
    email: campo(formData, 'email'),
    telefono: campo(formData, 'telefono'),
    estado: campoObligatorio(formData, 'estado'),
    // Estos cuatro NO se pintan a quien no tiene `ver_datos_sensibles`, asi que
    // llegan ausentes: es justo el caso que devolvia null y tumbaba el guardado.
    fechaNacimiento: campo(formData, 'fechaNacimiento'),
    fechaIngreso: campo(formData, 'fechaIngreso'),
    direccion: campo(formData, 'direccion'),
    ciudad: campo(formData, 'ciudad'),
    estadoCivil: campo(formData, 'estadoCivil'),
    notas: campo(formData, 'notas'),
    bautizado: casilla(formData, 'bautizado') ? 'on' : undefined,
    ministerios: campos(formData, 'ministerios'),
    fechaBautismo: campo(formData, 'fechaBautismo'),
  });
}

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/**
 * Hoy en la iglesia, no en UTC. Con `toISOString()`, en Bogotá a partir de las
 * 19:00 ya era mañana: el alta de la tarde entraba con fecha del día siguiente
 * y «Nuevos» decía «llegó hace -1 días».
 */
function hoy(ctx: UserContext): string {
  return hoyEnLaIglesia(ctx.iglesia.timezone);
}

/**
 * ¿Decide quién MANDA en los ministerios, y no solo quién sirve en ellos?
 *
 * Al responsable lo nombra y lo quita el pastor, o quien tenga
 * `gestionar_ministerios`; a los colíderes, además, el responsable de ese
 * ministerio, pero desde la página del ministerio, que es donde se ve el
 * equipo. La ficha es la herramienta de `editar_miembros` —la secretaría—, y
 * ese permiso no dice nada sobre quién dirige qué.
 *
 * Es la misma frontera que `gobiernaLosMinisterios` en `ministerios/actions.ts`.
 * Copiada y no importada porque un fichero `'use server'` solo exporta
 * funciones async, y cada export suyo es un endpoint que se puede llamar.
 */
function gobiernaLosMinisterios(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || puede(ctx, 'gestionar_ministerios');
}

type Liderazgo = { ministerio: string; rol: 'responsable' | 'colider' };

type PlanMinisterios = {
  /** Filas activas de los ministerios que se han desmarcado. */
  cerrar: string[];
  /** Una fila inactiva por ministerio al que vuelve: ya estuvo y salió. */
  reabrir: string[];
  /** Ministerios donde no ha estado nunca. */
  estrenar: string[];
  /** Lo que manda en los ministerios de `cerrar`. Vacío si no lidera ninguno. */
  lideres: Liderazgo[];
};

/**
 * Qué hay que tocar para que sus ministerios queden como dicen las casillas.
 *
 * COMPARAR, NO REEMPLAZAR
 * -----------------------
 * Antes esto era «desactivar todas sus filas y volver a insertar las marcadas»,
 * y las nuevas nacían como 'voluntario' sin `desde` ni `rol_en_ministerio`. Al
 * principio solo se perdían fechas; desde que el liderazgo vive en
 * `rol_equipo`, la secretaria corregía un teléfono y el ministerio se quedaba
 * sin responsable, y si la ficha era de un colíder con rol `miembro`, perdía el
 * panel en la siguiente carga: liderar es lo único que le daba acceso. Ahora lo
 * que sigue marcado y ya tenía fila no se toca.
 *
 * SOLO LEE
 * --------
 * Todo lo que puede rechazar el guardado se decide aquí, antes de la primera
 * escritura: un rechazo no puede dejar la ficha a medio guardar.
 *
 * Las filas se leen con `for update`. Entre esta lectura y el UPDATE, el pastor
 * podría nombrar colíder a esta persona desde otra pestaña, y sin el bloqueo se
 * la sacaría con el rol de hace un instante, que es el hueco que este cambio
 * viene a cerrar.
 */
async function planearMinisterios(
  tx: Tx,
  ctx: UserContext,
  miembroId: string,
  marcados: string[],
): Promise<PlanMinisterios> {
  // Solo los ministerios que el formulario pudo pintar: los activos de esta
  // iglesia, igual que `listarMinisterios`. Lo que no se ve no se toca, como
  // los datos protegidos para quien no los ve. Y de paso descarta un id
  // inventado o de un ministerio archivado mientras se editaba, que de otro
  // modo acabaría en un 500 por HT102 o en alguien sirviendo donde ya no hay
  // ministerio.
  const visibles = await tx
    .select({ id: ministerios.id, nombre: ministerios.nombre })
    .from(ministerios)
    .where(
      and(
        eq(ministerios.iglesiaId, ctx.iglesia.id),
        eq(ministerios.activo, true),
      ),
    );

  const nombreDe = new Map(visibles.map((m) => [m.id, m.nombre]));

  // Las activas y también las del histórico, que son las que se reabren. La
  // más reciente primero, para reabrir esa y no una de hace años.
  const filas = await tx
    .select({
      id: ministerioMiembros.id,
      ministerioId: ministerioMiembros.ministerioId,
      rolEquipo: ministerioMiembros.rolEquipo,
      activo: ministerioMiembros.activo,
    })
    .from(ministerioMiembros)
    .where(
      and(
        eq(ministerioMiembros.miembroId, miembroId),
        inArray(ministerioMiembros.ministerioId, [...nombreDe.keys()]),
      ),
    )
    .orderBy(desc(ministerioMiembros.createdAt))
    .for('update');

  // `Set`: la misma casilla dos veces en un POST hecho a mano daría dos
  // inserts y un 23505 contra `uq_ministerio_miembro_activo`.
  const quiere = new Set(marcados.filter((id) => nombreDe.has(id)));
  const activas = new Map(
    filas.filter((f) => f.activo).map((f) => [f.ministerioId, f]),
  );

  const salen = [...activas.values()].filter(
    (f) => !quiere.has(f.ministerioId),
  );
  const entran = [...quiere].filter((id) => !activas.has(id));

  // Puede haber varias inactivas por ministerio —entró, salió, volvió, salió—.
  // Se reabre UNA: reabrirlas todas chocaría contra el índice único parcial.
  const reabrir = new Map<string, string>();
  for (const f of filas) {
    if (!f.activo && entran.includes(f.ministerioId) && !reabrir.has(f.ministerioId)) {
      reabrir.set(f.ministerioId, f.id);
    }
  }

  return {
    cerrar: salen.map((f) => f.id),
    reabrir: [...reabrir.values()],
    estrenar: entran.filter((id) => !reabrir.has(id)),
    lideres: salen.flatMap((f) =>
      f.rolEquipo === 'voluntario'
        ? []
        : [{ ministerio: nombreDe.get(f.ministerioId)!, rol: f.rolEquipo }],
    ),
  };
}

async function aplicarMinisterios(
  tx: Tx,
  ctx: UserContext,
  miembroId: string,
  plan: PlanMinisterios,
) {
  const fecha = hoy(ctx);

  // Se desactivan, NO se borran: el índice único parcial deja convivir el
  // histórico con el vínculo vivo, y así un pastor puede ver que alguien
  // sirvió en alabanza aunque hoy ya no lo haga.
  if (plan.cerrar.length > 0) {
    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: fecha })
      .where(inArray(ministerioMiembros.id, plan.cerrar));
  }

  // Quien vuelve, vuelve como voluntario, igual que en `asignarAlMinisterio`.
  // Reabrir su fila de responsable tal cual chocaría contra
  // `uq_ministerio_responsable_activo` si ya hay otro, y sería nombrar líder
  // desde la ficha, que no es el sitio. Con 'voluntario' tampoco salta HT104.
  if (plan.reabrir.length > 0) {
    await tx
      .update(ministerioMiembros)
      .set({ activo: true, desde: fecha, hasta: null, rolEquipo: 'voluntario' })
      .where(inArray(ministerioMiembros.id, plan.reabrir));
  }

  if (plan.estrenar.length > 0) {
    await tx.insert(ministerioMiembros).values(
      plan.estrenar.map((ministerioId) => ({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        miembroId,
        desde: fecha,
      })),
    );
  }
}

function papel(rol: Liderazgo['rol']): string {
  return rol === 'responsable' ? 'responsable' : 'colíder';
}

/**
 * Dos personas tocando los ministerios de la misma ficha a la vez: alguien la
 * ha metido en un equipo entre que se leyó y se escribió.
 */
const A_LA_VEZ =
  'Alguien ha cambiado sus ministerios mientras editabas. Vuelve a intentarlo.';

/**
 * Los cinco datos protegidos, solo si quien guarda puede verlos.
 *
 * El formulario no los pinta a quien no tiene `ver_datos_sensibles`, así que
 * no viajan, `campo()` da undefined y `oNulo()` null. Escritos tal cual, quien
 * solo podía corregir un teléfono borraba en silencio la fecha de nacimiento,
 * la dirección y las notas del pastorado de esa persona. Fuera del objeto, la
 * columna se queda como estaba; y de paso un POST fabricado tampoco los escribe.
 */
function datosProtegidos(
  ctx: ContextoPermisos,
  d: z.infer<typeof EsquemaMiembro>,
) {
  if (!puedeVerDatosSensibles(ctx)) return {};
  return {
    fechaNacimiento: oNulo(d.fechaNacimiento),
    direccion: oNulo(d.direccion),
    ciudad: oNulo(d.ciudad),
    estadoCivil: oNulo(d.estadoCivil),
    notas: oNulo(d.notas),
  };
}

export async function crearMiembro(formData: FormData) {
  const ctx = await requirePermisoAccion('editar_miembros', '/panel/miembros');

  const parsed = leerFormulario(formData);
  if (!parsed.success) {
    redirect(
      '/panel/miembros/nuevo?error=' +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  const d = parsed.data;

  const nuevoId = await withUser(ctx.user.id, async (tx) => {
    const [creado] = await tx
      .insert(miembros)
      .values({
        iglesiaId: ctx.iglesia.id,
        nombre: d.nombre,
        apellidos: oNulo(d.apellidos),
        email: oNulo(d.email),
        telefono: normalizarTelefono(oNulo(d.telefono), ctx.iglesia.pais),
        estado: d.estado as (typeof ESTADOS_ELEGIBLES)[number],
        // Si no se dice, la persona entra hoy. Es lo que espera quien apunta a
        // alguien justo después del culto.
        fechaIngreso: oNulo(d.fechaIngreso) ?? hoy(ctx),
        ...datosProtegidos(ctx, d),
        bautizado: d.bautizado === 'on',
        fechaBautismo: oNulo(d.fechaBautismo),
      })
      .returning({ id: miembros.id });

    // El mismo camino que al editar aunque aquí no haya nada que comparar: así
    // el alta también filtra ids repetidos o de ministerios que no se pintaron.
    const plan = await planearMinisterios(tx, ctx, creado!.id, d.ministerios ?? []);
    await aplicarMinisterios(tx, ctx, creado!.id, plan);

    return creado!.id;
  });

  revalidatePath('/panel/miembros');
  redirect(`/panel/miembros?ficha=${nuevoId}`);
}

export async function editarMiembro(miembroId: string, formData: FormData) {
  const ctx = await requirePermisoAccion('editar_miembros', '/panel/miembros');
  const volver = `/panel/miembros/${miembroId}/editar?error=`;

  const parsed = leerFormulario(formData);
  if (!parsed.success) {
    redirect(volver + encodeURIComponent(parsed.error.issues[0]!.message));
  }

  const d = parsed.data;

  let error: string | null;

  try {
    error = await withUser(ctx.user.id, async (tx) => {
      const plan = await planearMinisterios(tx, ctx, miembroId, d.ministerios ?? []);

      // Desmarcar a quien lidera es quitarle el mando, y con él el panel si
      // no tiene otro permiso. Eso no lo decide `editar_miembros`. Se rechaza
      // el guardado entero y no solo esa casilla: guardar el resto en silencio
      // haría creer a quien edita que ya está fuera del ministerio.
      const lider = plan.lideres[0];
      if (lider && !gobiernaLosMinisterios(ctx)) {
        return lider.rol === 'responsable'
          ? `Para sacar a ${d.nombre} de ${lider.ministerio}, donde es ${papel(lider.rol)}, pídeselo al pastor.`
          : `${d.nombre} es colíder de ${lider.ministerio}. Quítale el liderazgo desde la página de ${lider.ministerio}, si la llevas, o pídeselo al pastor.`;
      }

      const [editado] = await tx
        .update(miembros)
        .set({
          nombre: d.nombre,
          apellidos: oNulo(d.apellidos),
          email: oNulo(d.email),
          telefono: normalizarTelefono(oNulo(d.telefono), ctx.iglesia.pais),
          estado: d.estado as (typeof ESTADOS_ELEGIBLES)[number],
          fechaIngreso: oNulo(d.fechaIngreso),
          ...datosProtegidos(ctx, d),
          bautizado: d.bautizado === 'on',
          fechaBautismo: oNulo(d.fechaBautismo),
        })
        .where(
          and(eq(miembros.id, miembroId), eq(miembros.iglesiaId, ctx.iglesia.id)),
        )
        .returning({ id: miembros.id });

      // Sin ficha no se cuelga nada de ella: el insert acabaría en HT102.
      if (!editado) return 'No encontramos esa ficha.';

      await aplicarMinisterios(tx, ctx, miembroId, plan);
      return null;
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    error = A_LA_VEZ;
  }

  if (error) redirect(volver + encodeURIComponent(error));

  revalidatePath('/panel/miembros');
  redirect(`/panel/miembros?ficha=${miembroId}`);
}

export async function darDeBaja(miembroId: string) {
  const ctx = await requirePermisoAccion('editar_miembros', '/panel/miembros');

  const error = await withUser(ctx.user.id, async (tx) => {
    // La baja la saca de todos sus ministerios, así que tiene la misma puerta
    // que desmarcarlos: si no, quien no puede quitar al responsable desde la
    // ficha lo quitaría igual con el botón rojo de debajo.
    if (!gobiernaLosMinisterios(ctx)) {
      const { lideres } = await planearMinisterios(tx, ctx, miembroId, []);
      const lider = lideres[0];
      if (lider) {
        const [persona] = await tx
          .select({ nombre: miembros.nombre })
          .from(miembros)
          .where(
            and(eq(miembros.id, miembroId), eq(miembros.iglesiaId, ctx.iglesia.id)),
          )
          .limit(1);
        const nombre = persona?.nombre ?? 'esta persona';

        return lider.rol === 'responsable'
          ? `Para dar de baja a ${nombre}, que es responsable de ${lider.ministerio}, pídeselo al pastor.`
          : `Para dar de baja a ${nombre}, que es colíder de ${lider.ministerio}, antes tiene que sacarle del ministerio el pastor o quien sea responsable de ${lider.ministerio}.`;
      }
    }

    // Baja lógica. No se borra la fila: se llevaría por delante el histórico de
    // ministerios y las notas del pastorado. El borrado de verdad existe, pero
    // llega por el derecho de supresión del RGPD y es otra operación.
    const [deBaja] = await tx
      .update(miembros)
      .set({ estado: 'baja', archivadoAt: new Date() })
      .where(
        and(eq(miembros.id, miembroId), eq(miembros.iglesiaId, ctx.iglesia.id)),
      )
      .returning({ id: miembros.id });

    // Sin esto, una cuenta activa en dos iglesias daba de baja en la A una
    // ficha que no encontraba y, acto seguido, sacaba de sus equipos a esa
    // persona en la B: la RLS deja escribir en todas las iglesias donde la
    // cuenta está activa, no solo en la del contexto. Por lo mismo, la iglesia
    // también en el UPDATE de abajo.
    if (!deBaja) return 'No encontramos esa ficha.';

    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: hoy(ctx) })
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      );

    return null;
  });

  if (error) {
    redirect(
      `/panel/miembros/${miembroId}/editar?error=` + encodeURIComponent(error),
    );
  }

  revalidatePath('/panel/miembros');
  redirect('/panel/miembros');
}
