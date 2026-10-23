'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';

import {
  exigirModulo,
  requireGestionMinisterioAccion,
} from '@/lib/auth/guard-panel';
import type { UserContext } from '@/lib/auth/user-context';
import { withUser } from '@/lib/db';
import {
  grupoGuias,
  grupoMiembros,
  grupos,
  miembros,
  ministerioMiembros,
} from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { campo, campoObligatorio, campos, casilla } from '@/lib/api/formulario';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { generarCodigo } from '@/lib/grupos/codigo';
import { lunesDe } from '@/lib/grupos/semanas';
import { SEMANAS_POR_DELANTE } from './constantes';

/**
 * Los grupos de una red, desde el panel: crearlos, quién los lleva, su gente,
 * su enlace y la guía común de la semana.
 *
 * TRES PUERTAS EN CADA ACTION, COMO EL REPARTO
 * --------------------------------------------
 *   1. `requireGestionMinisterioAccion(..., { desdeDentro: true })`: el pastor,
 *      o el responsable y los colíderes de ESTA red. Sin `gestionar_ministerios`:
 *      la RLS de la `0047` no le deja escribir en `grupos` ni en
 *      `grupo_miembros` a quien no lidera la red, y la action no puede prometer
 *      más que ella.
 *   2. `exigirModulo(..., 'grupos')`: con la herramienta apagada no se escribe,
 *      aunque el POST se fabrique a mano.
 *   3. La RLS por relación y los triggers HT132–HT134, que son los que de verdad
 *      no se equivocan: quien lleva un grupo está en el equipo, nadie se nombra
 *      a sí mismo, y nada cambia de iglesia ni de red.
 *
 * El líder de una célula NO entra aquí: no da de alta a nadie. La gente llega
 * por el enlace de invitación con su propio consentimiento (`/solicitar`), y a
 * quien no tiene la app la suma la red.
 */

const Id = z.string().uuid();

const base = (ministerioId: string) => `/panel/ministerios/${ministerioId}/grupos`;

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

async function guarda(ministerioId: string): Promise<UserContext> {
  const ctx = await requireGestionMinisterioAccion(ministerioId, '/panel/ministerios', {
    desdeDentro: true,
  });
  await exigirModulo(ctx, ministerioId, 'grupos');
  return ctx;
}

/** La guarda, y además que el grupo sea un uuid: el resto lo mira la base. */
async function guardaDelGrupo(ministerioId: string, grupoId: string) {
  if (!Id.safeParse(grupoId).success) redirect(base(ministerioId));
  return guarda(ministerioId);
}

const EsquemaDatos = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ponle un nombre para reconocerlo en la lista.')
    .max(80, 'Ese nombre es demasiado largo: 80 caracteres como mucho.'),
  zona: z
    .string()
    .trim()
    .max(60, 'La zona, en pocas palabras: el barrio o el sector, no la dirección.')
    .optional(),
  dia: z.coerce
    .number({ message: 'Elige qué día se reúne.' })
    .int('Elige qué día se reúne.')
    .min(0, 'Elige qué día se reúne.')
    .max(6, 'Elige qué día se reúne.'),
  hora: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Esa hora no se entiende. Escríbela como 19:30.')
    .optional(),
});

function leerDatos(formData: FormData) {
  return EsquemaDatos.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    zona: campo(formData, 'zona'),
    dia: campoObligatorio(formData, 'dia'),
    hora: campo(formData, 'hora'),
  });
}

/** ¿Está esta persona activa en el equipo de la red? Lo mismo que HT132. */
async function estaEnElEquipo(
  ctx: UserContext,
  ministerioId: string,
  miembroId: string,
): Promise<boolean> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: ministerioMiembros.id })
      .from(ministerioMiembros)
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      )
      .limit(1),
  );
  return Boolean(fila);
}

/**
 * Los errores de la base que tienen un porqué que contar. Lo que no está aquí
 * se relanza: un fallo de permisos de verdad no se disfraza de mensaje amable
 * (`esGuardHatril`, en `lib/db/error.ts`).
 */
function traducir(err: unknown, destino: string): never {
  if (esGuardHatril(err, 'HT134')) {
    volver(
      'No puedes ponerte a ti mismo a llevarlo. Que lo haga el pastor, o elige a otra persona.',
      destino,
    );
  }
  if (esGuardHatril(err, 'HT132')) {
    volver(
      'Esa persona no está en el equipo de la red. Súmala antes al equipo desde «El equipo».',
      destino,
    );
  }
  throw err;
}

// ============================================================================
// Crear, editar y cerrar
// ============================================================================

