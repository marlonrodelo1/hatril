'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { withUser } from '@/lib/db';
import { ninoConsentimientos, ninoFamilias, ninos, ninosSolicitudes } from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { VERSION_TEXTOS_NINOS } from '@/lib/rgpd/consentimiento';
import { ministeriosConTablon } from '@/lib/ninos/familia';
import { avisarSinFotos, avisarSolicitud } from '@/lib/ninos/avisos';

/**
 * Lo que hace una familia con sus hijos en el ministerio de Niños: pedir el
 * vínculo, retirarlo, dar o quitar el permiso de fotos y desvincularse.
 *
 * Las llama la app (`movil/`), a través de `POST /api/v1/app/accion`
 * (`src/lib/api/acciones-app.ts`). En la web no hay pantalla: lo de los padres
 * va solo en la app (`plan-ninos.md` §6).
 *
 * LA BASE ES LA QUE MANDA
 * -----------------------
 * Cada escritura va por `withUser()`, y la RLS de la `0060` solo deja a cada
 * cual lo suyo: pedir para sí misma (no en nombre de otro adulto), dar
 * permisos sobre un hijo al que está vinculada, retirar los suyos y romper su
 * propio vínculo. Lo de aquí son las comprobaciones con el motivo en
 * palabras; si fallaran, la base diría que no igual.
 */

const Id = z.string().uuid();
const DESTINO = '/mi/hijos';

function volver(mensaje: string, destino = DESTINO): never {
  redirect(`${destino}?error=${encodeURIComponent(mensaje)}`);
}

function hecho(clave: string): never {
  revalidatePath(DESTINO);
  redirect(`${DESTINO}?guardado=${clave}`);
}

/** La prueba del art. 7.1: desde dónde y con qué se dio el permiso. */
async function evidencia(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const candidata = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim();
  return {
    ip: candidata && /^[0-9a-fA-F:.]+$/.test(candidata) ? candidata.slice(0, 64) : null,
    userAgent: h.get('user-agent')?.slice(0, 512) ?? null,
  };
}

async function guarda() {
  const ctx = await requireIglesiaAccion();
  // Dar datos de un hijo pide haber aceptado la política de la iglesia en su
  // versión de ahora: es lo que hace de esta persona alguien de la iglesia.
  await exigirConsentimientoAlDia(ctx);
  if (!ctx.miembroId) {
    volver('Tu cuenta todavía no tiene ficha en la iglesia. Pídele a tu iglesia que te dé de alta en su fichero.');
  }
  return { ctx, yo: ctx.miembroId };
}

const EsquemaPeticion = z.object({
  ministerio: Id,
  nombre: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre con el que llamáis a tu hijo o hija.')
    .max(60, 'Ese nombre es demasiado largo.'),
  anio: z.coerce
    .number({ message: '¿En qué año nació?' })
    .int('¿En qué año nació? Un año, como 2019.'),
  parentesco: z.enum(['madre', 'padre', 'tutor_legal'], {
    message: 'Elige si eres su madre, su padre o su tutor legal.',
  }),
});

/** «Tengo un hijo en Niños». Queda pendiente hasta que la responsable lo acepte. */
export async function pedirVinculo(formData: FormData) {
  const destino = `${DESTINO}/pedir`;
  const { ctx, yo } = await guarda();

  const leido = EsquemaPeticion.safeParse({
    ministerio: campoObligatorio(formData, 'ministerio'),
    nombre: campoObligatorio(formData, 'nombre'),
    anio: campo(formData, 'anio'),
    parentesco: campoObligatorio(formData, 'parentesco'),
  });
  if (!leido.success) volver(leido.error.issues[0]!.message, destino);
  const d = leido.data;

  if (!casilla(formData, 'vinculo')) {
    volver('Para pedirlo hace falta marcar la primera casilla: que eres su madre, su padre o su tutor, y que lo autorizas.', destino);
  }

  const este = new Date().getUTCFullYear();
  if (d.anio > este || d.anio < este - 13) {
    volver('El ministerio de Niños es para niños de hasta 13 años.', destino);
  }

  const ministerio = (await ministeriosConTablon(ctx)).find((m) => m.id === d.ministerio);
  if (!ministerio) volver('Ese ministerio no tiene el tablón de familias encendido.', destino);

  const { ip, userAgent } = await evidencia();
  try {
    await withUser(ctx.user.id, (tx) =>
      tx.insert(ninosSolicitudes).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId: ministerio.id,
        miembroId: yo,
        nombre: d.nombre,
        anioNacimiento: d.anio,
        parentesco: d.parentesco,
        permisoImagen: casilla(formData, 'imagen'),
        versionTexto: VERSION_TEXTOS_NINOS,
        ip,
        userAgent,
      }),
    );
  } catch (err) {
    if (isUniqueViolation(err)) volver('Ya lo habías pedido. Espera a que la responsable lo acepte.', destino);
    if (esGuardHatril(err, 'HT142')) volver('El ministerio de Niños es para niños de hasta 13 años.', destino);
    throw err;
  }

  await avisarSolicitud({
    iglesiaId: ctx.iglesia.id,
    ministerioId: ministerio.id,
    ministerio: ministerio.nombre,
    quien: nombreDeLaCuenta(ctx.user, 'Una familia'),
    provocadoPor: ctx.user.id,
  });

  hecho('pedido');
}

