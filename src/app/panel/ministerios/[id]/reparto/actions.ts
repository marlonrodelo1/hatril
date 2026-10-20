'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  exigirModulo,
  requireGestionMinisterioAccion,
} from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import {
  repartoBeneficiarios,
  repartoEntregas,
  repartoJornadas,
} from '@/lib/db/schema';
import { esGuardHatril, pgErrorCode } from '@/lib/db/error';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import { VERSION_CONSENTIMIENTO_REPARTO } from '@/lib/rgpd/consentimiento';
import { idsSinVenirDesde } from '@/lib/reparto/consultas';
import { haceUnAnio } from '@/lib/reparto/plazo';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * La puerta del reparto y su padrón.
 *
 * TRES PUERTAS EN CADA ACTION
 * ---------------------------
 *   1. `requireGestionMinisterioAccion(..., { desdeDentro: true })` — pastor, o
 *      responsable o colíder de ESTE equipo. Sin el camino de
 *      `gestionar_ministerios`: la RLS de la `0042` no le enseña el padrón a
 *      quien no está en el equipo, y la action no puede prometer más que ella.
 *   2. `exigirModulo(..., 'reparto')` — con el módulo apagado no se escribe,
 *      aunque el POST se fabrique a mano.
 *   3. La RLS por equipo, que es la que de verdad no se equivoca.
 *
 * LA PUERTA SOLO ESCRIBE EN EL REPARTO DE HOY
 * -------------------------------------------
 * Llegar, entregar, deshacer y quitar buscan la jornada de HOY en la iglesia
 * (`hoyEnLaIglesia`) y no reciben su id del formulario. Corregir un domingo
 * pasado no es cosa de la puerta, y así un id de otra jornada mandado a mano
 * no reescribe el historial del mes.
 */

const Id = z.string().uuid();

const EsquemaPersona = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Escribe cómo quiere que le llamen. Basta con un nombre.')
    .max(80, 'Ese nombre es demasiado largo.'),
  personas: z.coerce
    .number({ message: '¿Cuántas personas viven en su casa?' })
    .int('¿Cuántas personas viven en su casa? Un número entero.')
    .min(1, 'En su casa vive al menos una persona: quien viene.')
    .max(20, 'Más de 20 personas en una casa no cabe aquí. Si es un comedor o un albergue, apúntalo aparte.'),
  telefono: z.string().trim().max(32, 'Ese teléfono es demasiado largo.').optional(),
});

const hoy = (ministerioId: string) => `/panel/ministerios/${ministerioId}/reparto`;
const padron = (ministerioId: string) => `${hoy(ministerioId)}/padron`;

