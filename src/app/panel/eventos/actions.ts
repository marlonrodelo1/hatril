'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePermisoAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { eventoInscripciones, eventos } from '@/lib/db/schema';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import { parseFechaHoraLocal } from '@/lib/fecha/zona';
import { normalizarEnlacePago } from '@/lib/eventos/enlace-pago';
import { esGuardHatril } from '@/lib/db/error';
import {
  borrarImagenAnterior,
  subirImagenIglesia,
} from '@/lib/iglesias/imagenes';
import type { UserContext } from '@/lib/auth/user-context';
import { DESTINO } from './constantes';

/**
 * Los eventos, desde el panel.
 *
 * Todo va con `gestionar_eventos`, no con `requirePastorAccion`: el campamento
 * de jóvenes lo organiza el líder de jóvenes. La lista de inscritos lleva datos
 * de personas ajenas a la congregación, así que el permiso pesa — el texto de
 * `/panel/lideres` lo dice explícitamente.
 */

function volver(mensaje: string, destino: string = DESTINO): never {
  redirect(`${destino}?error=` + encodeURIComponent(mensaje));
}

async function requireEventos(destino: string = DESTINO): Promise<UserContext> {
  return requirePermisoAccion('gestionar_eventos', destino);
}

const EsquemaEvento = z.object({
  titulo: z.string().trim().min(1, 'El evento necesita un título.').max(140),
  descripcion: z.string().trim().max(4000).optional(),
  lugar: z.string().trim().max(160).optional(),
  // Llegan como `YYYY-MM-DDTHH:mm` de un `<input type="datetime-local">` y se
  // interpretan en la zona de la iglesia, no en la del servidor.
  inicio: z.string().trim().min(1, 'Falta la fecha y la hora de inicio.'),
  fin: z.string().trim().optional(),
  precio: z.string().trim().optional(),
  cupo: z.string().trim().optional(),
  enlacePago: z.string().trim().optional(),
  pagoInstrucciones: z.string().trim().max(300).optional(),
});

/**
 * El precio, de lo que se teclea a lo que guarda Postgres.
 *
 * Acepta coma y punto: en España se escribe «12,50» y en Colombia «12.500».
 * Vacío es GRATIS y se guarda `null`, que no es lo mismo que cero — un botón de
 * pagar junto a «0 COP» es un producto roto, y el CHECK de la base lo impide.
 */
function parsearPrecio(bruto: string | undefined): string | null | 'error' {
  if (!bruto) return null;
  const limpio = bruto.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return 'error';
  const n = Number(limpio);
  if (!Number.isFinite(n) || n <= 0) return 'error';
  return limpio;
}

function parsearCupo(bruto: string | undefined): number | null | 'error' {
  if (!bruto) return null;
  if (!/^\d{1,6}$/.test(bruto)) return 'error';
  const n = Number(bruto);
  return n > 0 ? n : 'error';
}

