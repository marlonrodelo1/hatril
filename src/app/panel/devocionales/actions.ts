'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import { devocionales } from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import {
  borrarImagenAnterior,
  subirImagenIglesia,
} from '@/lib/iglesias/imagenes';
import type { UserContext } from '@/lib/auth/user-context';
import {
  cuentaDeMiembro,
  emitirNotificacion,
} from '@/lib/notificaciones/emitir';
import { formatearFechaLarga } from '@/lib/fecha/hoy';

/**
 * Devocionales.
 *
 * DOS NIVELES, Y NO ES LO MISMO
 * -----------------------------
 *   - REPARTIR TURNOS —crear la fila con su fecha y su autor, o borrarla— es del
 *     pastor. Es organizar el calendario de la iglesia.
 *   - ESCRIBIR el contenido lo hace quien tenga `escribir_devocionales`, y solo
 *     en los días que le hayan asignado.
 *
 * La segunda parte es la que hace que el permiso sirva de algo: sin acotarlo por
 * autor, dárselo a un líder le dejaría reescribir el devocional de cualquiera.
 */

const DESTINO = '/panel/devocionales';

function volver(mensaje: string): never {
  redirect(`${DESTINO}?error=` + encodeURIComponent(mensaje));
}

/** Solo el pastor reparte los turnos. */
async function requirePastorDevocional(): Promise<UserContext> {
  const ctx = await requireIglesiaAccion();
  if (!esPastor(ctx)) {
    volver('Solo el pastor reparte los turnos del devocional.');
  }
  return ctx;
}

const EsquemaTurno = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha.'),
  autorMiembroId: z.string().uuid().optional().or(z.literal('')),
});

export async function crearTurno(formData: FormData) {
  const ctx = await requirePastorDevocional();

  const parsed = EsquemaTurno.safeParse({
    fecha: campoObligatorio(formData, 'fecha'),
    autorMiembroId: campo(formData, 'autorMiembroId'),
  });

  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(devocionales).values({
        iglesiaId: ctx.iglesia.id,
        fecha: parsed.data.fecha,
        autorMiembroId: parsed.data.autorMiembroId || null,
      }),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      volver('Ya hay un devocional para ese día.');
    }
    // HT105: el trigger que impide firmar con alguien de otra congregación.
    if (esGuardHatril(err, 'HT105')) {
      volver('Esa persona no es de tu iglesia.');
    }
    throw err;
  }

  // A quien le toca se le dice. Un calendario que hay que mirar por si acaso no
  // es un reparto de turnos: es una lista que alguien tiene que recordar.
  if (parsed.data.autorMiembroId) {
    await emitirNotificacion({
      iglesiaId: ctx.iglesia.id,
      destinatarioAuthUserId: await cuentaDeMiembro(
        ctx.iglesia.id,
        parsed.data.autorMiembroId,
      ),
      provocadoPor: ctx.user.id,
      tipo: 'turno_devocional',
      datos: { fecha: formatearFechaLarga(parsed.data.fecha) },
      enlace: DESTINO,
    });
  }

  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=turno`);
}

export async function borrarTurno(id: string) {
  const ctx = await requirePastorDevocional();

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(devocionales)
      .where(
        and(eq(devocionales.id, id), eq(devocionales.iglesiaId, ctx.iglesia.id)),
      ),
  );

  revalidatePath(DESTINO);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}?guardado=borrado`);
}

/**
 * La imagen de fondo del devocional.
 *
 * Mismo guard que escribirlo: si puedes redactarlo, puedes elegir su imagen.
 * Separada del formulario de texto porque subir 2 MB tarda y no tiene por qué ir
 * atado a guardar un párrafo.
 */