function volver(mensaje: string, destino: string, ancla = ''): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}${ancla}`);
}

async function guarda(ministerioId: string) {
  const ctx = await requireGestionMinisterioAccion(
    ministerioId,
    '/panel/ministerios',
    { desdeDentro: true },
  );
  await exigirModulo(ctx, ministerioId, 'reparto');
  return ctx;
}

function exigirId(id: string, destino: string): void {
  if (!Id.safeParse(id).success) volver('No encuentro a esa persona.', destino);
}

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/** El id del reparto de hoy de este equipo, o null si no se ha empezado. */
async function jornadaDeHoy(
  tx: Tx,
  ctx: UserContext,
  ministerioId: string,
): Promise<string | null> {
  const [fila] = await tx
    .select({ id: repartoJornadas.id })
    .from(repartoJornadas)
    .where(
      and(
        eq(repartoJornadas.iglesiaId, ctx.iglesia.id),
        eq(repartoJornadas.ministerioId, ministerioId),
        eq(repartoJornadas.fecha, hoyEnLaIglesia(ctx.iglesia.timezone)),
      ),
    )
    .limit(1);
  return fila?.id ?? null;
}

const SIN_JORNADA = 'Empieza primero el reparto de hoy.';

// ===========================================================================
// La puerta
// ===========================================================================

/**
 * Empezar el reparto de hoy. Pulsarlo dos veces no abre dos: el índice único
 * de (ministerio, fecha) se lo impide, y aquí se ignora en silencio.
 */
export async function empezarReparto(ministerioId: string) {
  const ctx = await guarda(ministerioId);

  await withUser(ctx.user.id, (tx) =>
    tx
      .insert(repartoJornadas)
      .values({
        iglesiaId: ctx.iglesia.id,
        ministerioId,
        fecha: hoyEnLaIglesia(ctx.iglesia.timezone),
        creadoPorMiembroId: ctx.miembroId,
      })
      .onConflictDoNothing(),
  );

  revalidatePath(hoy(ministerioId));
  redirect(`${hoy(ministerioId)}?guardado=empezado`);
}

/**
 * «Ha llegado»: entra en la cola de hoy.
 *
 * Si estaba de baja, se reactiva en el mismo paso. Quien se mudó y vuelve no
 * tiene por qué apuntarse de nuevo con otro número, y obligar al voluntario a
 * ir al padrón con la fila esperando es la forma de acabar con dos fichas.
 */
export async function marcarLlegada(ministerioId: string, beneficiarioId: string) {
  const ctx = await guarda(ministerioId);
  const base = hoy(ministerioId);
  exigirId(beneficiarioId, base);

  let resultado: 'ok' | 'sin-jornada';
  try {
    resultado = await withUser(ctx.user.id, async (tx) => {
      const jornadaId = await jornadaDeHoy(tx, ctx, ministerioId);
      if (!jornadaId) return 'sin-jornada';

      await tx
        .update(repartoBeneficiarios)
        .set({ bajaAt: null })
        .where(
          and(
            eq(repartoBeneficiarios.id, beneficiarioId),
            eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
            eq(repartoBeneficiarios.ministerioId, ministerioId),
            isNotNull(repartoBeneficiarios.bajaAt),
          ),
        );

      await tx
        .insert(repartoEntregas)
        .values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          jornadaId,
          beneficiarioId,
          registradoPorMiembroId: ctx.miembroId,
        })
        .onConflictDoNothing();

      return 'ok';
    });
  } catch (err) {
    if (esGuardHatril(err, 'HT126')) {
      volver('Esa persona no está en el padrón de este reparto.', base);
    }
    throw err;
  }

  if (resultado === 'sin-jornada') volver(SIN_JORNADA, base);

  revalidatePath(base);
  redirect(`${base}?guardado=llegada#cola`);
}

/**
 * «Entregado», desde el buscador: se le entrega aunque no se le hubiera marcado
 * la llegada. Pasar por «Ha llegado» primero es para cuando hay cola; si no la
 * hay, son dos toques donde basta uno.
 */
export async function entregarA(ministerioId: string, beneficiarioId: string) {
  const ctx = await guarda(ministerioId);
  const base = hoy(ministerioId);
  exigirId(beneficiarioId, base);

  let resultado: 'ok' | 'sin-jornada';
  try {
    resultado = await withUser(ctx.user.id, async (tx) => {
      const jornadaId = await jornadaDeHoy(tx, ctx, ministerioId);
      if (!jornadaId) return 'sin-jornada';

      // Primero la fila que ya estuviera —«ha llegado»— y, si no había, una
      // nueva ya entregada. En dos pasos y no con un upsert: el `set` de un
      // ON CONFLICT con una columna interpolada sale sin cualificar.
      const marcadas = await tx
        .update(repartoEntregas)
        .set({ entregado: true, entregadoAt: new Date() })
        .where(
          and(
            eq(repartoEntregas.jornadaId, jornadaId),
            eq(repartoEntregas.beneficiarioId, beneficiarioId),
            eq(repartoEntregas.entregado, false),
          ),
        )
        .returning({ id: repartoEntregas.id });

      if (marcadas.length === 0) {
        await tx
          .insert(repartoEntregas)
          .values({
            iglesiaId: ctx.iglesia.id,
            ministerioId,
            jornadaId,
            beneficiarioId,
            entregado: true,
            entregadoAt: new Date(),
            registradoPorMiembroId: ctx.miembroId,
          })
          // Ya estaba entregado: no hay nada que hacer.
          .onConflictDoNothing();
      }

      await tx
        .update(repartoBeneficiarios)
        .set({ bajaAt: null })
        .where(
          and(
            eq(repartoBeneficiarios.id, beneficiarioId),
            eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
            eq(repartoBeneficiarios.ministerioId, ministerioId),
            isNotNull(repartoBeneficiarios.bajaAt),
          ),
        );

      return 'ok';
    });
  } catch (err) {
    if (esGuardHatril(err, 'HT126')) {
      volver('Esa persona no está en el padrón de este reparto.', base);
    }
    throw err;
  }

  if (resultado === 'sin-jornada') volver(SIN_JORNADA, base);

  revalidatePath(base);
  redirect(`${base}?guardado=entregado#cola`);
}