/** Lo común a crear y editar: valida y devuelve las columnas listas. */
function datosDelFormulario(formData: FormData, timezone: string) {
  const parsed = EsquemaEvento.safeParse({
    titulo: campoObligatorio(formData, 'titulo'),
    descripcion: campo(formData, 'descripcion'),
    lugar: campo(formData, 'lugar'),
    inicio: campoObligatorio(formData, 'inicio'),
    fin: campo(formData, 'fin'),
    precio: campo(formData, 'precio'),
    cupo: campo(formData, 'cupo'),
    enlacePago: campo(formData, 'enlacePago'),
    pagoInstrucciones: campo(formData, 'pagoInstrucciones'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa los datos.',
    } as const;
  }

  const d = parsed.data;

  const inicioEn = parseFechaHoraLocal(d.inicio, timezone);
  if (!inicioEn) {
    return { ok: false, error: 'La fecha de inicio no es válida.' } as const;
  }

  const finEn = d.fin ? parseFechaHoraLocal(d.fin, timezone) : null;
  if (d.fin && !finEn) {
    return { ok: false, error: 'La fecha de fin no es válida.' } as const;
  }
  if (finEn && finEn < inicioEn) {
    return {
      ok: false,
      error: 'El evento no puede terminar antes de empezar.',
    } as const;
  }

  const precio = parsearPrecio(d.precio);
  if (precio === 'error') {
    return {
      ok: false,
      error:
        'El precio tiene que ser un número mayor que cero. Déjalo vacío si el evento es gratis.',
    } as const;
  }

  const cupo = parsearCupo(d.cupo);
  if (cupo === 'error') {
    return {
      ok: false,
      error:
        'El aforo tiene que ser un número entero mayor que cero. Déjalo vacío si no hay límite.',
    } as const;
  }

  const enlace = normalizarEnlacePago(d.enlacePago);
  if (!enlace.ok) return { ok: false, error: enlace.error } as const;

  return {
    ok: true,
    valores: {
      titulo: d.titulo,
      descripcion: d.descripcion ?? null,
      lugar: d.lugar ?? null,
      inicioEn,
      finEn,
      precio,
      cupo,
      enlacePago: enlace.enlace?.url ?? null,
      enlacePagoHost: enlace.enlace?.host ?? null,
      pagoInstrucciones: d.pagoInstrucciones ?? null,
    },
  } as const;
}

export async function crearEvento(formData: FormData): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/nuevo`);

  const datos = datosDelFormulario(formData, ctx.iglesia.timezone);
  if (!datos.ok) volver(datos.error, `${DESTINO}/nuevo`);

  let id: string;
  try {
    const filas = await withUser(ctx.user.id, (tx) =>
      tx
        .insert(eventos)
        .values({
          iglesiaId: ctx.iglesia.id,
          ...datos.valores,
          // Quién lo creó, para el rastro de la auditoría. Puede ser null: una
          // cuenta de pastor sin ficha de miembro es un caso real.
          creadoPorMiembroId: ctx.miembroId,
        })
        .returning({ id: eventos.id }),
    );
    id = filas[0]!.id;
  } catch (err) {
    if (esGuardHatril(err, 'HT113')) {
      volver('Quien crea el evento no es de esta iglesia.', `${DESTINO}/nuevo`);
    }
    throw err;
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}/${id}?guardado=creado`);
}

export async function editarEvento(id: string, formData: FormData): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${id}`);

  const datos = datosDelFormulario(formData, ctx.iglesia.timezone);
  if (!datos.ok) volver(datos.error, `${DESTINO}/${id}/editar`);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(eventos)
      .set({ ...datos.valores, updatedAt: new Date() })
      // El `iglesiaId` es redundante con la RLS y va igual: es la convención
      // del repo, y lo que queda de pie si algún día alguien cambia la llave.
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id))),
  );

  revalidatePath(DESTINO);
  revalidatePath(`${DESTINO}/${id}`);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}/${id}?guardado=guardado`);
}

/**
 * Publicar y despublicar, y abrir y cerrar inscripciones.
 *
 * Son dos interruptores separados a propósito, igual que `web_publica` y
 * `visible_en_directorio`: la iglesia quiere seguir anunciando el retiro cuando
 * ya no quedan plazas.
 */
export async function cambiarPublicado(id: string, formData: FormData): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${id}`);
  const publicado = casilla(formData, 'publicado');

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(eventos)
      .set({ publicado, updatedAt: new Date() })
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id))),
  );

  revalidatePath(DESTINO);
  revalidatePath(`${DESTINO}/${id}`);
  // Sin esto, el pastor publica, abre su web y no ve el evento: va con ISR de
  // 60 segundos.
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}/${id}?guardado=${publicado ? 'publicado' : 'despublicado'}`);
}

export async function cambiarInscripciones(id: string, formData: FormData): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${id}`);
  const abiertas = casilla(formData, 'abiertas');

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(eventos)
      .set({ inscripcionesAbiertas: abiertas, updatedAt: new Date() })
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id))),
  );

  revalidatePath(`${DESTINO}/${id}`);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}/${id}?guardado=${abiertas ? 'abiertas' : 'cerradas'}`);
}

export async function guardarImagenEvento(id: string, formData: FormData): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${id}`);

  const fichero = formData.get('imagen');
  if (!(fichero instanceof File) || fichero.size === 0) {
    volver('No has elegido ninguna imagen.', `${DESTINO}/${id}`);
  }

  // Se reutiliza la ranura 'foto' sin tocar el tipo `Ranura`, exactamente como
  // hacen los devocionales: el sufijo es lo que separa unas imágenes de otras
  // dentro del bucket de la iglesia.
  const subida = await subirImagenIglesia(ctx.iglesia.id, 'foto', fichero, `evento-${id}`);
  if (!subida.ok) volver(subida.error, `${DESTINO}/${id}`);

  const [antes] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: eventos.imagenUrl })
      .from(eventos)
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(eventos)
      .set({ imagenUrl: subida.url, updatedAt: new Date() })
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id))),
  );

  // La anterior se borra DESPUÉS de que la nueva esté guardada. Al revés, un
  // fallo a mitad deja el evento sin imagen y con la vieja ya borrada.
  await borrarImagenAnterior(antes?.url ?? null);

  revalidatePath(`${DESTINO}/${id}`);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}/${id}?guardado=guardado`);
}

