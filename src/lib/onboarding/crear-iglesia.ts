import 'server-only';

import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import {
  consentimientos,
  iglesias,
  iglesiaUsuarios,
  miembros,
  ministerios,
} from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import { componerModulos } from '@/lib/ministerios/modulos';
import { modulosDelTipo } from '@/lib/ministerios/tipos';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';

/**
 * Alta de una iglesia para un usuario que YA existe en `auth.users`.
 *
 * Es el núcleo único que comparten todas las puertas de registro (email y
 * contraseña, y más adelante Google). Gonper aprendió esto por las malas: tenía
 * el alta duplicada en dos sitios de `(auth)/actions.ts` y las copias
 * divergieron.
 *
 * POR QUÉ `dbAdmin` Y NO `withUser`
 * ---------------------------------
 * Aquí no hay a quién suplantar todavía. Las policies preguntan por
 * `iglesia_usuarios`, y en este preciso momento esa fila es justo lo que
 * estamos creando: con `withUser` la primera consulta no vería nada y el alta
 * sería imposible. Es la excepción legítima, y por eso está aislada en esta
 * función en vez de repartida por las rutas.
 *
 * TODO O NADA
 * -----------
 * Va entero en una transacción. Gonper hace los seeds «best-effort» y, si algo
 * falla a media faena, deshace borrando el usuario de auth desde la aplicación.
 * Eso deja huecos: si el proceso muere entre el insert y el rollback, queda un
 * salón a medias que nadie reclama. Aquí o se crea todo o no se crea nada, y de
 * eso se encarga Postgres.
 */

/**
 * Los cuatro ministerios que casi toda congregación tiene el primer día.
 *
 * Cada uno con su tipo, que es lo que decide qué herramientas trae encendidas
 * (`src/lib/ministerios/tipos.ts`). Sin tipo caerían en «Otro» y el pastor
 * tendría que entrar en los cuatro a configurarlos antes de poder usarlos: la
 * iglesia arrancaría con el panel vacío, que es justo lo que esta semilla existe
 * para evitar.
 */
const MINISTERIOS_SEMILLA = [
  { nombre: 'Alabanza', tipo: 'alabanza', colorHex: '#BD4715', orden: 1 },
  { nombre: 'Jóvenes', tipo: 'jovenes', colorHex: '#2F5D50', orden: 2 },
  { nombre: 'Niños', tipo: 'ninos', colorHex: '#B58A2B', orden: 3 },
  { nombre: 'Intercesión', tipo: 'intercesion', colorHex: '#6B645C', orden: 4 },
] as const;

const DIAS_TRIAL = 7;

/**
 * Convierte un nombre ("Iglesia Cristiana Betania") en un slug de URL
 * ("iglesia-cristiana-betania"): sin acentos ni signos, solo [a-z0-9-].
 */
function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    // Marcas diacríticas combinantes. Con la clase Unicode en vez de un rango
    // de caracteres pegado, que es como estaba en Gonper y se rompe en cuanto
    // el fichero pasa por un editor que normaliza.
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

/**
 * Candidatos de slug en orden de preferencia: el base, luego `base-2`…`base-9`,
 * y por último sufijos aleatorios.
 *
 * Se generan para PROBARLOS CONTRA EL INSERT, no para consultarlos antes.
 * Gonper hace «select … where slug = X» y después inserta, que es una carrera
 * clásica: dos altas simultáneas con el mismo nombre leen que está libre y la
 * segunda revienta contra el unique. Aquí quien decide es el índice único.
 */
function* candidatosDeSlug(nombre: string): Generator<string> {
  const base = slugify(nombre);
  if (!base) return;

  yield base;
  for (let i = 2; i <= 9; i++) yield `${base}-${i}`;
  for (let i = 0; i < 5; i++) yield `${base}-${randomBytes(2).toString('hex')}`;
}

export type CrearIglesiaResult =
  | { ok: true; iglesia: { id: string; slug: string } }
  | { ok: false; error: string };