/** Las tres acciones de una fila de la cola de hoy, por su id. */
type AccionDeFila = 'entregar' | 'deshacer' | 'quitar';

async function tocarFila(
  ministerioId: string,
  entregaId: string,
  accion: AccionDeFila,
): Promise<never> {
  const ctx = await guarda(ministerioId);
  const base = hoy(ministerioId);
  exigirId(entregaId, base);

  const tocadas = await withUser(ctx.user.id, async (tx) => {
    const jornadaId = await jornadaDeHoy(tx, ctx, ministerioId);
    if (!jornadaId) return -1;

    const deHoy = and(
      eq(repartoEntregas.id, entregaId),
      eq(repartoEntregas.iglesiaId, ctx.iglesia.id),
      eq(repartoEntregas.ministerioId, ministerioId),
      eq(repartoEntregas.jornadaId, jornadaId),
    );

    if (accion === 'quitar') {
      // Solo a quien todavía espera. A quien ya se le entregó, primero se
      // deshace: quitarlo de golpe borraría una entrega hecha de la cifra.
      const borradas = await tx
        .delete(repartoEntregas)
        .where(and(deHoy, eq(repartoEntregas.entregado, false)))
        .returning({ id: repartoEntregas.id });
      return borradas.length;
    }

    const entregar = accion === 'entregar';
    const cambiadas = await tx
      .update(repartoEntregas)
      .set({ entregado: entregar, entregadoAt: entregar ? new Date() : null })
      .where(and(deHoy, eq(repartoEntregas.entregado, !entregar)))
      .returning({ id: repartoEntregas.id });
    return cambiadas.length;
  });

  if (tocadas === -1) volver(SIN_JORNADA, base);

  revalidatePath(base);
  const guardado = { entregar: 'entregado', deshacer: 'deshecho', quitar: 'quitado' }[accion];
  redirect(`${base}?guardado=${guardado}#cola`);
}

export async function entregarFila(ministerioId: string, entregaId: string) {
  return tocarFila(ministerioId, entregaId, 'entregar');
}

export async function deshacerEntrega(ministerioId: string, entregaId: string) {
  return tocarFila(ministerioId, entregaId, 'deshacer');
}

export async function quitarDeLaCola(ministerioId: string, entregaId: string) {
  return tocarFila(ministerioId, entregaId, 'quitar');
}

/**
 * «Se lo llevó sin apuntarse», más uno o menos uno.
 *
 * Es lo que hace cumplible la regla de no condicionar la comida a los datos:
 * se entrega, se cuenta y no se apunta a nadie. El menos uno es para el dedo
 * que se equivocó, y no baja de cero.
 */
