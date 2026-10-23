'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { withUser } from '@/lib/db';
import { grupoSemanas } from '@/lib/db/schema';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { obtenerGrupo } from '@/lib/grupos/consultas';
import { requireGrupoAccion } from '@/lib/grupos/guarda';
import { esSemanaReportable, proximasSemanas } from '@/lib/grupos/semanas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';

/**
 * Lo que hace quien lleva una célula desde la app: reportar la semana y
 * planificar los temas.
 *
 * Sin gemela en el panel —el reporte es del líder, y se hace en el móvil al
 * acabar la reunión—, así que no se envuelve nada: la puerta es
 * `requireGrupoAccion`, la misma de la pantalla, y debajo la RLS de la `0047`,
 * que solo deja escribir en `grupo_semanas` a quien lleva ese grupo o la red.
 *
 * UN RECUENTO, NO UNA LISTA
 * -------------------------
 * Se guardan dos números —cuántos de la célula vinieron y cuántas visitas— y
 * nadie detrás. El porqué entero está en la `0047`: una lista nominal tendría
 * que dejar fuera a quien negó el permiso de asistencia, y entonces o el número
 * miente o esa persona acaba contada como visita. Y no toca `asistencias`: ir a
 * la célula no cuenta para «lleva N domingos sin venir».
 */

const aqui = (ministerioId: string, grupoId: string) => rutaApp(ministerioId, 'grupos', grupoId);

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

const Tema = z
  .string()
  .trim()
  .max(120, 'El tema, en 120 caracteres como mucho.')
  .optional();

const EsquemaReporte = z.discriminatedUnion('hubo', [
  z.object({
    hubo: z.literal('no'),
    semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tema: Tema,
  }),
  z.object({
    hubo: z.literal('si'),
    semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tema: Tema,
    asistentes: z.coerce
      .number({ message: '¿Cuántos de la célula vinieron? Un número.' })
      .int('¿Cuántos vinieron? Un número entero.')
      .min(0, '¿Cuántos vinieron? No puede ser menos de cero.')
      .max(500, 'Más de 500 no cabe en una reunión en una casa. Revisa la cifra.'),
    visitas: z.coerce
      .number({ message: '¿Cuántas visitas hubo? Un número.' })
      .int('¿Cuántas visitas? Un número entero.')
      .min(0, '¿Cuántas visitas? No puede ser menos de cero.')
      .max(200, 'Más de 200 visitas no cabe aquí. Revisa la cifra.'),
  }),
]);

/**
 * El reporte de una semana, en un toque: «hubo, vinieron 9 y 2 visitas, y se
 * habló de esto», o «no hubo reunión».
 *
 * Desde la semana de hace ocho hasta la actual (`esSemanaReportable`): ni una
 * semana que no ha llegado ni una de hace un año. Reportar otra vez la misma
 * semana la corrige: es la misma fila (`uq_grupo_semanas_semana`).
 */
export async function reportarSemana(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const destino = aqui(ministerioId, grupoId);
  const ctx = await requireGrupoAccion(ministerioId, grupoId, destino);

  const leido = EsquemaReporte.safeParse({
    hubo: campoObligatorio(formData, 'hubo'),
    semana: campoObligatorio(formData, 'semana'),
    tema: campo(formData, 'tema'),
    asistentes: campoObligatorio(formData, 'asistentes'),
    visitas: campo(formData, 'visitas') ?? '0',
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);
  const d = leido.data;

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  if (!esSemanaReportable(d.semana, hoy)) {
    volver('Esa semana ya no se puede reportar, o todavía no ha llegado.', destino);
  }

  const valores =
    d.hubo === 'si'
      ? {
          estado: 'celebrada' as const,
          asistentes: d.asistentes,
          visitas: d.visitas,
        }
      : { estado: 'no_hubo' as const, asistentes: null, visitas: null };
  const comun = {
    ...valores,
    tema: d.tema || null,
    reportadoPorMiembroId: ctx.miembroId,
    reportadoAt: new Date(),
  };

  await withUser(ctx.user.id, (tx) =>
    tx
      .insert(grupoSemanas)
      .values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        grupoId,
        semana: d.semana,
        ...comun,
      })
      .onConflictDoUpdate({
        target: [grupoSemanas.grupoId, grupoSemanas.semana],
        set: comun,
      }),
  );

  revalidatePath(destino);
  redirect(`${destino}?guardado=reporte`);
}

/**
 * Los temas de las próximas semanas, uno por semana.
 *
 * Solo las que ofrece la pantalla, que son las que todavía no han llegado.
 * Vacío quiere decir «el de la guía de la red», así que borra el propio; una
 * semana que alguien ya reportó no se toca: su tema es el del reporte.
 */
export async function guardarTemas(
  ministerioId: string,
  grupoId: string,
  formData: FormData,
) {
  const destino = rutaApp(ministerioId, 'grupos', grupoId, 'temas');
  const ctx = await requireGrupoAccion(ministerioId, grupoId, destino);

  const grupo = await obtenerGrupo(ctx, ministerioId, grupoId);
  if (!grupo) redirect(rutaApp(ministerioId));

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const semanas = proximasSemanas(grupo.diaSemana, hoy, SEMANAS_POR_DELANTE);

  const temas: { semana: string; tema: string | null }[] = [];
  for (const semana of semanas) {
    const leido = Tema.safeParse(campo(formData, `tema-${semana}`));
    if (!leido.success) volver(leido.error.issues[0]!.message, destino);
    temas.push({ semana, tema: leido.data || null });
  }

  await withUser(ctx.user.id, async (tx) => {
    for (const { semana, tema } of temas) {
      if (tema) {
        await tx
          .insert(grupoSemanas)
          .values({
            iglesiaId: ctx.iglesia.id,
            ministerioId,
            grupoId,
            semana,
            tema,
          })
          .onConflictDoUpdate({
            target: [grupoSemanas.grupoId, grupoSemanas.semana],
            set: { tema },
          });
      } else {
        await tx
          .delete(grupoSemanas)
          .where(
            and(
              eq(grupoSemanas.iglesiaId, ctx.iglesia.id),
              eq(grupoSemanas.grupoId, grupoId),
              eq(grupoSemanas.semana, semana),
              eq(grupoSemanas.estado, 'prevista'),
            ),
          );
      }
    }
  });

  revalidatePath(aqui(ministerioId, grupoId));
  redirect(`${aqui(ministerioId, grupoId)}?guardado=temas`);
}
