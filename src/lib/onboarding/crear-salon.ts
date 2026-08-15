import 'server-only';

import { randomBytes } from 'node:crypto';

import type { createAdminClient } from '@/lib/supabase/admin';
import { enviarEmailBienvenida } from '@/lib/email/resend';
import { HORARIOS_DEFAULT, SERVICIOS_POR_TIPO } from '@/lib/admin/salon-seeds';
import { enlazarPartnerSiAplica } from '@/lib/partners/enlazar-en-signup';

/**
 * Alta de un salón para un usuario que YA existe en `auth.users`, con trial de
 * 7 días y los seeds por defecto (servicios/horarios/profesional del dueño).
 *
 * Es el núcleo que comparten los TRES sitios que dan de alta un salón:
 *  - `signup` del panel web (email/contraseña).
 *  - `completarOnboarding` del panel web (tras Google OAuth).
 *  - `POST /api/panel-app/registro` (la app del negocio).
 *
 * Antes vivía duplicado en `(auth)/actions.ts` (dos copias idénticas). Al meter
 * el alta también en la app se extrajo aquí para que las tres puertas creen el
 * salón EXACTAMENTE igual y no diverjan (mismos seeds, mismo trial, mismo slug).
 *
 * NO crea el usuario de auth (eso lo hace cada caller: el panel/app con
 * `admin.createUser`, o Google por su cuenta) ni abre sesión ni redirige.
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Convierte un nombre humano ("Revolution Barber Shop") en un slug de URL
 * ("revolution-barber-shop"): sin acentos ni signos, solo [a-z0-9-], máx 40.
 */
function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar diacríticos (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

/**
 * Slug único a partir del nombre. Si el base está tomado prueba `base-2`..`base-99`
 * y luego un sufijo aleatorio. Devuelve null si el nombre normalizado queda vacío
 * (solo emojis, etc.) o si no se encuentra hueco.
 */
async function generarSlugUnico(
  admin: Admin,
  nombre: string,
): Promise<string | null> {
  const base = slugify(nombre);
  if (!base) return null;

  const { data: existe } = await admin
    .from('salones')
    .select('id')
    .eq('slug', base)
    .maybeSingle();
  if (!existe) return base;

  for (let i = 2; i <= 99; i++) {
    const candidato = `${base}-${i}`;
    const { data: occ } = await admin
      .from('salones')
      .select('id')
      .eq('slug', candidato)
      .maybeSingle();
    if (!occ) return candidato;
  }

  for (let intento = 0; intento < 5; intento++) {
    const candidato = `${base}-${randomBytes(2).toString('hex')}`;
    const { data: occ } = await admin
      .from('salones')
      .select('id')
      .eq('slug', candidato)
      .maybeSingle();
    if (!occ) return candidato;
  }

  return null;
}

export type CrearSalonResult =
  | { ok: true; salon: { id: string; slug: string }; slug: string }
  | { ok: false; error: string };

export async function crearSalonConSeeds(
  admin: Admin,
  opts: {
    authUserId: string;
    email: string | null;
    salonNombre: string;
    tipoNegocio: string;
  },
): Promise<CrearSalonResult> {
  const { authUserId, email, salonNombre, tipoNegocio } = opts;

  const salonSlug = await generarSlugUnico(admin, salonNombre);
  if (!salonSlug) {
    return {
      ok: false,
      error:
        'No pudimos generar una URL pública desde el nombre del salón. Prueba con un nombre con letras o números.',
    };
  }

  // Salón con trial de 7 días sin tarjeta. Se accede al panel de inmediato; el
  // upgrade a Stripe se hace después (web/app), no bloquea el alta.
  const trialUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: salon, error: salonError } = await admin
    .from('salones')
    .insert({
      slug: salonSlug,
      nombre: salonNombre,
      tipo_negocio: tipoNegocio,
      email,
      plan: 'trial',
      trial_until: trialUntil,
    })
    .select()
    .single();

  if (salonError || !salon) {
    return {
      ok: false,
      error: 'Error creando salón: ' + (salonError?.message || 'desconocido'),
    };
  }

  const { error: linkError } = await admin
    .from('usuarios_salon')
    .insert({ salon_id: salon.id, auth_user_id: authUserId, rol: 'dueno' });
  if (linkError) {
    return { ok: false, error: 'Error vinculando usuario: ' + linkError.message };
  }

  // Enlazar partner si el visitante aterrizó con ?ref=xxx. Best-effort.
  try {
    await enlazarPartnerSiAplica(salon.id);
  } catch (err) {
    console.warn('[crear-salon:partner] enlazar:', err);
  }

  // Seeds (no abortan el alta si fallan).
  try {
    const servicios = SERVICIOS_POR_TIPO[tipoNegocio] ?? SERVICIOS_POR_TIPO.otro;
    await admin.from('servicios').insert(
      servicios.map((sv) => ({
        salon_id: salon.id,
        nombre: sv.nombre,
        duracion_min: sv.duracion_min,
        precio_eur: sv.precio_eur,
        orden: sv.orden,
        es_default: true,
      })),
    );
  } catch (err) {
    console.warn('[crear-salon:seed] servicios:', err);
  }

  try {
    await admin.from('horarios').insert(
      HORARIOS_DEFAULT.map((h) => ({
        salon_id: salon.id,
        dia_semana: h.dia_semana,
        inicio: h.inicio,
        fin: h.fin,
        es_default: true,
      })),
    );
  } catch (err) {
    console.warn('[crear-salon:seed] horarios:', err);
  }

  try {
    // El profesional default se vincula al auth_user del dueño desde el primer
    // momento: así ya aparece como profesional y el panel muestra "Cuenta del
    // dueño". No se cobra seat por este profesional (es el propio dueño).
    await admin.from('profesionales').insert({
      salon_id: salon.id,
      nombre: salonNombre,
      color_hex: '#8B9D7A',
      orden: 0,
      es_default: true,
      auth_user_id: authUserId,
    });
  } catch (err) {
    console.warn('[crear-salon:seed] profesional:', err);
  }

  // Email de bienvenida. Best-effort.
  if (email) {
    try {
      await enviarEmailBienvenida({ to: email, salonNombre, salonSlug });
    } catch (err) {
      console.warn('[crear-salon:email]:', err);
    }
  }

  return { ok: true, salon: { id: salon.id, slug: salon.slug }, slug: salonSlug };
}