export async function guardarImagenDevocional(id: string, formData: FormData) {
  const ctx = await requireIglesiaAccion();

  const fichero = formData.get('imagen');
  if (!(fichero instanceof File)) {
    volver('No has elegido ninguna imagen.');
  }

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        autorMiembroId: devocionales.autorMiembroId,
        imagenUrl: devocionales.imagenUrl,
      })
      .from(devocionales)
      .where(
        and(eq(devocionales.id, id), eq(devocionales.iglesiaId, ctx.iglesia.id)),
      )
      .limit(1),
  );

  if (!fila) volver('Ese devocional ya no existe.');

  const esSuyo =
    ctx.miembroId !== null && fila.autorMiembroId === ctx.miembroId;

  if (!esPastor(ctx) && !esSuyo) {
    volver('Solo puedes cambiar la imagen de los devocionales que te tocan.');
  }

  const resultado = await subirImagenIglesia(
    ctx.iglesia.id,
    'foto',
    fichero,
    `devocional-${id.slice(0, 8)}-${Date.now().toString(36)}`,
  );

  if (!resultado.ok) volver(resultado.error);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(devocionales)
      .set({ imagenUrl: resultado.url })
      .where(
        and(eq(devocionales.id, id), eq(devocionales.iglesiaId, ctx.iglesia.id)),
      ),
  );

  await borrarImagenAnterior(fila.imagenUrl);

  revalidatePath(DESTINO);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}?guardado=imagen&abrir=${id}`);
}

/**
 * De dónde puede venir el vídeo del devocional.
 *
 * Lista cerrada y no «cualquier https». El enlace acaba en un botón de la web
 * pública de la iglesia, así que un campo libre es un sitio donde alguien con
 * acceso al panel puede colgar lo que quiera y firmarlo con el nombre de la
 * congregación. Añadir un dominio aquí es una línea; quitar uno que ya se
 * publicó, no.
 */
const DOMINIOS_VIDEO = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
];

const EsquemaContenido = z.object({
  titulo: z.string().trim().max(120).optional().or(z.literal('')),
  versiculo: z.string().trim().max(600).optional().or(z.literal('')),
  referencia: z.string().trim().max(80).optional().or(z.literal('')),
  cuerpo: z.string().trim().max(6000).optional().or(z.literal('')),
  videoUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => {
        if (v === '') return true;
        let url: URL;
        try {
          url = new URL(v);
        } catch {
          return false;
        }
        // `https` y no `http`: la web de la iglesia se sirve por https y un
        // enlace en claro dispara el aviso de contenido mixto del navegador.
        return url.protocol === 'https:' && DOMINIOS_VIDEO.includes(url.hostname);
      },
      'El vídeo tiene que ser un enlace de YouTube o de Vimeo que empiece por https.',
    )
    .optional()
    .or(z.literal('')),
});

/**
 * Escribir el devocional de un día.
 *
 * El guard va en dos pasos porque no basta con el permiso: hay que comprobar
 * contra la BASE DE DATOS que este devocional es suyo. Fiarse de un campo del
 * formulario dejaría reescribir el de cualquiera cambiando un id.
 */
export async function guardarDevocional(id: string, formData: FormData) {
  const ctx = await requireIglesiaAccion();

  const parsed = EsquemaContenido.safeParse({
    titulo: campo(formData, 'titulo'),
    versiculo: campo(formData, 'versiculo'),
    referencia: campo(formData, 'referencia'),
    cuerpo: campo(formData, 'cuerpo'),
    videoUrl: campo(formData, 'videoUrl'),
  });

  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ autorMiembroId: devocionales.autorMiembroId })
      .from(devocionales)
      .where(
        and(eq(devocionales.id, id), eq(devocionales.iglesiaId, ctx.iglesia.id)),
      )
      .limit(1),
  );

  if (!fila) volver('Ese devocional ya no existe.');

  const esSuyo =
    ctx.miembroId !== null && fila.autorMiembroId === ctx.miembroId;

  /*
   * TENER EL TURNO ES EL PERMISO.
   *
   * Antes esto exigía además `escribir_devocionales`, y producía una situación
   * que nadie entendería: el pastor asigna el jueves a alguien y esa persona
   * abre el panel y no puede escribirlo. Asignar el turno YA es la decisión de
   * acceso; pedir dos cosas para lo mismo solo crea una configuración que se
   * olvida.
   *
   * El permiso se queda para otra cosa: que la sección aparezca en el menú
   * aunque hoy no le toque nada, para poder mirar el calendario.
   */
  if (!esPastor(ctx) && !esSuyo) {
    volver('Solo puedes escribir los devocionales que te han asignado.');
  }

  const d = parsed.data;

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(devocionales)
      .set({
        titulo: d.titulo || null,
        versiculo: d.versiculo || null,
        referencia: d.referencia || null,
        cuerpo: d.cuerpo || null,
        videoUrl: d.videoUrl || null,
        // Publicar es del pastor. Quien escribe deja el texto listo; el pastor
        // decide cuándo sale, que es lo que pidió la iglesia al repartir turnos.
        ...(esPastor(ctx) ? { publicado: casilla(formData, 'publicado') } : {}),
      })
      .where(
        and(eq(devocionales.id, id), eq(devocionales.iglesiaId, ctx.iglesia.id)),
      ),
  );

  revalidatePath(DESTINO);
  revalidatePath(`/i/${ctx.iglesia.slug}`);
  redirect(`${DESTINO}?guardado=escrito`);
}
