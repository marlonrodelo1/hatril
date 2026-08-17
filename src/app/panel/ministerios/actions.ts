'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import {
  requireGestionMinisterioAccion,
  requirePermisoAccion,
} from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import { ministerioMiembros, ministerios } from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { COLORES_MINISTERIO } from '@/lib/ministerios/colores';
import {
  borrarImagenAnterior,
  subirImagenIglesia,
} from '@/lib/iglesias/imagenes';
import { campo, campoObligatorio, campos } from '@/lib/api/formulario';

const HEX_VALIDOS = COLORES_MINISTERIO.map((c) => c.hex) as [string, ...string[]];

const EsquemaMinisterio = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del ministerio es demasiado corto.')
    .max(80, 'Ese nombre es demasiado largo.'),
  descripcion: z.string().trim().max(400).optional().or(z.literal('')),
  // Solo se aceptan los cinco colores de la paleta. Que el formulario ofrezca
  // únicamente esos no basta: una server action es un endpoint y se le puede
  // mandar cualquier cosa.
  colorHex: z.enum(HEX_VALIDOS),
});

function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

function leer(formData: FormData) {
  return EsquemaMinisterio.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    descripcion: campo(formData, 'descripcion'),
    colorHex: campoObligatorio(formData, 'colorHex'),
  });
}

export async function crearMinisterio(formData: FormData) {
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

  const parsed = leer(formData);
  if (!parsed.success) {
    redirect(
      '/panel/ministerios/nuevo?error=' +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  const d = parsed.data;

  let nuevoId: string;

  try {
    nuevoId = await withUser(ctx.user.id, async (tx) => {
      const [creado] = await tx
        .insert(ministerios)
        .values({
          iglesiaId: ctx.iglesia.id,
          nombre: d.nombre,
          descripcion: oNulo(d.descripcion),
          colorHex: d.colorHex,
          // El responsable se asigna después, desde el detalle: para elegirlo
          // hay que tener equipo, y un ministerio recién creado no lo tiene.
          orden: 100,
        })
        .returning({ id: ministerios.id });

      return creado!.id;
    });
  } catch (err) {
    // Choca contra `uq_ministerios_iglesia_nombre`, que compara en minúsculas:
    // «Jóvenes» y «jóvenes» son el mismo equipo.
    if (isUniqueViolation(err)) {
      redirect(
        '/panel/ministerios/nuevo?error=' +
          encodeURIComponent('Ya tienes un ministerio con ese nombre.'),
      );
    }
    throw err;
  }

  revalidatePath('/panel/ministerios');
  redirect(`/panel/ministerios/${nuevoId}`);
}

export async function editarMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  // Acotado: el responsable de alabanza edita alabanza. Crear y archivar siguen
  // pidiendo el permiso global, porque son decisiones de la iglesia entera.
  const ctx = await requireGestionMinisterioAccion(ministerioId);

  const parsed = leer(formData);
  if (!parsed.success) {
    redirect(
      `/panel/ministerios/${ministerioId}/editar?error=` +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  const d = parsed.data;

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(ministerios)
        .set({
          nombre: d.nombre,
          descripcion: oNulo(d.descripcion),
          colorHex: d.colorHex,
        })
        .where(
          and(
            eq(ministerios.id, ministerioId),
            eq(ministerios.iglesiaId, ctx.iglesia.id),
          ),
        ),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(
        `/panel/ministerios/${ministerioId}/editar?error=` +
          encodeURIComponent('Ya tienes otro ministerio con ese nombre.'),
      );
    }
    throw err;
  }

  revalidatePath('/panel/ministerios');
  redirect(`/panel/ministerios/${ministerioId}`);
}

export async function asignarAlMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);

  const ids = z
    .array(z.string().uuid())
    .safeParse(campos(formData, 'miembros'));

  if (!ids.success || ids.data.length === 0) {
    redirect(`/panel/ministerios/${ministerioId}`);
  }

  await withUser(ctx.user.id, async (tx) => {
    // Quien ya estuvo y salió tiene una fila con `activo = false`. Se reactiva
    // en vez de insertar otra: así el histórico no se llena de duplicados y el
    // índice único parcial sigue teniendo sentido.
    const previos = await tx
      .select({
        id: ministerioMiembros.id,
        miembroId: ministerioMiembros.miembroId,
      })
      .from(ministerioMiembros)
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          inArray(ministerioMiembros.miembroId, ids.data),
        ),
      );

    const yaConFila = new Set(previos.map((p) => p.miembroId));
    const hoy = new Date().toISOString().slice(0, 10);

    if (previos.length > 0) {
      await tx
        .update(ministerioMiembros)
        // `rolEquipo` vuelve a 'voluntario', y no es un detalle: si esta persona
        // fue responsable, salió, y mientras tanto se nombró a otra, reactivar
        // su fila tal cual chocaría contra `uq_ministerio_responsable_activo`
        // con un 23505 en la cara de quien solo pulsó «Asignar miembros».
        //
        // Quien vuelve, vuelve como uno más. Si tiene que volver a mandar, se le
        // nombra a propósito.
        .set({ activo: true, desde: hoy, hasta: null, rolEquipo: 'voluntario' })
        .where(
          inArray(
            ministerioMiembros.id,
            previos.map((p) => p.id),
          ),
        );
    }

    const nuevos = ids.data.filter((id) => !yaConFila.has(id));

    if (nuevos.length > 0) {
      await tx.insert(ministerioMiembros).values(
        nuevos.map((miembroId) => ({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          miembroId,
          desde: hoy,
        })),
      );
    }
  });

  revalidatePath(`/panel/ministerios/${ministerioId}`);
  redirect(`/panel/ministerios/${ministerioId}`);
}