export async function contarSinApuntar(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const base = hoy(ministerioId);
  const delta = campo(formData, 'cambio') === 'menos' ? -1 : 1;

  let tocadas: number;
  try {
    tocadas = await withUser(ctx.user.id, async (tx) => {
      const filas = await tx
        .update(repartoJornadas)
        .set({
          sinInscribir: sql`greatest(${repartoJornadas.sinInscribir} + ${delta}, 0)`,
        })
        .where(
          and(
            eq(repartoJornadas.iglesiaId, ctx.iglesia.id),
            eq(repartoJornadas.ministerioId, ministerioId),
            eq(repartoJornadas.fecha, hoyEnLaIglesia(ctx.iglesia.timezone)),
          ),
        )
        .returning({ id: repartoJornadas.id });
      return filas.length;
    });
  } catch (err) {
    if (pgErrorCode(err) === '23514') {
      volver('Ese número ya no es creíble para un solo día. Revisa el contador.', base);
    }
    throw err;
  }

  if (tocadas === 0) volver(SIN_JORNADA, base);

  revalidatePath(base);
  redirect(`${base}?guardado=sin-apuntar`);
}

/**
 * Alta en la puerta: se apunta y, si el reparto de hoy está empezado, entra ya
 * en la cola. Todo en la misma transacción: un alta sin su llegada dejaría a la
 * persona apuntada y fuera de la fila que tiene delante.
 *
 * SIN LA CASILLA NO SE APUNTA, Y SE LE ENTREGA IGUAL
 * --------------------------------------------------
 * La casilla dice que el voluntario le leyó el aviso y que dijo que sí. Sin
 * ella no hay consentimiento y no se guarda nada: el mensaje manda al
 * contador de «sin apuntar», que es donde va quien no quiere dar sus datos.
 */
export async function apuntarEnLaPuerta(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const base = hoy(ministerioId);

  const leido = EsquemaPersona.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    personas: campoObligatorio(formData, 'personas'),
    telefono: campo(formData, 'telefono'),
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, base, '#alta');

  if (!casilla(formData, 'aviso')) {
    volver(
      'Sin su permiso no se le apunta. Puede llevarse la ayuda igual: súmalo en «Sin apuntar».',
      base,
      '#alta',
    );
  }

  const d = leido.data;
  const telefono = normalizarTelefono(d.telefono ?? null, ctx.iglesia.pais);

  let numero: number;
  try {
    numero = await withUser(ctx.user.id, async (tx) => {
      const [nueva] = await tx
        .insert(repartoBeneficiarios)
        .values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          nombre: d.nombre,
          personasHogar: d.personas,
          telefono: telefono && telefono.length <= 32 ? telefono : null,
          consentimientoVersion: VERSION_CONSENTIMIENTO_REPARTO,
          creadoPorMiembroId: ctx.miembroId,
        })
        .returning({ id: repartoBeneficiarios.id, numero: repartoBeneficiarios.numero });

      const jornadaId = await jornadaDeHoy(tx, ctx, ministerioId);
      if (jornadaId) {
        await tx.insert(repartoEntregas).values({
          iglesiaId: ctx.iglesia.id,
          ministerioId,
          jornadaId,
          beneficiarioId: nueva!.id,
          registradoPorMiembroId: ctx.miembroId,
        });
      }

      return nueva!.numero;
    });
  } catch (err) {
    if (esGuardHatril(err, 'HT126')) {
      volver('Ese reparto no es de tu iglesia.', base);
    }
    throw err;
  }

  revalidatePath(base);
  redirect(`${base}?apuntado=${numero}#cola`);
}

// ===========================================================================
// El padrón
// ===========================================================================

export async function editarPersona(
  ministerioId: string,
  beneficiarioId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${padron(ministerioId)}/${beneficiarioId}`;
  exigirId(beneficiarioId, padron(ministerioId));

  const leido = EsquemaPersona.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    personas: campoObligatorio(formData, 'personas'),
    telefono: campo(formData, 'telefono'),
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);

  const d = leido.data;
  const telefono = normalizarTelefono(d.telefono ?? null, ctx.iglesia.pais);

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(repartoBeneficiarios)
      .set({
        nombre: d.nombre,
        personasHogar: d.personas,
        telefono: telefono && telefono.length <= 32 ? telefono : null,
      })
      .where(
        and(
          eq(repartoBeneficiarios.id, beneficiarioId),
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(padron(ministerioId));
  redirect(`${destino}?guardado=editado`);
}

/** Dar de baja o reactivar. La baja no borra: para eso está el botón de abajo. */
export async function cambiarBaja(
  ministerioId: string,
  beneficiarioId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${padron(ministerioId)}/${beneficiarioId}`;
  exigirId(beneficiarioId, padron(ministerioId));
  const darDeBaja = campo(formData, 'baja') === '1';

  await withUser(ctx.user.id, (tx) =>
    tx
      .update(repartoBeneficiarios)
      .set({ bajaAt: darDeBaja ? new Date() : null })
      .where(
        and(
          eq(repartoBeneficiarios.id, beneficiarioId),
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
        ),
      ),
  );

  revalidatePath(padron(ministerioId));
  redirect(`${destino}?guardado=${darDeBaja ? 'baja' : 'reactivado'}`);
}

