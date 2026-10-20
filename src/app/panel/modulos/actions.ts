'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  requirePastorAccion,
  requirePermisoAccion,
} from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { iglesias, ministerios } from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import {
  TIPOS_ACTIVABLES,
  colorLibre,
  nombreLibre,
  repartirPorTipo,
} from '@/lib/ministerios/catalogo';
import { componerModulos } from '@/lib/ministerios/modulos';
import {
  HERRAMIENTAS_IGLESIA,
  conHerramienta,
  type HerramientaIglesiaId,
} from '@/lib/iglesias/herramientas';
import {
  modulosDelTipo,
  tipoDeMinisterio,
  type TipoMinisterioId,
} from '@/lib/ministerios/tipos';

/*
 * AQUÍ NO HAY «DESACTIVAR», Y NO ES UN OLVIDO
 * -------------------------------------------
 * Lo único que existe para cerrar un ministerio es `archivarMinisterio`, y da
 * de baja a todo el equipo sin vuelta atrás: no hay pantalla para recuperar un
 * archivado. Un interruptor en un catálogo invita a probar y a deshacer, y aquí
 * deshacer no existe. Cerrar sigue en la pantalla de editar de cada ministerio,
 * con su aviso delante.
 */

const DESTINO = '/panel/modulos';

// Sin «Otro»: activarlo crearía un ministerio llamado «Otro». Ese va al
// formulario completo. Una server action es un endpoint, así que el filtro tiene
// que estar aquí y no solo en los botones que pinta la página.
const TipoActivable = z.enum(
  TIPOS_ACTIVABLES.map((t) => t.id) as [TipoMinisterioId, ...TipoMinisterioId[]],
);

/** Activar un tipo que todavía no está en marcha. */
export async function activarModulo(tipoId: string) {
  await crearDelTipo(tipoId, { otroMas: false });
}

/** Un segundo equipo del mismo tipo: dos de alabanza, uno por culto. */
export async function anadirOtroModulo(tipoId: string) {
  await crearDelTipo(tipoId, { otroMas: true });
}

async function crearDelTipo(tipoId: string, { otroMas }: { otroMas: boolean }) {
  const ctx = await requirePermisoAccion('gestionar_ministerios', DESTINO);

  const parsed = TipoActivable.safeParse(tipoId);
  if (!parsed.success) {
    redirect(
      `${DESTINO}?error=` +
        encodeURIComponent('Ese tipo de ministerio no se puede activar desde aquí.'),
    );
  }

  const tipo = tipoDeMinisterio(parsed.data);

  let destinoId: string;

  try {
    destinoId = await withUser(ctx.user.id, async (tx) => {
      // Todos, archivados incluidos: el índice de nombre también los cuenta.
      const existentes = await tx
        .select({
          id: ministerios.id,
          nombre: ministerios.nombre,
          colorHex: ministerios.colorHex,
          tipo: ministerios.tipo,
          activo: ministerios.activo,
        })
        .from(ministerios)
        .where(eq(ministerios.iglesiaId, ctx.iglesia.id));

      const activos = existentes.filter((m) => m.activo);

      // «Activar» es idempotente. El botón solo sale cuando no hay ninguno, así
      // que llegar aquí con uno ya activo es un doble clic o la página vieja de
      // otra pestaña: se abre el que hay en vez de fabricar «Alabanza 2».
      //
      // «Ya activo» con el mismo criterio que la tarjeta, nombre incluido: el
      // «Jóvenes» de antes de la 0028 está guardado como «Otro», y mirando solo
      // el tipo esto crearía «Jóvenes 2» al lado.
      if (!otroMas) {
        const enMarcha = repartirPorTipo(activos).get(tipo.id);
        const yaActivo = enMarcha?.delTipo[0] ?? enMarcha?.porNombre[0];
        if (yaActivo) return yaActivo.id;
      }

      const [creado] = await tx
        .insert(ministerios)
        .values({
          iglesiaId: ctx.iglesia.id,
          nombre: nombreLibre(
            tipo.nombre,
            existentes.map((m) => m.nombre),
          ),
          // Sin descripción, a propósito: la de la plantilla es genérica y el
          // ministerio sale en la web pública de la iglesia. Mejor el hueco que
          // un texto que la iglesia no ha escrito firmando en su nombre.
          colorHex: colorLibre(activos.map((m) => m.colorHex)),
          tipo: tipo.id,
          // La misma plantilla que `crearMinisterio`, y solo al nacer.
          modulos: componerModulos({}, modulosDelTipo(tipo.id)),
          orden: 100,
        })
        .returning({ id: ministerios.id });

      return creado!.id;
    });
  } catch (err) {
    // Dos activaciones a la vez del mismo tipo calculan el mismo nombre libre, y
    // la segunda choca con `uq_ministerios_iglesia_nombre`. Al reintentar,
    // «Activar» abre el que ganó y «Añadir otro» toma el número siguiente.
    if (isUniqueViolation(err)) {
      redirect(
        `${DESTINO}?error=` +
          encodeURIComponent(
            'Se estaba creando otro ministerio con ese nombre a la vez. Vuelve a intentarlo.',
          ),
      );
    }
    throw err;
  }

  revalidatePath(DESTINO);
  revalidatePath('/panel/ministerios');
  // Al detalle, porque lo siguiente es nombrar a quien lo lleva: un ministerio
  // recién creado no tiene equipo ni responsable.
  redirect(`/panel/ministerios/${destinoId}`);
}

// ===========================================================================
// Herramientas de la iglesia
//
// Solo el pastor, y no `gestionar_ministerios`: quien organiza los equipos no
// decide si la iglesia lleva su caja aquí. La base dice lo mismo —
// `iglesias_update_pastor` (0001) no deja escribir la fila a nadie más—, así
// que la puerta de la action y la de la base coinciden.
//
// Apagar no borra nada. Por eso aquí SÍ hay interruptor, al revés que con los
// ministerios: volver a encender deja todo como estaba.
// ===========================================================================

const Herramienta = z.enum(
  HERRAMIENTAS_IGLESIA.map((h) => h.id) as [
    HerramientaIglesiaId,
    ...HerramientaIglesiaId[],
  ],
);

export async function cambiarHerramienta(id: string, encender: boolean) {
  const ctx = await requirePastorAccion(DESTINO);

  const parsed = Herramienta.safeParse(id);
  if (!parsed.success) {
    redirect(`${DESTINO}?error=` + encodeURIComponent('Esa herramienta no existe.'));
  }

  await withUser(ctx.user.id, async (tx) => {
    // Leída aquí, con la fila bloqueada, y no del contexto: el contexto es de
    // cuando se pintó la pantalla, y lo que cuelga de otras claves tiene que
    // sobrevivir a dos pestañas abiertas a la vez.
    const [fila] = await tx
      .select({ modulos: iglesias.modulos })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .for('update')
      .limit(1);

    await tx
      .update(iglesias)
      .set({ modulos: conHerramienta(fila?.modulos, parsed.data, encender) })
      .where(eq(iglesias.id, ctx.iglesia.id));
  });

  // El menú y el bloque de la caja de Inicio cuelgan de esto en todo el panel.
  revalidatePath('/panel', 'layout');
  redirect(`${DESTINO}?guardado=${encender ? 'encendida' : 'apagada'}#herramientas`);
}