export async function quitarDelMinisterio(
  ministerioId: string,
  miembroId: string,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);

  // Se desactiva, no se borra: que alguien sirvió en alabanza tres años es justo
  // lo que un pastor quiere poder mirar dentro de dos.
  //
  // Y aquí había un segundo UPDATE que limpiaba `ministerios.lider_miembro_id`
  // si esta persona era la responsable. Ya no hace falta: al poner
  // `activo = false` la fila sale del predicado del índice parcial, así que deja
  // de ser la responsable en la misma sentencia. Es la simplificación que compró
  // mudar el liderazgo a esta tabla.
  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      ),
  );

  revalidatePath(`/panel/ministerios/${ministerioId}`);
  redirect(`/panel/ministerios/${ministerioId}`);
}

const EsquemaRolEquipo = z.object({
  rolEquipo: z.enum(['responsable', 'colider', 'voluntario']),
});

/**
 * Cambiar qué manda alguien dentro de un equipo.
 *
 * DOS GUARDS Y NO UNO. `requireGestionMinisterioAccion` contesta «puedes tocar
 * este ministerio», que no es lo mismo que «puedes decidir quién lo dirige».
 * Nombrar responsable se queda en el pastor y en quien tenga el permiso global:
 * a un líder acotado se le deja traer colíderes, no traspasar el mando y salir
 * por la puerta.
 */
export async function cambiarRolEnEquipo(
  ministerioId: string,
  miembroId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `/panel/ministerios/${ministerioId}`;

  const parsed = EsquemaRolEquipo.safeParse({
    rolEquipo: campoObligatorio(formData, 'rolEquipo'),
  });
  if (!parsed.success) {
    redirect(`${destino}?error=` + encodeURIComponent('Ese rol no existe.'));
  }

  const nuevo = parsed.data.rolEquipo;

  if (
    nuevo === 'responsable' &&
    !esPastor(ctx) &&
    !puede(ctx, 'gestionar_ministerios')
  ) {
    redirect(
      `${destino}?error=` +
        encodeURIComponent(
          'Solo el pastor puede decidir quién es el responsable de un ministerio.',
        ),
    );
  }

  try {
    await withUser(ctx.user.id, async (tx) => {
      // Degradar al anterior ANTES de ascender al nuevo. En el otro orden hay un
      // instante con dos responsables activos y el índice único aborta la
      // transacción entera.
      if (nuevo === 'responsable') {
        await tx
          .update(ministerioMiembros)
          .set({ rolEquipo: 'colider' })
          .where(
            and(
              eq(ministerioMiembros.ministerioId, ministerioId),
              eq(ministerioMiembros.rolEquipo, 'responsable'),
              eq(ministerioMiembros.activo, true),
            ),
          );
      }

      await tx
        .update(ministerioMiembros)
        .set({ rolEquipo: nuevo })
        .where(
          and(
            eq(ministerioMiembros.ministerioId, ministerioId),
            eq(ministerioMiembros.miembroId, miembroId),
            eq(ministerioMiembros.activo, true),
          ),
        );
    });
  } catch (err) {
    // Dos personas nombrando responsable a la vez desde dos pestañas.
    if (isUniqueViolation(err)) {
      redirect(
        `${destino}?error=` +
          encodeURIComponent(
            'Ese ministerio ya tiene responsable. Recarga la página y vuelve a intentarlo.',
          ),
      );
    }
    // HT104: el guard de la base de datos. Solo se llega aquí si alguien esquiva
    // la interfaz, porque la pantalla no ofrece el control sobre uno mismo.
    if (esGuardHatril(err, 'HT104')) {
      redirect(
        `${destino}?error=` +
          encodeURIComponent('No puedes nombrarte líder a ti mismo.'),
      );
    }
    throw err;
  }

  revalidatePath(destino);
  revalidatePath('/panel/ministerios');
  redirect(destino);
}

/**
 * La foto del ministerio para la web pública.
 *
 * La puede cambiar quien lleve ese ministerio, no solo el pastor: es la foto de
 * su propio equipo. Va al mismo bucket que el logo de la iglesia —público, por
 * la misma razón: sale en la web.
 */
export async function guardarFotoMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `/panel/ministerios/${ministerioId}`;

  const fichero = formData.get('foto');
  if (!(fichero instanceof File)) {
    redirect(`${destino}?error=` + encodeURIComponent('No has elegido ninguna imagen.'));
  }

  const resultado = await subirImagenIglesia(
    ctx.iglesia.id,
    'foto',
    fichero,
    `ministerio-${ministerioId.slice(0, 8)}-${Date.now().toString(36)}`,
  );

  if (!resultado.ok) {
    redirect(`${destino}?error=` + encodeURIComponent(resultado.error));
  }

  const [previa] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: ministerios.fotoUrl })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ministerios)
      .set({ fotoUrl: resultado.url })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  await borrarImagenAnterior(previa?.url ?? null);

  revalidatePath(destino);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${destino}?guardado=foto`);
}

/** Quitar la foto del ministerio. */
export async function quitarFotoMinisterio(ministerioId: string) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);

  const [previa] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: ministerios.fotoUrl })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(ministerios)
      .set({ fotoUrl: null })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  await borrarImagenAnterior(previa?.url ?? null);

  revalidatePath(`/panel/ministerios/${ministerioId}`);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`/panel/ministerios/${ministerioId}?guardado=foto-quitada`);
}

export async function archivarMinisterio(ministerioId: string) {
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

  await withUser(ctx.user.id, async (tx) => {
    await tx
      .update(ministerios)
      .set({ activo: false })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      );

    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
        ),
      );
  });

  revalidatePath('/panel/ministerios');
  redirect('/panel/ministerios');
}