export async function crearGrupo(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const destino = `${base(ministerioId)}/nuevo`;

  const datos = leerDatos(formData);
  if (!datos.success) volver(datos.error.issues[0]!.message, destino);
  const lider = Id.safeParse(campo(formData, 'lider'));
  if (!lider.success) volver('Elige quién es el líder.', destino);

  // La base lo vuelve a decir (HT132), pero así el error sale antes y con
  // nombre, sin abrir la transacción.
  if (!(await estaEnElEquipo(ctx, ministerioId, lider.data))) {
    volver('El líder tiene que estar en el equipo de la red.', destino);
  }

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  let grupoId: string;

  try {
    grupoId = await withUser(ctx.user.id, async (tx) => {
      const [creado] = await tx
        .insert(grupos)
        .values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          nombre: datos.data.nombre,
          zona: datos.data.zona ?? null,
          diaSemana: datos.data.dia,
          hora: datos.data.hora ?? null,
          codigo: generarCodigo(),
          creadoPorMiembroId: ctx.miembroId,
        })
        .returning({ id: grupos.id });

      await tx.insert(grupoMiembros).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        grupoId: creado!.id,
        miembroId: lider.data,
        rolGrupo: 'lider',
        desde: hoy,
      });

      return creado!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver('Ya hay uno abierto con ese nombre en esta red. Ponle otro.', destino);
    }
    traducir(err, destino);
  }

  revalidatePath(base(ministerioId));
  redirect(`${base(ministerioId)}/${grupoId}?guardado=creado`);
}

export async function editarGrupo(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;

  const datos = leerDatos(formData);
  if (!datos.success) volver(datos.error.issues[0]!.message, destino);

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(grupos)
        .set({
          nombre: datos.data.nombre,
          zona: datos.data.zona ?? null,
          diaSemana: datos.data.dia,
          hora: datos.data.hora ?? null,
        })
        .where(
          and(
            eq(grupos.id, grupoId),
            eq(grupos.iglesiaId, ctx.iglesia.id),
            eq(grupos.ministerioId, ministerioId),
            eq(grupos.activo, true),
          ),
        ),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver('Ya hay uno abierto con ese nombre en esta red. Ponle otro.', destino);
    }
    throw err;
  }

  revalidatePath(destino);
  redirect(`${destino}?guardado=editado`);
}

/**
 * Cerrar: ya no se reúne. Sale de las listas, su enlace deja de valer y su
 * gente queda fuera de él, con su `hasta`. Las semanas reportadas se quedan:
 * son la historia de la red.
 *
 * Cerrar y no borrar, a propósito. Un borrado se llevaría las semanas en
 * cascada, y con ellas lo que la red contó durante años.
 */
export async function cerrarGrupo(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;

  if (!casilla(formData, 'confirmar')) {
    volver('Marca la casilla para confirmar que quieres cerrarlo.', destino);
  }

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  await withUser(ctx.user.id, async (tx) => {
    const cerrados = await tx
      .update(grupos)
      .set({ activo: false })
      .where(
        and(
          eq(grupos.id, grupoId),
          eq(grupos.iglesiaId, ctx.iglesia.id),
          eq(grupos.ministerioId, ministerioId),
          eq(grupos.activo, true),
        ),
      )
      .returning({ id: grupos.id });
    if (cerrados.length === 0) return;

    await tx
      .update(grupoMiembros)
      .set({ activo: false, hasta: hoy })
      .where(and(eq(grupoMiembros.grupoId, grupoId), eq(grupoMiembros.activo, true)));
  });

  revalidatePath(base(ministerioId));
  redirect(`${base(ministerioId)}?guardado=cerrado`);
}

/**
 * Un código nuevo para el enlace. El viejo deja de valer en ese momento: es lo
 * que se hace cuando el enlace ha circulado por donde no debía.
 */
export async function regenerarCodigo(ministerioId: string, grupoId: string) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(grupos)
      .set({ codigo: generarCodigo() })
      .where(
        and(
          eq(grupos.id, grupoId),
          eq(grupos.iglesiaId, ctx.iglesia.id),
          eq(grupos.ministerioId, ministerioId),
          eq(grupos.activo, true),
        ),
      ),
  );

  revalidatePath(destino);
  redirect(`${destino}?guardado=codigo#invitar`);
}

// ============================================================================
// Quién lo lleva
// ============================================================================

/**
 * Cambiar el líder. El anterior deja el grupo —con su `hasta`, que es el
 * historial—, y el nuevo entra como líder o sube desde la fila que ya tenía.
 *
 * Primero sale el anterior y después entra el nuevo, en la misma transacción:
 * al revés chocaría contra `uq_grupo_lider_activo`, que es un líder por grupo.
 */
