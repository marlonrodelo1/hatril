'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireGestionMinisterioAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { asistencias, ministerios, reuniones } from '@/lib/db/schema';
import { esGuardHatril } from '@/lib/db/error';
import { listaDelEquipo } from '@/lib/asistencia/consultas';
import { campo, campoObligatorio, campos } from '@/lib/api/formulario';
import { sumarDias } from '@/lib/agenda/horarios';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { SEMANAS_MAXIMAS } from './constantes';

/**
 * La agenda de un ministerio: ensayos, clases, salidas.
 *
 * EL GUARD ES EL DEL MINISTERIO, NO `registrar_asistencia`
 * --------------------------------------------------------
 * Y es deliberado. `registrar_asistencia` abre el histórico de la congregación
 * ENTERA, que es lo más sensible que guarda la plataforma. Esto es otra cosa:
 * quién de tu propio equipo vino al ensayo del jueves, sobre gente cuya ficha el
 * responsable ya ve por serlo.
 *
 * Pedir el permiso global aquí obligaría al pastor a dárselo al líder de
 * alabanza para que pudiera apuntar sus ensayos, y con él se llevaría de propina
 * quién falta al culto en toda la iglesia. Cruzar los dos ejes por comodidad es
 * exactamente lo que `permisos.ts` existe para evitar.
 *
 * Además, un ensayo NO cuenta para `ultima_asistencia`: lo garantiza el trigger
 * de la `0030`, que solo mira las reuniones con `ministerio_id is null`.
 */

const EsquemaReunion = z.object({
  titulo: z
    .string()
    .trim()
    .min(2, 'Ponle un nombre.')
    .max(120, 'Ese nombre es demasiado largo.'),
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisa la fecha.'),
  hora: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Revisa la hora.')
    .optional()
    .or(z.literal('')),
  lugar: z.string().trim().max(160).optional().or(z.literal('')),
  notas: z.string().trim().max(2000).optional().or(z.literal('')),
});

/**
 * «Repetir cada semana durante N semanas», solo al crear.
 *
 * Fuera de `EsquemaReunion` porque editar no lo lleva: una reunión ya creada es
 * una sola, y cambiarla no reparte cambios a sus hermanas. Sale del formulario
 * como texto de un desplegable, de ahí el `coerce`.
 */
const EsquemaSemanas = z.coerce
  .number()
  .int('Revisa cuántas semanas.')
  .min(1, 'Revisa cuántas semanas.')
  .max(SEMANAS_MAXIMAS, `Como mucho, ${SEMANAS_MAXIMAS} semanas de una vez.`);

function oNulo(v: string | undefined): string | null {
  const limpio = v?.trim();
  return limpio ? limpio : null;
}

function leer(formData: FormData) {
  return EsquemaReunion.safeParse({
    titulo: campoObligatorio(formData, 'titulo'),
    fecha: campoObligatorio(formData, 'fecha'),
    hora: campo(formData, 'hora'),
    lugar: campo(formData, 'lugar'),
    notas: campo(formData, 'notas'),
  });
}

function volver(mensaje: string, destino: string): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

const agenda = (ministerioId: string) =>
  `/panel/ministerios/${ministerioId}/agenda`;

