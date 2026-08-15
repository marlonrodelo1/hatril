'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { miembros, ministerioMiembros } from '@/lib/db/schema';
import { ESTADOS_ELEGIBLES } from '@/lib/miembros/estados';
import { normalizarTelefono } from '@/lib/telefono/normalizar';

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
    nombre: formData.get('nombre'),
    apellidos: formData.get('apellidos'),
    email: formData.get('email'),
    telefono: formData.get('telefono'),
    estado: formData.get('estado'),
    fechaNacimiento: formData.get('fechaNacimiento'),
    fechaIngreso: formData.get('fechaIngreso'),
    direccion: formData.get('direccion'),
    ciudad: formData.get('ciudad'),
    estadoCivil: formData.get('estadoCivil'),
    notas: formData.get('notas'),
    bautizado: formData.get('bautizado') ?? undefined,
    ministerios: formData.getAll('ministerios').map(String).filter(Boolean),
    fechaBautismo: formData.get('fechaBautismo'),
  });
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
        fechaNacimiento: oNulo(d.fechaNacimiento),
        // Si no se dice, la persona entra hoy. Es lo que espera quien apunta a
        // alguien justo después del culto.
        fechaIngreso: oNulo(d.fechaIngreso) ?? new Date().toISOString().slice(0, 10),
        direccion: oNulo(d.direccion),
        ciudad: oNulo(d.ciudad),
        estadoCivil: oNulo(d.estadoCivil),
        notas: oNulo(d.notas),
        bautizado: d.bautizado === 'on',
        fechaBautismo: oNulo(d.fechaBautismo),
      })
      .returning({ id: miembros.id });

    if (d.ministerios?.length) {
      await tx.insert(ministerioMiembros).values(
        d.ministerios.map((ministerioId) => ({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          miembroId: creado!.id,
        })),
      );
    }

    return creado!.id;
  });

  revalidatePath('/panel/miembros');
  redirect(`/panel/miembros?ficha=${nuevoId}`);
}

export async function editarMiembro(miembroId: string, formData: FormData) {
  const ctx = await requirePermisoAccion('editar_miembros', '/panel/miembros');

  const parsed = leerFormulario(formData);
  if (!parsed.success) {
    redirect(
      `/panel/miembros/${miembroId}/editar?error=` +
        encodeURIComponent(parsed.error.issues[0]!.message),
    );
  }

  const d = parsed.data;

  await withUser(ctx.user.id, async (tx) => {
    await tx
      .update(miembros)
      .set({
        nombre: d.nombre,
        apellidos: oNulo(d.apellidos),
        email: oNulo(d.email),
        telefono: normalizarTelefono(oNulo(d.telefono), ctx.iglesia.pais),
        estado: d.estado as (typeof ESTADOS_ELEGIBLES)[number],
        fechaNacimiento: oNulo(d.fechaNacimiento),
        fechaIngreso: oNulo(d.fechaIngreso),
        direccion: oNulo(d.direccion),
        ciudad: oNulo(d.ciudad),
        estadoCivil: oNulo(d.estadoCivil),
        notas: oNulo(d.notas),
        bautizado: d.bautizado === 'on',
        fechaBautismo: oNulo(d.fechaBautismo),
      })
      .where(
        and(eq(miembros.id, miembroId), eq(miembros.iglesiaId, ctx.iglesia.id)),
      );

    // Los ministerios se resuelven como «desactivar todos y volver a activar
    // los marcados». Se desactivan, NO se borran: el índice único parcial deja
    // convivir el histórico con el vínculo vivo, y así un pastor puede ver que
    // alguien sirvió en alabanza aunque hoy ya no lo haga.
    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      );

    if (d.ministerios?.length) {
      await tx.insert(ministerioMiembros).values(
        d.ministerios.map((ministerioId) => ({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          miembroId,
        })),
      );
    }
  });

  revalidatePath('/panel/miembros');
  redirect(`/panel/miembros?ficha=${miembroId}`);
}

export async function darDeBaja(miembroId: string) {
  const ctx = await requirePermisoAccion('editar_miembros', '/panel/miembros');

  await withUser(ctx.user.id, async (tx) => {
    // Baja lógica. No se borra la fila: se llevaría por delante el histórico de
    // ministerios y las notas del pastorado. El borrado de verdad existe, pero
    // llega por el derecho de supresión del RGPD y es otra operación.
    await tx
      .update(miembros)
      .set({ estado: 'baja', archivadoAt: new Date() })
      .where(
        and(eq(miembros.id, miembroId), eq(miembros.iglesiaId, ctx.iglesia.id)),
      );

    await tx
      .update(ministerioMiembros)
      .set({ activo: false, hasta: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ministerioMiembros.miembroId, miembroId),
          eq(ministerioMiembros.activo, true),
        ),
      );
  });

  revalidatePath('/panel/miembros');
  redirect('/panel/miembros');
}
