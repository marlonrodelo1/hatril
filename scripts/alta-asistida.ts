/**
 * Alta asistida: una iglesia que da de alta Rogotech, no ella misma.
 *
 *   npm run alta:asistida -- altas/<carpeta>
 *
 * La carpeta lleva un `alta.json` y las imágenes que nombra. Vive en `altas/`,
 * que no sube a GitHub: trae correos de personas reales y, después de correr,
 * sus contraseñas de primer acceso.
 *
 * POR QUÉ NO SE LLAMA A `crearIglesiaConSeeds`
 * --------------------------------------------
 * Esa función apunta el consentimiento del art. 9 del pastor DENTRO de la misma
 * transacción, porque en `/registro` lo acaba de marcar él. Aquí nadie ha
 * marcado nada: apuntarlo sería inventarse un consentimiento. Las cuentas
 * nacen con `consentimiento_pendiente` en `app_metadata` y la primera vez que
 * entran, `estadoConsentimiento` las manda a `/acepta` a decidirlo ellas.
 *
 * SE PUEDE VOLVER A CORRER
 * ------------------------
 * La primera vez crea la iglesia, sus fichas, sus ministerios y sus fotos, y
 * apunta en `estado.json` los ids de lo que creó. Las siguientes reintentan las
 * imágenes que fallaron y miran las personas: a quien ya tiene correo en el
 * JSON y todavía no tiene cuenta, se la crea sobre su ficha. Así una iglesia puede entrar hoy con su
 * web y sus pastores enganchar la cuenta mañana, cuando se sepa su correo. El
 * contenido NO se vuelve a escribir: para entonces puede haberlo cambiado el
 * pastor desde Ajustes, y pisarlo sería borrarle el trabajo.
 *
 * NUNCA SE ADUEÑA DE UNA CUENTA QUE YA EXISTE
 * -------------------------------------------
 * Si el correo ya tiene cuenta en Hatril, se para. Engancharla a una iglesia a
 * la que esa persona no ha pedido entrar es darle a alguien un rol que no ha
 * aceptado; que lo resuelva una persona.
 */

import { randomBytes, randomInt } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

import { componerModulos } from '../src/lib/ministerios/modulos';
import { modulosDelTipo, TIPOS_MINISTERIO } from '../src/lib/ministerios/tipos';
import { normalizarRed, REDES, type Red } from '../src/lib/iglesias/redes';
import { normalizarTelefono } from '../src/lib/telefono/normalizar';
import type { HorarioSemanal } from '../src/lib/db/schema/iglesias';

const BUCKET = 'iglesias-publico';
const MAX_BYTES = 2 * 1024 * 1024;
const ROLES = ['pastor', 'lider', 'tesorero', 'secretaria', 'miembro'] as const;

type Persona = {
  nombre: string;
  apellidos?: string;
  email?: string | null;
  rol: (typeof ROLES)[number];
};

type Alta = {
  iglesia: {
    slug: string;
    nombre: string;
    denominacion?: string;
    descripcion?: string;
    historia?: string;
    pais: 'ES' | 'CO';
    ciudad?: string;
    direccion?: string;
    timezone: string;
    telefono?: string;
    email?: string;
    web?: string;
    redes?: Partial<Record<Red, string>>;
    horarios?: HorarioSemanal[];
    cuentaDonativos?: string;
    titularDonativos?: string;
    webPublica: boolean;
    visibleEnDirectorio: boolean;
    /** Fin de la prueba, en ISO. Sin Stripe montado, una de siete días la cierra sola. */
    trialUntil: string;
  };
  logo?: string;
  fotos?: string[];
  ministerios: {
    nombre: string;
    tipo: string;
    descripcion?: string;
    colorHex: string;
    foto?: string;
  }[];
  personas: Persona[];
};

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: npm run alta:asistida -- altas/<carpeta>');
  process.exit(2);
}

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DATABASE_URL || !SUPABASE_URL || !CLAVE_SERVICIO) {
  console.error('Faltan DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (van en .env.local).');
  process.exit(2);
}

const dir = resolve(carpeta);
const alta = JSON.parse(readFileSync(join(dir, 'alta.json'), 'utf8')) as Alta;
const accesos = join(dir, 'accesos.txt');