export async function borrarEvento(id: string): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${id}`);

  const [antes] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ url: eventos.imagenUrl })
      .from(eventos)
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );

  // `on delete cascade` se lleva las inscripciones. Es lo que hace falta: sin
  // cron de purga, borrar el evento es la única forma que tiene una iglesia de
  // ejercer el derecho de supresión sobre esa lista.
  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(eventos)
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id))),
  );

  await borrarImagenAnterior(antes?.url ?? null);

  revalidatePath(DESTINO);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}?guardado=borrado`);
}

/**
 * Marcar una plaza como pagada, o quitarle la marca.
 *
 * Es una ANOTACIÓN del organizador, no un hecho verificado: Hatril no cobra ni
 * intermedia, y así lo dice el comentario de la columna en la base.
 */
export async function marcarPagada(
  inscripcionId: string,
  eventoId: string,
  formData: FormData,
): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${eventoId}`);
  const pagado = casilla(formData, 'pagado');

  try {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(eventoInscripciones)
        .set({
          pagado,
          // `pagado` y `pagado_at` van juntos: lo exige `ck_inscripciones_pagado`
          // como equivalencia, no como dos condiciones sueltas.
          pagadoAt: pagado ? new Date() : null,
          marcadoPorMiembroId: pagado ? ctx.miembroId : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(eventoInscripciones.id, inscripcionId),
            eq(eventoInscripciones.iglesiaId, ctx.iglesia.id),
          ),
        ),
    );
  } catch (err) {
    if (esGuardHatril(err, 'HT113')) {
      volver('Quien marca el pago no es de esta iglesia.', `${DESTINO}/${eventoId}`);
    }
    if (esGuardHatril(err, 'HT114')) {
      volver('Esa inscripción no se puede modificar.', `${DESTINO}/${eventoId}`);
    }
    throw err;
  }

  revalidatePath(`${DESTINO}/${eventoId}`);
  redirect(`${DESTINO}/${eventoId}?guardado=${pagado ? 'pagada' : 'pago-quitado'}`);
}

/**
 * Dar de baja a alguien.
 *
 * Lo hace el pastor y no la persona inscrita, y es una consecuencia buscada: el
 * código de cancelación solo puede llegar a su dueño por correo, y hasta que
 * Resend esté montado no hay forma de entregárselo. Enseñarlo en pantalla
 * convertiría la inscripción en un oráculo (ver la migración `0024`).
 *
 * Se marca `cancelada_at` en vez de borrar: la plaza se libera igual —el aforo
 * cuenta solo las vivas— y el pastor sigue viendo que esa persona se dio de
 * baja, en lugar de buscar a alguien que sí se apuntó y ya no aparece.
 */
export async function cancelarInscripcion(
  inscripcionId: string,
  eventoId: string,
): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${eventoId}`);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(eventoInscripciones)
      .set({ canceladaAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(eventoInscripciones.id, inscripcionId),
          eq(eventoInscripciones.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  revalidatePath(`${DESTINO}/${eventoId}`);
  redirect(`${DESTINO}/${eventoId}?guardado=inscripcion-cancelada`);
}

/**
 * Borrar la lista entera de inscritos de un evento pasado.
 *
 * Existe porque NO hay cron de purga: la regla de conservación que se escribe en
 * `/privacidad` tiene que poder cumplirse a mano, o sería una promesa falsa —que
 * es justo lo que ESTADO.md reprocha del apartado de borrado.
 */
export async function borrarInscritos(eventoId: string): Promise<void> {
  const ctx = await requireEventos(`${DESTINO}/${eventoId}`);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(eventoInscripciones)
      .where(
        and(
          eq(eventoInscripciones.eventoId, eventoId),
          eq(eventoInscripciones.iglesiaId, ctx.iglesia.id),
        ),
      ),
  );

  revalidatePath(`${DESTINO}/${eventoId}`);
  redirect(`${DESTINO}/${eventoId}?guardado=lista-borrada`);
}
