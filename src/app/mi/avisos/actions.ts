'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { notificaciones } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

/**
 * Marcar avisos como leídos.
 *
 * SIN `requireIglesia`, Y ESO ES LO IMPORTANTE
 * --------------------------------------------
 * Aquí basta con tener sesión. El guard del panel echa a quien no tiene
 * membresía activa, y justo esa persona —a quien acaban de rechazar la
 * solicitud— es la que tiene un aviso esperándola. Con `requireIglesia` no
 * podría ni marcarlo como leído.
 *
 * Lo que impide tocar los avisos de otro no es este fichero: son las policies de
 * la `0018`, que solo dejan ver y actualizar los que van dirigidos a `auth.uid()`.
 * Y el trigger HT109, que además impide cambiar cualquier cosa que no sea la
 * marca de leído.
 */

async function sesion(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/acceso?next=/mi/avisos');
  return user.id;
}

/**
 * SIN `redirect`, Y ESO IMPORTA DESDE QUE HAY CAMPANA
 * ---------------------------------------------------
 * Antes terminaba con `redirect('/mi/avisos')`, que en su pantalla no se nota
 * —ya estás ahí— pero desde el desplegable de la cabecera te sacaba del panel:
 * pulsabas «Marcar todo» estando en Miembros y aparecías en la bandeja.
 *
 * `revalidatePath('/', 'layout')` en su lugar, y no el de una ruta concreta,
 * porque el contador se pinta en la cabecera de TODAS las pantallas del panel y
 * del área del miembro. Revalidar solo `/mi/avisos` dejaría el punto encendido
 * en la pantalla desde la que se acaba de pulsar.
 */
export async function marcarTodoLeido() {
  const authUserId = await sesion();

  await withUser(authUserId, (tx) =>
    tx
      .update(notificaciones)
      .set({ leidaAt: new Date() })
      .where(isNull(notificaciones.leidaAt)),
  );

  revalidatePath('/', 'layout');
}

/**
 * Marcar uno y seguir a donde lleve.
 *
 * El enlace se toma de la fila y no del formulario: si viniera del cliente, este
 * botón sería una redirección abierta con la que mandar a cualquiera a donde
 * quisiera desde una URL de la propia aplicación.
 */
export async function abrirAviso(id: string) {
  const authUserId = await sesion();

  const [fila] = await withUser(authUserId, (tx) =>
    tx
      .update(notificaciones)
      .set({ leidaAt: new Date() })
      .where(and(eq(notificaciones.id, id), isNull(notificaciones.leidaAt)))
      .returning({ enlace: notificaciones.enlace }),
  );

  // Si ya estaba leído, el `update` no devuelve nada y hay que ir a buscar su
  // destino igualmente: pulsar dos veces el mismo aviso tiene que llevar al
  // mismo sitio las dos veces.
  const destino =
    fila?.enlace ??
    (
      await withUser(authUserId, (tx) =>
        tx
          .select({ enlace: notificaciones.enlace })
          .from(notificaciones)
          .where(eq(notificaciones.id, id))
          .limit(1),
      )
    )[0]?.enlace;

  revalidatePath('/', 'layout');
  redirect(destino ?? '/mi/avisos');
}