/**
 * Lo que la primera pasada creó, para que las siguientes lo encuentren por id.
 *
 * POR QUÉ NO SE BUSCA POR SLUG NI POR NOMBRE
 * ------------------------------------------
 * Entre una pasada y otra la iglesia ya está viva. Un slug que existe puede ser
 * de OTRA congregación —«betania» lo es—, y por nombre y apellidos una ficha
 * deja de encontrarse en cuanto alguien le corrige una tilde desde el panel, o
 * encuentra la de un homónimo. En los dos casos se escribiría una cuenta de
 * pastor donde no toca. Con el id que se apuntó al crearla no hay duda posible.
 */
type Estado = {
  iglesiaId: string;
  /** Ficha de cada persona, por su clave en `alta.json`. */
  fichas: Record<string, string>;
  /** Qué imágenes ya se subieron: lo que falte se reintenta, lo hecho no se pisa. */
  subidas: Record<string, boolean>;
  /** Si ya se abrieron las solicitudes al llegar el primer pastor: ver `cuenta`. */
  solicitudesAbiertas?: boolean;
};
const rutaEstado = join(dir, 'estado.json');
const clave = (p: Persona) => `${p.nombre}|${p.apellidos ?? ''}`;

function guardarEstado(e: Estado) {
  writeFileSync(rutaEstado, JSON.stringify(e, null, 2) + '\n');
}