export async function crearReunionDeMinisterio(
  ministerioId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = agenda(ministerioId);

  const parsed = leer(formData);
  if (!parsed.success) volver(parsed.error.issues[0]!.message, `${base}/nueva`);

  const d = parsed.data;

  const semanas = EsquemaSemanas.safeParse(campo(formData, 'semanas') ?? '1');
  if (!semanas.success) volver(semanas.error.issues[0]!.message, `${base}/nueva`);

  // Filas reales, una por semana, y no una regla que se pinte al vuelo como el
  // horario del culto: de cada ensayo cuelga su lista del equipo, y el de una
  // semana suelta se cambia o se borra sin tocar los demás.
  const hora = oNulo(d.hora);
  const fechas = Array.from({ length: semanas.data }, (_, i) => sumarDias(d.fecha, 7 * i));

  let resultado:
    | { tipo: 'apagada' }
    | { tipo: 'ocupadas' }
    | { tipo: 'ya-estaba' }
    | { tipo: 'creadas'; ids: string[]; saltadas: number };
  try {
    resultado = await withUser(ctx.user.id, async (tx) => {
      // La agenda encendida se mira aquí, en la misma lectura que el cerrojo.
      // Cuando se fusione la tanda 1 la mirará también `exigirModulo()` en la
      // puerta, como al resto de actions del fichero; esta se puede quedar, que
      // no cuesta otra consulta.
      const ministerio = await cerrojoDeLaAgenda(tx, ctx.iglesia.id, ministerioId);
      if (!ministerio || !tieneModulo(ministerio.modulos, 'agenda')) {
        return { tipo: 'apagada' as const };
      }

      const ocupadas = await fechasOcupadas(tx, ctx.iglesia.id, ministerioId, fechas, hora);
      const libres = fechas.filter((f) => !ocupadas.has(f));

      if (libres.length === 0) {
        // Si lo que ocupa esas semanas es esto mismo, no es un choque: es el
        // segundo clic de un doble clic, que ha esperado al cerrojo y llega
        // cuando el primero ya lo apuntó todo. Se vio así: las cuatro filas
        // bien creadas y en pantalla «no se ha creado nada», que es la
        // respuesta de la petición que acaba la última.
        const loMismo = fechas.every((f) => ocupadas.get(f)!.has(d.titulo));
        return { tipo: loMismo ? ('ya-estaba' as const) : ('ocupadas' as const) };
      }

      const creadas = await tx
        .insert(reuniones)
        .values(
          libres.map((fecha) => ({
            iglesiaId: ctx.iglesia.id,
            ministerioId,
            titulo: d.titulo,
            fecha,
            hora,
            lugar: oNulo(d.lugar),
            notas: oNulo(d.notas),
            creadoPorMiembroId: ctx.miembroId,
          })),
        )
        .returning({ id: reuniones.id });

      return {
        tipo: 'creadas' as const,
        ids: creadas.map((c) => c.id),
        saltadas: fechas.length - libres.length,
      };
    });
  } catch (err) {
    // El guard de la aplicación ya comprueba que este ministerio es suyo, así
    // que HT116 aquí solo salta si alguien manda un uuid de otra iglesia a mano.
    // Se traduce igual: un 500 en pantalla no le dice nada a nadie.
    if (esGuardHatril(err, 'HT116')) {
      volver('Ese ministerio no es de tu iglesia.', base);
    }
    throw err;
  }

  if (resultado.tipo === 'apagada') {
    volver(
      'Esa herramienta no está encendida en este ministerio.',
      `/panel/ministerios/${ministerioId}`,
    );
  }
  if (resultado.tipo === 'ocupadas') {
    volver(
      semanas.data === 1
        ? 'Ese día a esa hora ya hay algo apuntado en la agenda del equipo.'
        : 'Todas esas semanas ya tienen algo apuntado a esa hora. No se ha creado nada.',
      `${base}/nueva`,
    );
  }

  revalidatePath(base);
  if (resultado.tipo === 'ya-estaba') redirect(`${base}?guardado=ya-estaba`);
  if (semanas.data === 1) redirect(`${base}/${resultado.ids[0]}?guardado=creada`);
  // A la lista y no a una ficha: hay varias, y lo que hay que ver es que estén.
  redirect(
    `${base}?guardado=semanas&creadas=${resultado.ids.length}&saltadas=${resultado.saltadas}`,
  );
}

export async function editarReunionDeMinisterio(
  ministerioId: string,
  reunionId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = agenda(ministerioId);

  const parsed = leer(formData);
  if (!parsed.success) {
    volver(parsed.error.issues[0]!.message, `${base}/${reunionId}/editar`);
  }

  const d = parsed.data;
  const hora = oNulo(d.hora);

  // Mover un ensayo encima de otro es la otra forma de duplicarlo, así que va
  // con el mismo cerrojo y la misma comprobación que al crear.
  const resultado = await withUser(ctx.user.id, async (tx) => {
    const ministerio = await cerrojoDeLaAgenda(tx, ctx.iglesia.id, ministerioId);
    // Igual que al crear: pasará a `exigirModulo()` con la tanda 1.
    if (!ministerio || !tieneModulo(ministerio.modulos, 'agenda')) return 'apagada';

    const ocupadas = await fechasOcupadas(
      tx,
      ctx.iglesia.id,
      ministerioId,
      [d.fecha],
      hora,
      reunionId,
    );
    if (ocupadas.size > 0) return 'ocupada';

    await tx
      .update(reuniones)
      .set({
        titulo: d.titulo,
        fecha: d.fecha,
        hora,
        lugar: oNulo(d.lugar),
        notas: oNulo(d.notas),
      })
      .where(
        and(
          eq(reuniones.id, reunionId),
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          // El tercer cinturón, y aquí sí hace falta: sin él, el responsable de
          // alabanza podría editar el ensayo de niños mandando su uuid a mano.
          // La RLS no lo para —las dos filas son de su iglesia— y el guard de
          // arriba solo ha comprobado el ministerio de la URL.
          eq(reuniones.ministerioId, ministerioId),
        ),
      );
    return 'guardada';
  });

  if (resultado === 'apagada') {
    volver(
      'Esa herramienta no está encendida en este ministerio.',
      `/panel/ministerios/${ministerioId}`,
    );
  }
  if (resultado === 'ocupada') {
    volver(
      'Ese día a esa hora ya hay otra cosa apuntada en la agenda del equipo.',
      `${base}/${reunionId}/editar`,
    );
  }

  revalidatePath(base);
  redirect(`${base}/${reunionId}?guardado=editada`);
}