export async function cambiarLider(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;

  const nuevo = Id.safeParse(campo(formData, 'lider'));
  if (!nuevo.success) volver('Elige quién es el nuevo líder.', destino);
  if (!(await estaEnElEquipo(ctx, ministerioId, nuevo.data))) {
    volver('El líder tiene que estar en el equipo de la red.', destino);
  }

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  try {
    await withUser(ctx.user.id, async (tx) => {
      const filas = await tx
        .select({ id: grupoMiembros.id, miembroId: grupoMiembros.miembroId, rol: grupoMiembros.rolGrupo })
        .from(grupoMiembros)
        .where(
          and(
            eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
            eq(grupoMiembros.ministerioId, ministerioId),
            eq(grupoMiembros.grupoId, grupoId),
            eq(grupoMiembros.activo, true),
          ),
        );

      const actual = filas.find((f) => f.rol === 'lider');
      if (actual?.miembroId === nuevo.data) return;

      if (actual) {
        await tx
          .update(grupoMiembros)
          .set({ activo: false, hasta: hoy })
          .where(eq(grupoMiembros.id, actual.id));
      }

      const suya = filas.find((f) => f.miembroId === nuevo.data);
      if (suya) {
        await tx
          .update(grupoMiembros)
          .set({ rolGrupo: 'lider' })
          .where(eq(grupoMiembros.id, suya.id));
      } else {
        await tx.insert(grupoMiembros).values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          grupoId,
          miembroId: nuevo.data,
          rolGrupo: 'lider',
          desde: hoy,
        });
      }
    });
  } catch (err) {
    traducir(err, destino);
  }

  revalidatePath(destino);
  redirect(`${destino}?guardado=lider`);
}

/** Alguien del equipo pasa a ayudar a llevarlo. Si ya estaba dentro, sube. */
export async function anadirAuxiliar(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;

  const persona = Id.safeParse(campo(formData, 'auxiliar'));
  if (!persona.success) volver('Elige a quién.', destino);
  if (!(await estaEnElEquipo(ctx, ministerioId, persona.data))) {
    volver('Un auxiliar tiene que estar en el equipo de la red.', destino);
  }

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  try {
    await withUser(ctx.user.id, async (tx) => {
      const [suya] = await tx
        .select({ id: grupoMiembros.id, rol: grupoMiembros.rolGrupo })
        .from(grupoMiembros)
        .where(
          and(
            eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
            eq(grupoMiembros.grupoId, grupoId),
            eq(grupoMiembros.miembroId, persona.data),
            eq(grupoMiembros.activo, true),
          ),
        )
        .limit(1);

      if (suya) {
        // El líder no baja a auxiliar por aquí: eso es cambiar de líder.
        if (suya.rol !== 'participante') return;
        await tx
          .update(grupoMiembros)
          .set({ rolGrupo: 'auxiliar' })
          .where(eq(grupoMiembros.id, suya.id));
      } else {
        await tx.insert(grupoMiembros).values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          grupoId,
          miembroId: persona.data,
          rolGrupo: 'auxiliar',
          desde: hoy,
        });
      }
    });
  } catch (err) {
    traducir(err, destino);
  }

  revalidatePath(destino);
  redirect(`${destino}?guardado=auxiliar`);
}

/** El auxiliar deja de llevarlo y sigue dentro como participante. */
export async function quitarDeAuxiliar(
  ministerioId: string,
  grupoId: string,
  filaId: string,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;
  if (!Id.safeParse(filaId).success) redirect(destino);

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(grupoMiembros)
        .set({ rolGrupo: 'participante' })
        .where(
          and(
            eq(grupoMiembros.id, filaId),
            eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
            eq(grupoMiembros.grupoId, grupoId),
            eq(grupoMiembros.rolGrupo, 'auxiliar'),
            eq(grupoMiembros.activo, true),
          ),
        ),
    );
  } catch (err) {
    // `uq_grupo_participante_por_ministerio`: ya va a otra célula de la red.
    if (isUniqueViolation(err)) {
      volver(
        'Ya va como participante a otro de la red. Quítale de este, o de aquel antes.',
        destino,
      );
    }
    throw err;
  }

  revalidatePath(destino);
  redirect(`${destino}?guardado=sin-auxiliar`);
}

// ============================================================================
// La gente
// ============================================================================

/**
 * Sumar participantes desde el fichero de la iglesia. Para quien no tiene la
 * app o ya va y nadie le había apuntado; los que llegan nuevos entran solos
 * por el enlace.
 *
 * Se saltan, sin error, quien ya está dentro y quien ya va a otro de la red: el
 * diálogo no los ofrece, y si llegan es un formulario viejo o un doble clic.
 */