const sql = postgres(DATABASE_URL, { prepare: false, ssl: 'require', max: 1 });
const supabase = createClient(SUPABASE_URL, CLAVE_SERVICIO, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fallar(mensaje: string): never {
  console.error(`\n✗ ${mensaje}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validación: todo antes de tocar nada, para no dejar una iglesia a medias.
// ---------------------------------------------------------------------------

const { iglesia } = alta;

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(iglesia.slug) || iglesia.slug.length > 40) {
  fallar(`El slug «${iglesia.slug}» no vale: solo minúsculas, números y guiones, hasta 40.`);
}
try {
  new Intl.DateTimeFormat('es', { timeZone: iglesia.timezone });
} catch {
  fallar(`La zona horaria «${iglesia.timezone}» no existe.`);
}
if (Number.isNaN(Date.parse(iglesia.trialUntil))) {
  fallar(`La fecha de fin de prueba «${iglesia.trialUntil}» no se entiende.`);
}

const TIPOS = new Set<string>(TIPOS_MINISTERIO.map((t) => t.id));
for (const m of alta.ministerios) {
  if (!TIPOS.has(m.tipo)) fallar(`El ministerio «${m.nombre}» tiene un tipo que no existe: ${m.tipo}.`);
}
if (new Set(alta.personas.map(clave)).size !== alta.personas.length) {
  fallar('Hay dos personas con el mismo nombre y apellidos en alta.json.');
}
if (new Set(alta.ministerios.map((m) => m.nombre)).size !== alta.ministerios.length) {
  fallar('Hay dos ministerios con el mismo nombre en alta.json.');
}
for (const p of alta.personas) {
  if (!ROLES.includes(p.rol)) fallar(`${p.nombre}: el rol «${p.rol}» no existe.`);
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    fallar(`${p.nombre}: el correo «${p.email}» no parece válido.`);
  }
}

// Las redes y el teléfono pasan por los mismos normalizadores que Ajustes: un
// número guardado de dos formas en la misma iglesia ya no se encuentra.
const redes: Partial<Record<Red, string>> = {};
for (const [red, valor] of Object.entries(iglesia.redes ?? {})) {
  if (!REDES.includes(red as Red)) fallar(`Red desconocida: ${red}.`);
  const r = normalizarRed(red as Red, valor, iglesia.pais);
  if (!r.ok) fallar(r.error);
  if (r.url) redes[red as Red] = r.url;
}
const telefono = normalizarTelefono(iglesia.telefono, iglesia.pais);
const hayPastorConCorreo = alta.personas.some((p) => p.rol === 'pastor' && p.email);

const TIPOS_IMAGEN: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const imagenes = [alta.logo, ...(alta.fotos ?? []), ...alta.ministerios.map((m) => m.foto)]
  .filter((f): f is string => Boolean(f));
for (const f of imagenes) {
  const ruta = join(dir, f);
  if (!existsSync(ruta)) fallar(`No encuentro la imagen ${f}.`);
  if (!TIPOS_IMAGEN[extname(f).toLowerCase()]) fallar(`${f}: solo JPG, PNG o WebP.`);
  if (readFileSync(ruta).length > MAX_BYTES) fallar(`${f} pesa más de 2 MB, el tope del bucket.`);
}

// ---------------------------------------------------------------------------

/** Sube una imagen y devuelve su URL pública, o `null` si falla: ver `subirImagenes`. */
async function subir(iglesiaId: string, ranura: string, fichero: string): Promise<string | null> {
  const ext = extname(fichero).toLowerCase();
  // El sufijo cambia en cada subida por lo mismo que en `lib/iglesias/imagenes.ts`:
  // con la URL fija, la CDN seguiría sirviendo la imagen vieja.
  const ruta = `${iglesiaId}/${ranura}-${randomBytes(4).toString('hex')}${ext === '.jpeg' ? '.jpg' : ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, readFileSync(join(dir, fichero)), {
      contentType: TIPOS_IMAGEN[ext],
      upsert: false,
    });
  if (error) {
    console.error(`✗ No se pudo subir ${fichero}: ${error.message}. Se reintenta en la próxima pasada.`);
    return null;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

/**
 * Contraseña de primer acceso. Cumple `validarPassword` —minúscula, mayúscula
 * y número— sin caracteres que se confundan al dictarla: ni 0/O ni 1/l/I.
 */
function contrasenaInicial(): string {
  const may = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const min = 'abcdefghijkmnpqrstuvwxyz';
  const num = '23456789';
  const tramo = (n: number) =>
    Array.from({ length: n }, () => {
      const juego = [may, min, num][randomInt(3)]!;
      return juego[randomInt(juego.length)];
    }).join('');
  return `${may[randomInt(may.length)]}${min[randomInt(min.length)]}${num[randomInt(num.length)]}${tramo(3)}-${tramo(4)}-${tramo(4)}`;
}

async function crearContenido(): Promise<Estado> {
  const timezone = iglesia.timezone;
  const moneda = iglesia.pais === 'ES' ? 'EUR' : 'COP';

  // Todo en una transacción, como `crearIglesiaConSeeds`: o queda la iglesia
  // entera, con sus fichas y sus ministerios, o no queda nada.
  const estado = await sql.begin(async (tx) => {
    const [fila] = await tx`
      insert into iglesias ${tx({
        slug: iglesia.slug,
        nombre: iglesia.nombre,
        denominacion: iglesia.denominacion ?? null,
        descripcion: iglesia.descripcion ?? null,
        historia: iglesia.historia ?? null,
        pais: iglesia.pais,
        ciudad: iglesia.ciudad ?? null,
        direccion: iglesia.direccion ?? null,
        timezone,
        moneda,
        telefono,
        email: iglesia.email ?? null,
        web: iglesia.web ?? null,
        cuenta_donativos: iglesia.cuentaDonativos ?? null,
        titular_donativos: iglesia.titularDonativos ?? null,
        web_publica: iglesia.webPublica,
        visible_en_directorio: iglesia.visibleEnDirectorio,
        // Cerradas mientras no haya un pastor con cuenta: la web pública
        // ofrece «Quiero ser parte», y una solicitud que nadie puede aprobar
        // deja a esa persona en «en revisión» sin que se avise a nadie.
        acepta_solicitudes: hayPastorConCorreo,
        plan: 'trial',
        trial_until: new Date(iglesia.trialUntil),
      })}
      returning id`;
    const iglesiaId = fila!.id as string;

    // jsonb aparte: el helper de objetos de postgres-js los serializaría como
    // texto, y `horarios` acabaría siendo un string con un array dentro.
    await tx`
      update iglesias
         set redes = ${tx.json(redes)},
             horarios = ${tx.json(iglesia.horarios ?? [])}
       where id = ${iglesiaId}`;

    for (const [i, m] of alta.ministerios.entries()) {
      await tx`
        insert into ministerios ${tx({
          iglesia_id: iglesiaId,
          nombre: m.nombre,
          tipo: m.tipo,
          descripcion: m.descripcion ?? null,
          color_hex: m.colorHex,
          orden: i + 1,
        })}`;
      await tx`
        update ministerios
           set modulos = ${tx.json(
             componerModulos({}, modulosDelTipo(m.tipo)) as postgres.JSONValue,
           )}
         where iglesia_id = ${iglesiaId} and nombre = ${m.nombre}`;
    }

    // Las fichas nacen aquí y SOLO aquí. Las cuentas llegan después, en esta
    // pasada o en otra, y se enganchan a la ficha por su id.
    const fichas: Record<string, string> = {};
    for (const p of alta.personas) {
      const [nueva] = await tx`
        insert into miembros ${tx({
          iglesia_id: iglesiaId,
          nombre: p.nombre,
          apellidos: p.apellidos ?? null,
          estado: 'miembro',
          fecha_ingreso: new Date().toISOString().slice(0, 10),
        })}
        returning id`;
      fichas[clave(p)] = nueva!.id as string;
    }

    return {
      iglesiaId,
      fichas,
      subidas: {},
      solicitudesAbiertas: hayPastorConCorreo,
    } satisfies Estado;
  });

  // Se apunta en cuanto hay commit, antes de las imágenes: si el proceso muere
  // subiendo una foto, la pasada siguiente tiene que saber de quién es esto.
  guardarEstado(estado);
  console.log(`✓ Iglesia creada: ${iglesia.nombre} (${estado.iglesiaId})`);
  console.log(`✓ ${Object.keys(estado.fichas).length} fichas y ${alta.ministerios.length} ministerios`);
  return estado;
}

/**
 * Las imágenes, fuera de la transacción porque Storage no participa en ella.
 *
 * Cada una se apunta en `estado.subidas` al quedar guardada. Una que falla no
 * para el resto, y la pasada siguiente reintenta solo las que faltan: las que
 * ya están no se vuelven a subir, porque para entonces el pastor puede haberlas
 * cambiado o quitado desde Ajustes a propósito.
 */
async function subirImagenes(e: Estado) {
  const id = e.iglesiaId;

  if (alta.logo && !e.subidas.logo) {
    const url = await subir(id, 'logo', alta.logo);
    if (url) {
      await sql`update iglesias set logo_url = ${url} where id = ${id}`;
      e.subidas.logo = true;
      guardarEstado(e);
      console.log('✓ Logo');
    }
  }

  if (alta.fotos?.length && !e.subidas.fotos) {
    const urls: string[] = [];
    for (const f of alta.fotos) {
      const url = await subir(id, 'foto', f);
      if (url) urls.push(url);
    }
    // Todas o ninguna: un carrusel con huecos se vería distinto de lo que se
    // eligió. Las que sí subieron quedan huérfanas en el bucket, unos KB.
    if (urls.length === alta.fotos.length) {
      // `banner_url` es la primera de `imagenes`, duplicada: ver el schema.
      await sql`
        update iglesias
           set imagenes = ${sql.json(urls)}, banner_url = ${urls[0]!}
         where id = ${id}`;
      e.subidas.fotos = true;
      guardarEstado(e);
      console.log(`✓ ${urls.length} fotos`);
    }
  }

  for (const m of alta.ministerios) {
    const k = `ministerio:${m.nombre}`;
    if (!m.foto || e.subidas[k]) continue;
    const url = await subir(id, 'ministerio', m.foto);
    if (!url) continue;
    await sql`
      update ministerios set foto_url = ${url}
       where iglesia_id = ${id} and nombre = ${m.nombre}`;
    e.subidas[k] = true;
    guardarEstado(e);
  }
}

/** La ficha de esta persona, por el id que apuntó la primera pasada. */
async function ficha(e: Estado, p: Persona): Promise<{ id: string; authUserId: string | null }> {
  const miembroId = e.fichas[clave(p)];
  if (!miembroId) {
    fallar(
      `${p.nombre} ${p.apellidos ?? ''} no estaba en la primera pasada. Las fichas solo se crean al crear la iglesia; a esta persona dala de alta desde el panel.`,
    );
  }
  const [fila] = await sql`
    select id, auth_user_id from miembros
     where id = ${miembroId} and iglesia_id = ${e.iglesiaId} and archivado_at is null`;
  if (!fila) fallar(`La ficha de ${p.nombre} (${miembroId}) ya no está en la iglesia: alguien la archivó o la borró.`);
  return { id: fila.id as string, authUserId: fila.auth_user_id as string | null };
}

async function cuenta(e: Estado, p: Persona, f: { id: string; authUserId: string | null }) {
  const iglesiaId = e.iglesiaId;
  if (f.authUserId) {
    console.log(`· ${p.nombre} ya tiene cuenta.`);
    return;
  }
  if (!p.email) {
    console.log(`· ${p.nombre}: sin correo todavía, solo ficha.`);
    return;
  }

  const email = p.email.trim().toLowerCase();
  const [yaExiste] = await sql`select id from auth.users where lower(email) = ${email} limit 1`;
  if (yaExiste) {
    fallar(`${email} ya tiene cuenta en Hatril. No la engancho a esta iglesia sin que esa persona lo pida.`);
  }

  const password = contrasenaInicial();
  const nombreCompleto = [p.nombre, p.apellidos].filter(Boolean).join(' ');
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombreCompleto },
    // Lo que manda a `/acepta` en el primer acceso. Va en `app_metadata` y no
    // en `user_metadata` porque esta última la puede reescribir el propio
    // usuario desde el navegador, y con ella se saltaría la pregunta.
    app_metadata: { consentimiento_pendiente: true },
  });
  if (error || !data.user) fallar(`No se pudo crear la cuenta de ${email}: ${error?.message}`);

  try {
    await sql.begin(async (tx) => {
      await tx`
        update miembros set auth_user_id = ${data.user.id}, email = ${email}
         where id = ${f.id}`;
      await tx`
        insert into iglesia_usuarios ${tx({
          iglesia_id: iglesiaId,
          auth_user_id: data.user.id,
          rol: p.rol,
          // Activa sin pasar por solicitudes: la da de alta quien monta la
          // iglesia, igual que el pastor de `/registro` no se aprueba a sí mismo.
          estado: 'activo',
          miembro_id: f.id,
          aprobado_at: new Date(),
        })}`;
    });
  } catch (err) {
    // Sin la membresía la cuenta suelta no sirve, y además bloquearía el
    // correo para el segundo intento: lo mismo que hace `/registro`.
    await supabase.auth.admin.deleteUser(data.user.id);
    throw err;
  }

  appendFileSync(
    accesos,
    `${nombreCompleto} (${p.rol})\n  usuario:    ${email}\n  contraseña: ${password}\n\n`,
  );
  console.log(`✓ Cuenta de ${nombreCompleto} (${p.rol}) — contraseña en ${accesos}`);

  // Con el primer pastor ya hay quien apruebe: se abren las solicitudes. Una
  // sola vez, apuntado en el estado; si después el pastor las cierra desde
  // Ajustes, una pasada posterior no se las vuelve a abrir.
  if (p.rol === 'pastor' && !e.solicitudesAbiertas) {
    await sql`update iglesias set acepta_solicitudes = true where id = ${iglesiaId}`;
    e.solicitudesAbiertas = true;
    guardarEstado(e);
    console.log('✓ Solicitudes de ingreso abiertas');
  }
}

async function main() {
  const [existente] = await sql`select id from iglesias where slug = ${iglesia.slug} limit 1`;

  let estado: Estado;
  if (!existente) {
    if (existsSync(rutaEstado)) {
      fallar(`Hay un estado.json de una pasada anterior pero la iglesia ${iglesia.slug} no existe. Revisa a mano antes de seguir.`);
    }
    estado = await crearContenido();
  } else {
    // El slug existe. Solo se sigue si es la iglesia que creó ESTA carpeta.
    if (!existsSync(rutaEstado)) {
      fallar(`Ya hay una iglesia con el slug ${iglesia.slug} y no la creó esta alta. Elige otro slug.`);
    }
    estado = JSON.parse(readFileSync(rutaEstado, 'utf8')) as Estado;
    if (estado.iglesiaId !== existente.id) {
      fallar(`El slug ${iglesia.slug} es de otra iglesia (${existente.id}), no de la de esta alta (${estado.iglesiaId}).`);
    }
    console.log(`· La iglesia ${iglesia.slug} ya existe y es la de esta alta: se revisan imágenes pendientes y personas.`);
  }

  await subirImagenes(estado);

  for (const p of alta.personas) {
    await cuenta(estado, p, await ficha(estado, p));
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hatril.com';
  if (iglesia.webPublica) console.log(`\nWeb pública: ${base.replace(/\/$/, '')}/i/${iglesia.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