/**
 * Quién del equipo vino. Solo alcanza al equipo, nunca a la congregación.
 *
 * Las filas salen de `listaDelEquipo()` y NO de los uuid que trae el
 * formulario, igual que en `guardarLista` de las reuniones. Es lo que hace que
 * el permiso de asistencia valga también aquí: quien lo negó no está en esa
 * lista, así que su uuid colado en un POST fabricado no encuentra fila que
 * escribir — ni «vino» ni «no vino», que también es un dato suyo.
 *
 * Y la reunión tiene que ser de ESTE ministerio. Sin eso, un colíder mandaba el
 * uuid del culto del domingo y reescribía la asistencia de su equipo en ese
 * culto —con `ultima_asistencia` detrás— sin tener `registrar_asistencia`. Se
 * comprueba dos veces, y no sobra ninguna: ver los comentarios de abajo.
 */
export async function guardarListaDelEquipo(
  ministerioId: string,
  reunionId: string,
  formData: FormData,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const destino = `${agenda(ministerioId)}/${reunionId}`;

  const presentes = new Set(campos(formData, 'presentes'));
  const equipo = await listaDelEquipo(ctx, reunionId, ministerioId);

  // Vacía no quiere decir solo «equipo sin gente»: también sale así si todos
  // los que hay negaron el permiso, o si la reunión no es de este ministerio
  // —`listaDelEquipo` cruza las dos cosas—. De ahí que el mensaje no diga cuál
  // es: decir que el equipo está vacío sería falso en los otros dos casos.
  if (equipo.length === 0) {
    volver('No hay nadie en este equipo a quien pasar lista.', destino);
  }

  const filas = equipo.map((p) => ({
    iglesiaId: ctx.iglesia.id,
    reunionId,
    miembroId: p.miembroId,
    presente: presentes.has(p.miembroId),
    origen: 'panel' as const,
    registradoPorMiembroId: ctx.miembroId,
  }));

  let esDelMinisterio = false;
  try {
    esDelMinisterio = await withUser(ctx.user.id, async (tx) => {
      // Otra vez el cruce, ahora en la MISMA transacción que escribe. El de
      // `listaDelEquipo` corrió en otra, y entre las dos nada en la base congela
      // `reuniones.ministerio_id`: HT117 (0030) solo congela `iglesia_id`. La
      // comprobación que de verdad protege la escritura es la que va con ella.
      const [reunion] = await tx
        .select({ id: reuniones.id })
        .from(reuniones)
        .where(
          and(
            eq(reuniones.id, reunionId),
            eq(reuniones.iglesiaId, ctx.iglesia.id),
            eq(reuniones.ministerioId, ministerioId),
          ),
        )
        .limit(1);

      if (!reunion) return false;

      await tx
        .insert(asistencias)
        .values(filas)
        .onConflictDoUpdate({
          target: [asistencias.reunionId, asistencias.miembroId],
          set: {
            presente: sql`excluded.presente`,
            origen: sql`excluded.origen`,
            registradoPorMiembroId: sql`excluded.registrado_por_miembro_id`,
          },
        });

      return true;
    });
  } catch (err) {
    if (esGuardHatril(err, 'HT116')) {
      volver('Esa reunión o esa persona no son de tu iglesia.', destino);
    }
    throw err;
  }

  // Al listado y no a `destino`: la ficha de una reunión ajena da 404.
  if (!esDelMinisterio) {
    volver('Esa reunión no es de este ministerio.', agenda(ministerioId));
  }

  // Sin `revalidatePath('/panel/miembros')`, al revés que la lista del culto:
  // un ensayo no toca `ultima_asistencia`, así que la ficha de nadie cambia.
  revalidatePath(agenda(ministerioId));
  redirect(`${destino}?guardado=lista`);
}