/** Retirar una petición que todavía no se ha resuelto. */
export async function retirarSolicitud(solicitudId: string) {
  if (!Id.safeParse(solicitudId).success) volver('No encuentro esa petición.');
  const { ctx, yo } = await guarda();

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(ninosSolicitudes)
      .where(
        and(
          eq(ninosSolicitudes.id, solicitudId),
          eq(ninosSolicitudes.iglesiaId, ctx.iglesia.id),
          eq(ninosSolicitudes.miembroId, yo),
        ),
      ),
  );

  hecho('retirada');
}

/** Dar ahora el permiso de fotos que no se dio al pedir. */
export async function darPermisoFotos(ninoId: string) {
  if (!Id.safeParse(ninoId).success) volver('No encuentro a ese niño.');
  const { ctx, yo } = await guarda();
  const { ip, userAgent } = await evidencia();

  try {
    await withUser(ctx.user.id, async (tx) => {
      const [vinculo] = await tx
        .select({ ministerioId: ninoFamilias.ministerioId })
        .from(ninoFamilias)
        .where(
          and(
            eq(ninoFamilias.iglesiaId, ctx.iglesia.id),
            eq(ninoFamilias.ninoId, ninoId),
            eq(ninoFamilias.miembroId, yo),
          ),
        )
        .limit(1);
      if (!vinculo) volver('No estás vinculado a ese niño.');

      await tx.insert(ninoConsentimientos).values({
        iglesiaId: ctx.iglesia.id,
        ministerioId: vinculo.ministerioId,
        ninoId,
        miembroId: yo,
        tipo: 'imagen',
        versionTexto: VERSION_TEXTOS_NINOS,
        ip,
        userAgent,
      });
    });
  } catch (err) {
    // Ya lo tenía: doble toque, u otra pestaña.
    if (isUniqueViolation(err)) hecho('fotos-si');
    throw err;
  }

  hecho('fotos-si');
}

/**
 * Quitar el permiso de fotos. Desde ahora no sale en fotos nuevas, y se avisa
 * a la responsable para que quite las ya publicadas en las que salga: Hatril
 * no sabe quién sale en cada foto (`ninos-textos.md` §2).
 */
export async function quitarPermisoFotos(ninoId: string) {
  if (!Id.safeParse(ninoId).success) volver('No encuentro a ese niño.');
  const { ctx, yo } = await guarda();

  const retirado = await withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .update(ninoConsentimientos)
      .set({ revocadoAt: new Date() })
      .where(
        and(
          eq(ninoConsentimientos.iglesiaId, ctx.iglesia.id),
          eq(ninoConsentimientos.ninoId, ninoId),
          eq(ninoConsentimientos.miembroId, yo),
          eq(ninoConsentimientos.tipo, 'imagen'),
          isNull(ninoConsentimientos.revocadoAt),
        ),
      )
      .returning({ ministerioId: ninoConsentimientos.ministerioId });
    if (filas.length === 0) return null;
    const [nino] = await tx.select({ nombre: ninos.nombre }).from(ninos).where(eq(ninos.id, ninoId)).limit(1);
    return { ministerioId: filas[0]!.ministerioId, nombre: nino?.nombre ?? '' };
  });

  if (retirado) {
    await avisarSinFotos({
      iglesiaId: ctx.iglesia.id,
      ministerioId: retirado.ministerioId,
      nino: retirado.nombre,
      provocadoPor: ctx.user.id,
    });
  }

  hecho('fotos-no');
}

/**
 * Dejar de ver lo de Niños de este hijo. Se retiran mis permisos sobre él, y
 * si nadie más de su familia está vinculado, se borran su nombre y su año
 * (`al_romper_vinculo_nino`, `0060`).
 */
export async function desvincularme(ninoId: string) {
  if (!Id.safeParse(ninoId).success) volver('No encuentro a ese niño.');
  const { ctx, yo } = await guarda();

  await withUser(ctx.user.id, (tx) =>
    tx
      .delete(ninoFamilias)
      .where(
        and(
          eq(ninoFamilias.iglesiaId, ctx.iglesia.id),
          eq(ninoFamilias.ninoId, ninoId),
          eq(ninoFamilias.miembroId, yo),
        ),
      ),
  );

  hecho('desvinculado');
}