export async function anadirIntegrantes(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;

  const ids = z.array(Id).safeParse(campos(formData, 'miembros'));
  if (!ids.success || ids.data.length === 0) redirect(destino);
  const pedidos = [...new Set(ids.data)];
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  try {
    await withUser(ctx.user.id, async (tx) => {
      // Solo fichas vivas de ESTA iglesia, como `asignarAlMinisterio`.
      const vivas = await tx
        .select({ id: miembros.id })
        .from(miembros)
        .where(
          and(
            eq(miembros.iglesiaId, ctx.iglesia.id),
            inArray(miembros.id, pedidos),
            isNull(miembros.archivadoAt),
            ne(miembros.estado, 'baja'),
          ),
        );

      const ocupados = await tx
        .select({ miembroId: grupoMiembros.miembroId, grupoId: grupoMiembros.grupoId, rol: grupoMiembros.rolGrupo })
        .from(grupoMiembros)
        .where(
          and(
            eq(grupoMiembros.ministerioId, ministerioId),
            eq(grupoMiembros.activo, true),
            inArray(grupoMiembros.miembroId, pedidos),
          ),
        );

      const saltar = new Set(
        ocupados
          .filter((o) => o.grupoId === grupoId || o.rol === 'participante')
          .map((o) => o.miembroId),
      );
      const nuevos = vivas.map((v) => v.id).filter((id) => !saltar.has(id));
      if (nuevos.length === 0) return;

      await tx.insert(grupoMiembros).values(
        nuevos.map((miembroId) => ({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          grupoId,
          miembroId,
          rolGrupo: 'participante' as const,
          desde: hoy,
        })),
      );
    });
  } catch (err) {
    // Dos personas sumando a la vez a la misma gente: lo que entró, entró.
    if (isUniqueViolation(err)) {
      volver('Alguien la sumó a la vez que tú. Mira la lista y vuelve a probar.', destino);
    }
    traducir(err, destino);
  }

  revalidatePath(destino);
  redirect(`${destino}?guardado=anadidos`);
}

/**
 * Quitar a alguien. Su fila se queda con `activo = false` y su `hasta`: es el
 * historial. El líder no sale por aquí —sería dejar el grupo sin nadie sin
 * decidirlo—: se cambia de líder.
 */
export async function quitarIntegrante(
  ministerioId: string,
  grupoId: string,
  filaId: string,
) {
  const ctx = await guardaDelGrupo(ministerioId, grupoId);
  const destino = `${base(ministerioId)}/${grupoId}`;
  if (!Id.safeParse(filaId).success) redirect(destino);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(grupoMiembros)
      .set({ activo: false, hasta: hoy })
      .where(
        and(
          eq(grupoMiembros.id, filaId),
          eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
          eq(grupoMiembros.grupoId, grupoId),
          ne(grupoMiembros.rolGrupo, 'lider'),
          eq(grupoMiembros.activo, true),
        ),
      ),
  );

  revalidatePath(destino);
  redirect(`${destino}?guardado=quitado`);
}

// ============================================================================
// La guía de la semana
// ============================================================================

/**
 * La guía común: el tema de cada una de las próximas semanas para toda la red.
 *
 * Un campo por semana, `tema-AAAA-MM-DD` con su lunes. Solo se aceptan las que
 * ofrece la pantalla —desde esta hasta tres más—: un lunes de hace un año
 * mandado a mano reescribiría la guía de algo que ya pasó. Vacío borra la de
 * esa semana.
 *
 * Esta es también la action de la app (`/mi/equipo/[id]/grupos`), envuelta en
 * `enLaApp()`: su `redirect` se traduce solo.
 */
export async function publicarGuia(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const destino = base(ministerioId);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const primera = lunesDe(hoy);
  const semanas = Array.from({ length: SEMANAS_POR_DELANTE }, (_, i) =>
    sumarDias(primera, 7 * i),
  );

  const Tema = z.string().trim().max(120, 'Cada tema, en 120 caracteres como mucho.');
  const temas: { semana: string; tema: string | undefined }[] = [];
  for (const semana of semanas) {
    const leido = Tema.optional().safeParse(campo(formData, `tema-${semana}`));
    if (!leido.success) volver(leido.error.issues[0]!.message, destino);
    temas.push({ semana, tema: leido.data || undefined });
  }

  await withUser(ctx.user.id, async (tx) => {
    for (const { semana, tema } of temas) {
      if (tema) {
        await tx
          .insert(grupoGuias)
          .values({
            iglesiaId: ctx.iglesia.id,
            ministerioId,
            semana,
            tema,
            publicadoPorMiembroId: ctx.miembroId,
          })
          .onConflictDoUpdate({
            target: [grupoGuias.ministerioId, grupoGuias.semana],
            set: { tema, publicadoPorMiembroId: ctx.miembroId },
          });
      } else {
        await tx
          .delete(grupoGuias)
          .where(
            and(
              eq(grupoGuias.iglesiaId, ctx.iglesia.id),
              eq(grupoGuias.ministerioId, ministerioId),
              eq(grupoGuias.semana, semana),
            ),
          );
      }
    }
  });

  revalidatePath(destino);
  redirect(`${destino}?guardado=guia#guia`);
}

