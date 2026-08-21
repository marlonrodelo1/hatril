'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePastorAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { casilla, campoObligatorio } from '@/lib/api/formulario';

const DESTINO = '/panel/comunidad';

const Esquema = z.object({
  activa: z.boolean(),
  quienPublica: z.enum(['todos', 'equipo', 'pastor']),
  comentarios: z.boolean(),
  fotos: z.boolean(),
});

/**
 * Guardar cómo funciona el muro de la congregación.
 *
 * SOLO EL PASTOR
 * --------------
 * Decidir si la congregación tiene muro, y quién escribe en él, es de la misma
 * familia que los ajustes de la iglesia: no lo delega el permiso de moderar.
 * Moderar es quitar lo que sobra; esto es decidir las reglas.
 *
 * LO QUE SE GUARDA AQUÍ NO ES LO QUE PROTEGE EL MURO
 * --------------------------------------------------
 * Estas cuatro columnas las leen las policies de la `0027` en cada INSERT de
 * publicación, comentario y me gusta. Esta pantalla las escribe; quien las hace
 * cumplir es Postgres. Si algún día se añade una server action nueva —o el
 * endpoint de la app móvil de la v2— no hay que acordarse de comprobarlas.
 */
export async function guardarComunidad(formData: FormData) {
  const ctx = await requirePastorAccion(DESTINO);

  const datos = Esquema.safeParse({
    activa: casilla(formData, 'activa'),
    quienPublica: campoObligatorio(formData, 'quienPublica'),
    comentarios: casilla(formData, 'comentarios'),
    fotos: casilla(formData, 'fotos'),
  });

  if (!datos.success) {
    redirect(
      `${DESTINO}?error=` +
        encodeURIComponent(
          datos.error.issues[0]?.message ?? 'Revisa la configuración.',
        ),
    );
  }

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(iglesias)
      .set({
        comunidadActiva: datos.data.activa,
        comunidadQuienPublica: datos.data.quienPublica,
        comunidadComentarios: datos.data.comentarios,
        comunidadFotos: datos.data.fotos,
      })
      .where(eq(iglesias.id, ctx.iglesia.id)),
  );

  // El contexto de usuario lleva esta configuración dentro y lo consume la
  // cabecera de todas las pantallas, así que no vale con revalidar esta.
  revalidatePath('/', 'layout');
  redirect(`${DESTINO}?guardado=1`);
}