export async function crearIglesiaConSeeds(opts: {
  authUserId: string;
  email: string | null;
  nombreIglesia: string;
  nombrePastor: string;
  pais?: string;
  ciudad?: string;
  /** Evidencia del consentimiento del art. 9, recogida en el formulario. */
  ip?: string | null;
  userAgent?: string | null;
}): Promise<CrearIglesiaResult> {
  const {
    authUserId,
    email,
    nombreIglesia,
    nombrePastor,
    pais = 'CO',
    ciudad,
    ip,
    userAgent,
  } = opts;

  const slugs = [...candidatosDeSlug(nombreIglesia)];
  if (slugs.length === 0) {
    return {
      ok: false,
      error:
        'No pudimos crear una dirección web con ese nombre. Prueba con un nombre que tenga letras o números.',
    };
  }

  const trialUntil = new Date(Date.now() + DIAS_TRIAL * 24 * 60 * 60 * 1000);

  // Colombia y España quedan en husos distintos, y de esto depende qué es «hoy»
  // en el panel. Se decide por el país que eligió en el formulario.
  const timezone = pais === 'ES' ? 'Europe/Madrid' : 'America/Bogota';
  const moneda = pais === 'ES' ? 'EUR' : 'COP';

  for (const slug of slugs) {
    try {
      return await dbAdmin.transaction(async (tx) => {
        const [iglesia] = await tx
          .insert(iglesias)
          .values({
            slug,
            nombre: nombreIglesia,
            pais,
            ciudad,
            timezone,
            moneda,
            email,
            plan: 'trial',
            trialUntil,
            // Publicarse en el directorio es una decisión suya, y con datos del
            // art. 9 el defecto tiene que ser el cerrado. Se activa desde
            // Ajustes cuando la iglesia quiera.
            visibleEnDirectorio: false,
          })
          .returning({ id: iglesias.id, slug: iglesias.slug });

        // Ficha del pastor. Existe desde el minuto uno para que la
        // congregación no arranque con cero personas y para poder ponerlo como
        // líder de un ministerio sin pasos extra.
        const [fichaPastor] = await tx
          .insert(miembros)
          .values({
            iglesiaId: iglesia.id,
            authUserId,
            nombre: nombrePastor,
            email,
            estado: 'miembro',
            fechaIngreso: new Date().toISOString().slice(0, 10),
          })
          .returning({ id: miembros.id });

        await tx.insert(iglesiaUsuarios).values({
          iglesiaId: iglesia.id,
          authUserId,
          rol: 'pastor',
          // 'activo' directamente: quien crea la iglesia no se aprueba a sí
          // mismo. El flujo de solicitud y aprobación es para quien llega
          // después por el directorio.
          estado: 'activo',
          miembroId: fichaPastor.id,
          aprobadoAt: new Date(),
        });

        await tx.insert(ministerios).values(
          MINISTERIOS_SEMILLA.map((m) => ({
            iglesiaId: iglesia.id,
            nombre: m.nombre,
            tipo: m.tipo,
            colorHex: m.colorHex,
            orden: m.orden,
            modulos: componerModulos({}, modulosDelTipo(m.tipo)),
          })),
        );

        // Consentimiento del art. 9. Sin esto no hay base jurídica para tratar
        // la pertenencia religiosa de nadie, ni siquiera la del propio pastor.
        // Va DENTRO de la transacción: una iglesia creada sin su consentimiento
        // registrado es exactamente el estado que no puede existir.
        await tx.insert(consentimientos).values({
          iglesiaId: iglesia.id,
          miembroId: fichaPastor.id,
          tipo: 'datos_religiosos',
          versionTexto: VERSION_POLITICA_PRIVACIDAD,
          ip: ip ?? null,
          userAgent: userAgent ?? null,
        });

        return { ok: true as const, iglesia };
      });
    } catch (err) {
      // Slug pillado entre que lo elegimos y lo insertamos: se prueba el
      // siguiente candidato. Cualquier otro error sí es un fallo de verdad.
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  return {
    ok: false,
    error:
      'Ya hay varias iglesias con un nombre parecido. Prueba a añadir la ciudad al nombre.',
  };
}

/** ¿Existe ya una iglesia con este slug? Para validar en vivo en el formulario. */
export async function slugDisponible(slug: string): Promise<boolean> {
  const filas = await dbAdmin
    .select({ id: iglesias.id })
    .from(iglesias)
    .where(eq(iglesias.slug, slug))
    .limit(1);

  return filas.length === 0;
}