/**
 * Borrar a una persona del padrón: el derecho de supresión, desde el primer
 * día y sin escribir a nadie.
 *
 * Se lleva su nombre, su teléfono, su número y el registro de su permiso. Sus
 * entregas pasadas se quedan, sin nadie detrás (ON DELETE SET NULL, `0041`):
 * las entregas de un mes ya dado al banco de alimentos no cambian. Lo único
 * que baja es «hogares distintos», y la pantalla lo dice antes de borrar.
 */
export async function borrarPersona(
  ministerioId: string,
  beneficiarioId: string,
  formData: FormData,
) {
  const ctx = await guarda(ministerioId);
  const destino = `${padron(ministerioId)}/${beneficiarioId}`;
  exigirId(beneficiarioId, padron(ministerioId));

  if (!casilla(formData, 'confirmar')) {
    volver('Marca la casilla para confirmar que quieres borrarla.', destino, '#borrar');
  }

  const borradas = await withUser(ctx.user.id, (tx) =>
    tx
      .delete(repartoBeneficiarios)
      .where(
        and(
          eq(repartoBeneficiarios.id, beneficiarioId),
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
        ),
      )
      .returning({ id: repartoBeneficiarios.id }),
  );

  if (borradas.length === 0) volver('No encuentro a esa persona.', padron(ministerioId));

  revalidatePath(padron(ministerioId));
  revalidatePath(hoy(ministerioId));
  redirect(`${padron(ministerioId)}?guardado=borrado`);
}

/**
 * Borrar de una vez a quien lleva más de un año sin venir.
 *
 * Es el plazo que el aviso de la puerta promete y no lo cumple ninguna tarea
 * automática: lo cumple este botón (ver `haceUnAnio`). La lista se calcula de
 * nuevo DENTRO de la transacción del borrado, y si no coincide con la cifra que
 * la pantalla enseñó —alguien volvió, o pasó la medianoche— no se borra nada:
 * la confirmación fue sobre otro número.
 */
export async function borrarSinVenir(ministerioId: string, formData: FormData) {
  const ctx = await guarda(ministerioId);
  const destino = padron(ministerioId);

  if (!casilla(formData, 'confirmar')) {
    volver('Marca la casilla para confirmar el borrado.', destino);
  }
  const vistos = Number(campo(formData, 'cuantos') ?? '-1');
  const corte = haceUnAnio(hoyEnLaIglesia(ctx.iglesia.timezone));

  const resultado = await withUser(ctx.user.id, async (tx) => {
    const ids = await idsSinVenirDesde(tx, ctx, ministerioId, corte);
    if (ids.length !== vistos) return 'cambio' as const;
    if (ids.length === 0) return 'nada' as const;

    await tx
      .delete(repartoBeneficiarios)
      .where(
        and(
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
          inArray(repartoBeneficiarios.id, ids),
        ),
      );
    return 'ok' as const;
  });

  if (resultado === 'cambio') {
    volver('La lista ha cambiado desde que la viste. Revisa la cifra y vuelve a pulsar.', destino);
  }
  if (resultado === 'nada') volver('No hay nadie que lleve más de un año sin venir.', destino);

  revalidatePath(destino);
  redirect(`${destino}?guardado=borrados`);
}
