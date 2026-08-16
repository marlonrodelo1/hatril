'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { ministerioMiembros, ministerios } from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import { COLORES_MINISTERIO } from '@/lib/ministerios/colores';
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
  liderMiembroId: z.string().uuid().optional().or(z.literal('')),
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
    liderMiembroId: campo(formData, 'liderMiembroId'),
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
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

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
          liderMiembroId: oNulo(d.liderMiembroId),
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
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

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
        .set({ activo: true, desde: hoy, hasta: null })
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
  const ctx = await requirePermisoAccion(
    'gestionar_ministerios',
    '/panel/ministerios',
  );

  await withUser(ctx.user.id, async (tx) => {
    // Se desactiva, no se borra: que alguien sirvió en alabanza tres años es
    // justo lo que un pastor quiere poder mirar dentro de dos.
    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      );

    // Si era el responsable, el ministerio se queda sin responsable. Dejar
    // apuntando a alguien que ya no está en el equipo es peor que el hueco: la
    // pantalla enseñaría un nombre que nadie puede localizar ahí.
    await tx
      .update(ministerios)
      .set({ liderMiembroId: null })
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.liderMiembroId, miembroId),
        ),
      );
  });

  revalidatePath(`/panel/ministerios/${ministerioId}`);
  redirect(`/panel/ministerios/${ministerioId}`);
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