export async function borrarReunionDeMinisterio(
  ministerioId: string,
  reunionId: string,
) {
  const ctx = await requireGestionMinisterioAccion(ministerioId);
  const base = agenda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(reuniones)
      .where(
        and(
          eq(reuniones.id, reunionId),
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          eq(reuniones.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(base);
  redirect(`${base}?guardado=borrada`);
}

/*
 * NO DUPLICAR UN ENSAYO SIN UN ÍNDICE ÚNICO
 * -----------------------------------------
 * Lo que de verdad lo blindaría es un índice único parcial en `reuniones`:
 *
 *   unique (ministerio_id, fecha, hora) nulls not distinct
 *     where ministerio_id is not null
 *
 * Y eso es una migración, que en esta tanda no se puede hacer: la base es una
 * sola y la comparten varias ramas a la vez. ES DEUDA, y va con la próxima
 * migración que toque `reuniones`. Antes de crearlo hay que buscar duplicados
 * en la base, o la migración se cae a medias.
 *
 * Mientras tanto lo para la aplicación, con dos piezas que solo valen juntas:
 *
 *   1. El cerrojo. Con un doble clic llegan dos peticiones casi a la vez, y
 *      comprobar «¿ya hay algo ese día?» no basta: con READ COMMITTED las dos
 *      leen antes de que ninguna escriba, las dos ven el hueco libre y las dos
 *      insertan. Bloquear la fila del ministerio pone a la segunda a esperar a
 *      que la primera termine, y entonces ya ve lo que escribió.
 *   2. La comprobación, en la MISMA transacción que escribe. Fuera de ella el
 *      cerrojo ya se habría soltado.
 *
 * El cerrojo es `for no key update` y no `for update`: este segundo choca con
 * el `for key share` con que Postgres comprueba cada clave foránea, y dejaría
 * esperando a cualquiera que asigne un turno o apunte a alguien al equipo
 * mientras dura esta transacción. Entre dos `no key update`, en cambio, sí hay
 * espera, que es lo único que hace falta aquí.
 *
 * Lo que la aplicación no puede parar es una fila escrita por otro camino —un
 * script, el editor de Supabase—. Eso solo lo hace el índice.
 */

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/** Bloquea la agenda del equipo hasta el final de la transacción. */
async function cerrojoDeLaAgenda(
  tx: Tx,
  iglesiaId: string,
  ministerioId: string,
): Promise<{ modulos: unknown } | null> {
  const [fila] = await tx
    .select({ modulos: ministerios.modulos })
    .from(ministerios)
    .where(and(eq(ministerios.id, ministerioId), eq(ministerios.iglesiaId, iglesiaId)))
    .for('no key update');
  return fila ?? null;
}

/**
 * De estas fechas, cuáles tienen ya algo de este equipo a esa misma hora, y con
 * qué títulos.
 *
 * «Misma hora» con las mismas reglas que tendrá el índice: dos sin hora el
 * mismo día también chocan (`nulls not distinct`). Y nada más: el título no
 * decide si chocan, porque un «Ensayo» y un «Ensayo general» a la misma hora
 * del mismo equipo no son dos cosas a las que se pueda ir. Se devuelve solo
 * para distinguir el choque de verdad del doble clic.
 */
async function fechasOcupadas(
  tx: Tx,
  iglesiaId: string,
  ministerioId: string,
  fechas: string[],
  hora: string | null,
  excepto?: string,
): Promise<Map<string, Set<string>>> {
  const filas = await tx
    .select({ fecha: reuniones.fecha, hora: reuniones.hora, titulo: reuniones.titulo })
    .from(reuniones)
    .where(
      and(
        eq(reuniones.iglesiaId, iglesiaId),
        eq(reuniones.ministerioId, ministerioId),
        inArray(reuniones.fecha, fechas),
        excepto ? ne(reuniones.id, excepto) : undefined,
      ),
    );

  const ocupadas = new Map<string, Set<string>>();
  for (const f of filas) {
    // Postgres devuelve `19:30:00` y el formulario manda `19:30`.
    if ((f.hora?.slice(0, 5) ?? null) !== hora) continue;
    ocupadas.set(f.fecha, (ocupadas.get(f.fecha) ?? new Set()).add(f.titulo));
  }
  return ocupadas;
}
