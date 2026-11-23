/**
 * El ministerio de Niños de principio a fin, como lo usará una iglesia.
 *
 *   npm run test:ninos:recorrido
 *
 * NECESITA EL SERVIDOR ENCENDIDO
 * ------------------------------
 * `npm run dev` en http://localhost:3000 (o la URL de PUERTAS_URL). Sin
 * servidor sale con código 2.
 *
 * POR QUÉ EXISTE
 * --------------
 * Las otras baterías miran puertas: quién abre cada pantalla (`test:puertas`,
 * `test:puertas:app`) y quién ve cada fila (`test:aislamiento`). Ninguna sigue
 * una historia: que una madre pida, que la responsable la acepte, que un
 * maestro publique con fotos y que esa madre lo vea, y que al quitar el
 * permiso de fotos su hijo salga de la lista de quién puede salir. En este
 * proyecto ya convivieron cuatro comprobaciones en verde con el producto
 * entero roto; esto pulsa los botones.
 *
 * POR DÓNDE ENTRA
 * ---------------
 * Por las dos puertas que usa la gente, nunca por SQL:
 *
 *   - La app (los maestros y las familias): `POST /api/v1/app/accion` con el
 *     token de cada cuenta, como el teléfono, y las lecturas por
 *     `/api/v1/app/*`.
 *   - El panel (la responsable y el pastor): cada formulario se envía como lo
 *     enviaría un navegador sin JavaScript. Se pide la página con la cookie,
 *     se toman los campos ocultos que pinta React para su server action
 *     (`$ACTION_REF_n`, `$ACTION_n:0`…) y se manda el formulario a la misma
 *     dirección. Así lo que se prueba es el formulario que hay en pantalla, con
 *     su action y sus argumentos, no una llamada fabricada.
 *
 * La base solo se lee para comprobar (avisos, filas que tienen que haberse
 * ido) y se toca en tres sitios que no tienen botón: el segundo ministerio de
 * Niños, la fecha de aceptación de una familia y el vencimiento de la prueba
 * gratis, para el muro.
 *
 * LO QUE MONTA Y LO QUE BORRA
 * ---------------------------
 * La iglesia y las cuentas, de usar y tirar (`scripts/pruebas/demo.mjs`): se
 * borran al terminar, también si falla. Los ficheros que sube a Storage, por
 * su ruta (empiezan por el id de la iglesia de prueba), también. Al final
 * comprueba que no queda ni uno.
 *
 * VARIABLES
 * ---------
 *   PUERTAS_URL   base del servidor (por defecto http://localhost:3000)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

import { conDemo } from './pruebas/demo.mjs';

const BASE = (process.env.PUERTAS_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_PUBLICABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

for (const [nombre, valor] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CLAVE_PUBLICABLE,
  SUPABASE_SERVICE_ROLE_KEY: CLAVE_SERVICIO,
  DATABASE_URL,
})) {
  if (!valor) {
    console.error(`Falta ${nombre} (va en .env.local).`);
    process.exit(2);
  }
}

const admin = createClient(SUPABASE_URL, CLAVE_SERVICIO, { auth: { persistSession: false, autoRefreshToken: false } });
const publico = createClient(SUPABASE_URL, CLAVE_PUBLICABLE, { auth: { persistSession: false, autoRefreshToken: false } });
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const BUCKETS = ['ninos-fotos', 'ninos-videos'];

// Una foto de verdad (de la presentación de la app, 12 KB): la que se sube tiene
// que poder abrirse, no ser bytes al azar con la etiqueta de WebP.
const FOTO = readFileSync(fileURLToPath(new URL('../src/app/bienvenida/_components/fotos/01.webp', import.meta.url)));
// Un vídeo no hace falta que se reproduzca: Storage no mira dentro, y la app
// tampoco hasta que alguien lo abre.
const VIDEO = Buffer.alloc(64 * 1024, 7);

const EQ = 'mi/equipo/[id]/ninos';
const HIJOS = 'mi/hijos';
// El ministerio de Niños de la demo, para las subidas: lo fija `recorrido`.
let MINISTERIO;

// ============================================
// Registro
// ============================================

const fallos = [];
let comprobaciones = 0;

function bloque(nombre) {
  console.log(`\n── ${nombre}`);
}

function comprobar(bien, texto, detalle) {
  comprobaciones += 1;
  if (bien) {
    console.log(`ok    ${texto}`);
    return true;
  }
  console.log(`FALLO ${texto}`);
  if (detalle !== undefined) console.log(`        ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}`);
  fallos.push(detalle !== undefined ? `${texto} (${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)})` : texto);
  return false;
}

const cerrada = (r) => r.status === 403 || r.status === 404;

// ============================================
// Sesiones sin contraseña
// ============================================

async function abrirSesion(email) {
  const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (e1) throw new Error(`${email}: ${e1.message}`);
  const { data, error: e2 } = await publico.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' });
  if (e2 || !data.session) throw new Error(`${email}: ${e2?.message ?? 'sin sesión'}`);
  // La cookie de `@supabase/ssr`, troceada como la trocea él.
  const valor = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
  const trozos = [];
  for (let i = 0; i < valor.length; i += 3180) trozos.push(valor.slice(i, i + 3180));
  const nombre = `sb-${REF}-auth-token`;
  const cookie = trozos.length === 1 ? `${nombre}=${valor}` : trozos.map((t, i) => `${nombre}.${i}=${t}`).join('; ');
  return { token: data.session.access_token, cookie };
}

/** @type {Record<string, { token: string, cookie: string }>} */
const S = {};

// ============================================
// Pedir
// ============================================

async function leer(r) {
  const texto = await r.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { status: r.status, location: r.headers.get('location'), headers: r.headers, texto, json };
}

/** Lo que dice una dirección de vuelta: `?error=`, `?guardado=` y adónde. */
function destino(url) {
  if (!url) return { ruta: null, error: null, guardado: null };
  const u = new URL(url, BASE);
  return { ruta: u.pathname, error: u.searchParams.get('error'), guardado: u.searchParams.get('guardado') };
}

/** GET a la API de la app, con el token de `quien`. */
async function app(quien, ruta) {
  const r = await fetch(BASE + '/api/v1/app' + ruta, {
    headers: { authorization: `Bearer ${S[quien].token}` },
    signal: AbortSignal.timeout(120_000),
  });
  return leer(r);
}

/**
 * Una action por la app, como la manda el teléfono (`movil/src/lib/acciones.ts`).
 * `{ __campos }` es un FormData: sus campos viajan aparte y `{ __fd: n }` en su sitio.
 */
async function accion(quien, id, args) {
  const form = new FormData();
  form.set('__id', id);
  let n = 0;
  const serializados = args.map((a) => {
    if (!a || typeof a !== 'object' || !('__campos' in a)) return a;
    for (const [campo, valor] of Object.entries(a.__campos)) {
      for (const v of [].concat(valor)) form.append(`__fd${n}:${campo}`, v);
    }
    return { __fd: n++ };
  });
  form.set('__args', JSON.stringify(serializados));
  const r = await fetch(BASE + '/api/v1/app/accion', {
    method: 'POST',
    headers: { authorization: `Bearer ${S[quien].token}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  const leido = await leer(r);
  return { ...leido, valor: leido.json?.valor, ...destino(leido.json?.redirigir) };
}

/** Una página del panel con la cookie de `quien`, sin seguir redirecciones. */
async function pagina(quien, ruta, cabeceras = {}) {
  const r = await fetch(BASE + ruta, {
    headers: { cookie: S[quien].cookie, ...cabeceras },
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  });
  return leer(r);
}

const entidades = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function atributos(trozo) {
  const a = {};
  for (const m of trozo.matchAll(/([\w$:.-]+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] === undefined ? '' : entidades(m[2]);
  return a;
}

/** Los formularios de una página, con su HTML de dentro. */
function formularios(html) {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].map((m) => ({ atributos: atributos(m[1]), html: m[2] }));
}

/**
 * Lo que mandaría el navegador sin tocar nada: los campos con su valor, las
 * casillas marcadas, la opción elegida de cada lista. Los desactivados no viajan.
 */
function camposPorDefecto(html) {
  const pares = [];
  for (const m of html.matchAll(/<input\b([^>]*)>/g)) {
    const a = atributos(m[1]);
    if (!a.name || 'disabled' in a) continue;
    const tipo = (a.type ?? 'text').toLowerCase();
    if (['submit', 'button', 'image', 'reset', 'file'].includes(tipo)) continue;
    if ((tipo === 'checkbox' || tipo === 'radio') && !('checked' in a)) continue;
    pares.push([a.name, a.value ?? (tipo === 'checkbox' || tipo === 'radio' ? 'on' : '')]);
  }
  for (const m of html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const a = atributos(m[1]);
    if (a.name && !('disabled' in a)) pares.push([a.name, entidades(m[2])]);
  }
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const a = atributos(m[1]);
    if (!a.name || 'disabled' in a) continue;
    const opciones = [...m[2].matchAll(/<option\b([^>]*)>/g)].map((o) => atributos(o[1]));
    const elegida = opciones.find((o) => 'selected' in o) ?? opciones[0];
    if (elegida) pares.push([a.name, elegida.value ?? '']);
  }
  return pares;
}

/** Las opciones de una lista de un formulario: `[{ value, texto }]`. */
function opcionesDe(html, nombre) {
  const m = html.match(new RegExp(`<select\\b[^>]*name="${nombre}"[^>]*>([\\s\\S]*?)</select>`));
  if (!m) return [];
  return [...m[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map((o) => ({
    value: atributos(o[1]).value ?? '',
    texto: entidades(o[2].replace(/<[^>]+>/g, '')),
  }));
}

/**
 * Envía un formulario del panel como un navegador sin JavaScript.
 *
 * `elegir` dice cuál de la página (un texto que lleva dentro, o una función);
 * `campos` pisa lo que el navegador mandaría: un valor, una lista, o `null`
 * para quitarlo.
 */
async function enviar(quien, ruta, elegir, campos = {}) {
  const p = await pagina(quien, ruta);
  if (p.status !== 200) return { status: p.status, sinFormulario: `la página da ${p.status}`, ...destino(p.location) };
  const cumple = typeof elegir === 'function' ? elegir : (html) => html.includes(elegir);
  const f = formularios(p.texto).find((x) => cumple(x.html));
  if (!f) return { status: 0, sinFormulario: 'no está el formulario', ...destino(null) };

  const fd = new FormData();
  for (const [k, v] of camposPorDefecto(f.html)) if (!(k in campos)) fd.append(k, v);
  for (const [k, v] of Object.entries(campos)) {
    if (v === null) continue;
    for (const x of [].concat(v)) fd.append(k, x);
  }
  const r = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { cookie: S[quien].cookie, origin: BASE },
    body: fd,
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  });
  const leido = await leer(r);
  return { ...leido, ...destino(leido.location) };
}

/** Lo que devolvió un envío, para el detalle de un fallo. */
const resumen = (r) =>
  r.sinFormulario
    ? r.sinFormulario
    : `código ${r.status}${r.error ? `, error «${r.error}»` : ''}${r.guardado ? `, guardado=${r.guardado}` : ''}${r.ruta ? ` → ${r.ruta}` : ''}${!r.error && !r.guardado && r.texto ? `: ${r.texto.slice(0, 160)}` : ''}`;

// ============================================
// Subir al drive, como el teléfono
// ============================================

/** El PUT multipart de `uploadToSignedUrl` de supabase-js (`subir-al-drive.tsx`). */
async function putFirmado(url, contenido, tipo) {
  const datos = new FormData();
  datos.append('cacheControl', '3600');
  datos.append('', new Blob([contenido], { type: tipo }));
  try {
    const r = await fetch(url, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: datos });
    return r.ok;
  } catch {
    return false;
  }
}

// ============================================
// La historia
// ============================================

async function main() {
  try {
    await fetch(BASE + '/api/v1/app/version', { signal: AbortSignal.timeout(90_000) });
  } catch {
    console.error(`No contesta ${BASE}. Enciende el servidor con \`npm run dev\`.`);
    process.exit(2);
  }

  const sql = postgres(DATABASE_URL, { prepare: false, ssl: 'require', max: 1, onnotice: () => {} });
  let iglesias = [];
  try {
    await conDemo({ cuentas: true, publicada: false }, async (demo) => {
      iglesias = [demo.betel.id, demo.sion.id];
      try {
        await recorrido(demo, sql);
      } finally {
        for (const s of Object.values(S)) await admin.auth.admin.signOut(s.token, 'local').catch(() => {});
        await borrarFicheros(sql, iglesias);
      }
    });
    // Después de borrar la iglesia: ni una fila ni un fichero suyo en ningún sitio.
    const [{ n }] = await sql`
      select count(*)::int as n from storage.objects
       where bucket_id in ${sql(BUCKETS)} and split_part(name, '/', 1) in ${sql(iglesias)}`;
    comprobar(n === 0, 'al terminar no queda ningún fichero de prueba en Storage', `${n} ficheros`);
  } finally {
    await sql.end();
  }

  console.log(`\n${comprobaciones} comprobaciones, ${fallos.length} fallos.`);
  if (fallos.length) {
    console.log('\nFallos:');
    for (const f of fallos) console.log(`  - ${f}`);
  }
  process.exitCode = fallos.length ? 1 : 0;
}

/** Los ficheros de las iglesias de prueba, de los dos buckets, por su ruta. */
async function borrarFicheros(sql, iglesias) {
  const filas = await sql`
    select bucket_id, name from storage.objects
     where bucket_id in ${sql(BUCKETS)} and split_part(name, '/', 1) in ${sql(iglesias)}`;
  for (const bucket of BUCKETS) {
    const rutas = filas.filter((f) => f.bucket_id === bucket).map((f) => f.name);
    for (let i = 0; i < rutas.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(rutas.slice(i, i + 100));
      if (error) console.error(`No se pudieron borrar ficheros de ${bucket}: ${error.message}`);
    }
  }
}

async function recorrido(demo, sql) {
  const B = demo.betel.id;
  const N = demo.ids.ninos;
  MINISTERIO = N;
  const f = demo.fichas;
  const u = demo.usuarios;
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const haceDias = (n) => {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const manana = (() => {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const esteAnio = new Date().getUTCFullYear();
  const panel = `/panel/ministerios/${N}/ninos`;

  for (const rol of ['pastor', 'secretaria', 'lider', 'colider', 'miembro', 'enlace', 'sion', 'maestra', 'auxiliar', 'madre', 'madre2']) {
    S[rol] = await abrirSesion(demo.cuentas[rol]);
  }

  const avisosDe = async (usuario, tipo) =>
    (await sql`select count(*)::int as n from notificaciones
                where iglesia_id = ${B} and destinatario_auth_user_id = ${usuario} and tipo = ${tipo}`)[0].n;
  const misHijos = async (quien) => (await app(quien, '/mi/hijos')).json ?? {};
  const tablon = async (quien) => (await app(quien, '/mi/hijos/tablon')).json?.publicaciones ?? [];
  const textos = (pubs) => pubs.map((p) => p.texto);
  const nombres = (hijos) => (hijos ?? []).map((h) => h.nombre).sort().join(',');
  const solicitudDe = async (miembro, nombre) =>
    (await sql`select id from ninos_solicitudes where iglesia_id = ${B} and miembro_id = ${miembro} and nombre = ${nombre}`)[0]?.id;
  const ninoLlamado = async (nombre) =>
    (await sql`select id from ninos where iglesia_id = ${B} and nombre = ${nombre}`)[0]?.id;
  const pedir = (quien, campos) =>
    accion(quien, `${HIJOS}#pedirVinculo`, [
      { __campos: { ministerio: N, parentesco: 'madre', anio: String(esteAnio - 6), vinculo: 'on', ...campos } },
    ]);
  const ultimaPublicacion = (r) => (r.ruta ?? '').split('/').pop();
  const verPublicacion = async (quien, id) => (await app(quien, `/mi/equipo/${N}/ninos/publicacion/${id}`)).json?.datos;

  // =====================================================================
  bloque('1. El pastor enciende el tablón en un ministerio de Niños nuevo');
  // =====================================================================
  // Un segundo ministerio de Niños, sin el tablón, con Gloria de responsable.
  // No hay botón que lo cree con el tipo y el equipo a la vez sin pasar por
  // otra docena de pantallas; lo que se prueba es encenderlo.
  const [{ id: N2 }] = await sql`
    insert into ministerios (iglesia_id, nombre, tipo, modulos)
    values (${B}, 'Escuela dominical', 'ninos', ${sql.json({ agenda: { activo: true } })})
    returning id`;
  await sql`insert into ministerio_miembros (iglesia_id, ministerio_id, miembro_id, rol_equipo)
            values (${B}, ${N2}, ${f.maestra}, 'responsable')`;
  const editar2 = `/panel/ministerios/${N2}/editar`;
  const modulos2 = async () => (await sql`select modulos from ministerios where id = ${N2}`)[0].modulos;

  {
    const r = await enviar('maestra', editar2, 'name="nombre"', { modulos: ['agenda', 'ninos'], compromiso_ninos: 'on' });
    const m = await modulos2();
    comprobar(!m.ninos?.activo, 'la responsable no puede encender el tablón, ni mandando la casilla a mano', `${resumen(r)}; modulos=${JSON.stringify(m)}`);
  }
  {
    const p = await pagina('pastor', editar2);
    comprobar(p.status === 200 && p.texto.includes('name="compromiso_ninos"'), 'el pastor ve la casilla del compromiso al editar', `código ${p.status}`);
    const r = await enviar('pastor', editar2, 'name="nombre"', { modulos: ['agenda', 'ninos'], compromiso_ninos: null });
    const m = await modulos2();
    comprobar(
      !m.ninos?.activo && (r.error ?? '').includes('compromiso'),
      'sin marcar el compromiso, no se enciende y lo dice',
      `${resumen(r)}; ninos=${JSON.stringify(m.ninos)}`,
    );
  }
  {
    const r = await enviar('pastor', editar2, 'name="nombre"', { modulos: ['agenda', 'ninos'], compromiso_ninos: 'on' });
    const m = await modulos2();
    comprobar(m.ninos?.activo === true, 'con el compromiso marcado, se enciende', resumen(r));
    comprobar(
      m.ninos?.compromiso?.aceptado_por_miembro_id === f.pastor && Boolean(m.ninos?.compromiso?.version),
      'queda apuntado quién aceptó el compromiso, cuándo y con qué versión',
      JSON.stringify(m.ninos?.compromiso),
    );
    const h = await misHijos('miembro');
    comprobar(
      (h.ministerios ?? []).some((x) => x.id === N2),
      'las familias ya pueden pedir en el ministerio nuevo',
      JSON.stringify(h.ministerios),
    );
  }

  // =====================================================================
  bloque('2. La responsable nombra a sus maestros');
  // =====================================================================
  const portadaN = `/panel/ministerios/${N}`;
  {
    const p = await pagina('maestra', `${portadaN}?asignar=1`);
    comprobar(p.status === 200 && p.texto.includes('name="miembros"'), 'la responsable puede abrir «Sumar a alguien al equipo»', `código ${p.status}`);
    const r = await enviar('maestra', `${portadaN}?asignar=1`, 'name="miembros"', {
      miembros: [f.colider, f.carmen, f.lider],
    });
    const equipo = await sql`select miembro_id, rol_equipo from ministerio_miembros
                              where ministerio_id = ${N} and activo and miembro_id in ${sql([f.colider, f.carmen, f.lider])}`;
    comprobar(equipo.length === 3, 'suma a tres personas al equipo, como voluntarias', `${resumen(r)}; en el equipo: ${equipo.length}`);
  }
  {
    const r = await enviar('maestra', portadaN, (h) => h.includes(f.carmen) && h.includes('value="colider"'), {});
    const [fila] = await sql`select rol_equipo from ministerio_miembros where ministerio_id = ${N} and miembro_id = ${f.carmen} and activo`;
    comprobar(
      fila?.rol_equipo === 'voluntario' && (r.error ?? '').includes('cuenta'),
      'a una persona sin cuenta no se la puede hacer maestra, y lo dice',
      `${resumen(r)}; rol=${fila?.rol_equipo}`,
    );
  }
  {
    const r = await enviar('maestra', portadaN, (h) => h.includes(f.colider) && h.includes('value="colider"'), {});
    const [fila] = await sql`select rol_equipo from ministerio_miembros where ministerio_id = ${N} and miembro_id = ${f.colider} and activo`;
    comprobar(fila?.rol_equipo === 'colider', 'a Sara, con cuenta, la hace maestra (colíder)', `${resumen(r)}; rol=${fila?.rol_equipo}`);
    const t = await app('colider', `/mi/equipo/${N}/ninos`);
    comprobar(t.status === 200, 'la nueva maestra entra al tablón desde la app', `código ${t.status}`);
    const c = await app('colider', `/mi/equipo/${N}/ninos/cronograma`);
    comprobar(c.status === 200, 'y lee el cronograma', `código ${c.status}`);
  }
  {
    const t = await app('lider', `/mi/equipo/${N}/ninos`);
    comprobar(cerrada(t) && !t.texto.includes('Cantamos'), 'un voluntario del equipo que no es maestro no ve el tablón', `código ${t.status}`);
  }
  {
    // El de sacarla del equipo, no el de quitarle el liderazgo: los dos dicen «Quitar a Sara».
    const r = await enviar('maestra', portadaN, (h) => h.includes(f.colider) && h.includes('del equipo') && !h.includes('name="rolEquipo"'), {});
    const t = await app('colider', `/mi/equipo/${N}/ninos`);
    comprobar(cerrada(t), 'al quitarla del equipo, deja de entrar en ese momento', `${resumen(r)}; tablón ${t.status}`);
    const a = await accion('colider', `${EQ}#crearPublicacion`, [N, { __campos: { fecha: hoy, texto: 'No debería' } }]);
    const [{ n }] = await sql`select count(*)::int as n from ninos_publicaciones where ministerio_id = ${N} and texto = 'No debería'`;
    comprobar(n === 0, 'y ya no puede publicar aunque tenga la app abierta', `código ${a.status}, publicaciones: ${n}`);
  }

  // =====================================================================
  bloque('3. Una familia nueva pide entrar');
  // =====================================================================
  {
    const h = await misHijos('miembro');
    comprobar(
      (h.ministerios ?? []).some((x) => x.id === N) && (h.hijos ?? []).length === 0 && (h.solicitudes ?? []).length === 0,
      'Lucía ve que su iglesia tiene tablón, sin hijos ni peticiones',
      JSON.stringify({ ministerios: h.ministerios?.length, hijos: h.hijos?.length, solicitudes: h.solicitudes?.length }),
    );
  }
  const malas = [
    [{ vinculo: null }, 'primera casilla', 'sin la primera casilla'],
    [{ anio: String(esteAnio - 14) }, 'hasta 13', 'con un niño de 14 años'],
    [{ anio: String(esteAnio + 1) }, 'hasta 13', 'con un año que no ha llegado'],
    [{ anio: 'dos mil' }, 'año', 'con un año que no es un número'],
    [{ nombre: '   ' }, 'nombre', 'sin nombre'],
    [{ nombre: 'x'.repeat(61) }, 'largo', 'con un nombre de 61 letras'],
    [{ parentesco: 'abuela' }, 'madre, su padre o su tutor', 'con un parentesco que no vale'],
    [{ ministerio: demo.ids.alabanza }, 'tablón', 'en un ministerio sin tablón (Alabanza)'],
  ];
  for (const [campos, espera, como] of malas) {
    const r = await pedir('miembro', { nombre: 'Mateo', ...campos });
    comprobar((r.error ?? '').includes(espera), `no deja pedir ${como}`, resumen(r));
  }
  {
    const [{ n }] = await sql`select count(*)::int as n from ninos_solicitudes where miembro_id = ${f.miembro}`;
    comprobar(n === 0, 'ninguno de esos intentos deja una petición a medias', `${n} peticiones`);
  }

  const avisosMaestra = await avisosDe(u.maestra, 'ninos_solicitud');
  {
    const r = await pedir('miembro', { nombre: 'Mateo', imagen: 'on' });
    comprobar(r.guardado === 'pedido', 'con todo bien, queda pedida', resumen(r));
    const h = await misHijos('miembro');
    comprobar(
      (h.solicitudes ?? []).length === 1 && h.solicitudes[0].nombre === 'Mateo' && h.solicitudes[0].permisoImagen === true,
      'y le sale como pendiente, con el permiso de fotos que dio',
      JSON.stringify(h.solicitudes),
    );
    comprobar((await avisosDe(u.maestra, 'ninos_solicitud')) === avisosMaestra + 1, 'a la responsable le llega el aviso de la petición');
    comprobar((await avisosDe(u.auxiliar, 'ninos_solicitud')) === 0, 'al maestro no: aceptar familias no es cosa suya');
  }
  {
    const r = await pedir('miembro', { nombre: ' mateo ' });
    comprobar((r.error ?? '').includes('Ya lo habías pedido'), 'pedir dos veces el mismo niño lo dice, sin duplicar', resumen(r));
  }
  {
    const t = await tablon('miembro');
    const h = await misHijos('miembro');
    const e = await app('miembro', `/mi/equipo/${N}/ninos`);
    comprobar(t.length === 0 && (h.hijos ?? []).length === 0 && cerrada(e), 'mientras está pendiente no ve nada: ni hijos, ni tablón, ni el equipo', `tablón ${t.length}, equipo ${e.status}`);
  }
  {
    const id = await solicitudDe(f.miembro, 'Mateo');
    const r = await accion('miembro', `${HIJOS}#retirarSolicitud`, [id]);
    comprobar(r.guardado === 'retirada' && !(await solicitudDe(f.miembro, 'Mateo')), 'puede retirar su petición', resumen(r));
    const otra = await accion('madre', `${HIJOS}#retirarSolicitud`, [id]);
    comprobar(otra.guardado === 'retirada' || otra.error, 'retirar la de otra persona no rompe nada', resumen(otra));
  }

  // =====================================================================
  bloque('4. La responsable acepta, rechaza y quita familias');
  // =====================================================================
  await pedir('miembro', { nombre: 'Mateo', imagen: 'on' });
  const solMateo = await solicitudDe(f.miembro, 'Mateo');
  const familias = `${panel}/familias`;
  {
    const p = await pagina('maestra', familias);
    comprobar(p.status === 200 && p.texto.includes('Mateo'), 'la petición le sale a la responsable en Familias', `código ${p.status}`);
    const opciones = opcionesDe(formularios(p.texto).find((x) => x.html.includes(solMateo))?.html ?? '', 'nino');
    comprobar(
      opciones.some((o) => o.value === 'nuevo') && opciones.some((o) => o.value === demo.ids.tomas),
      'puede elegir si es un niño nuevo o «es el mismo que…» uno que ya está',
      JSON.stringify(opciones.map((o) => o.texto)),
    );
  }
  {
    const a = await accion('auxiliar', `${EQ}#aceptarSolicitud`, [N, solMateo, { __campos: { nino: 'nuevo' } }]);
    comprobar(Boolean(a.error) && Boolean(await solicitudDe(f.miembro, 'Mateo')), 'el maestro no puede aceptarla, ni llamando a la action a mano', resumen(a));
    const r = await accion('auxiliar', `${EQ}#rechazarSolicitud`, [N, solMateo]);
    comprobar(Boolean(r.error) && Boolean(await solicitudDe(f.miembro, 'Mateo')), 'ni rechazarla', resumen(r));
    const q = await accion('auxiliar', `${EQ}#quitarFamilia`, [N, demo.ids.tomas, f.madre]);
    const [{ n }] = await sql`select count(*)::int as n from nino_familias where nino_id = ${demo.ids.tomas} and miembro_id = ${f.madre}`;
    comprobar(Boolean(q.error) && n === 1, 'ni quitar a una familia', resumen(q));
    const m = await accion('madre', `${EQ}#aceptarSolicitud`, [N, solMateo, { __campos: { nino: 'nuevo' } }]);
    comprobar(cerrada(m) || Boolean(m.error), 'una madre tampoco', resumen(m));
  }
  {
    const r = await enviar('maestra', familias, (h) => h.includes(solMateo) && h.includes('name="nino"') === false);
    comprobar(r.guardado === 'rechazada' && !(await solicitudDe(f.miembro, 'Mateo')), 'la responsable la rechaza y la petición se borra entera', resumen(r));
    const h = await misHijos('miembro');
    comprobar((h.solicitudes ?? []).length === 0 && (h.hijos ?? []).length === 0, 'Lucía se queda sin nada, como antes de pedir');
  }
  {
    await pedir('miembro', { nombre: 'Mateo', imagen: 'on' });
    const sol = await solicitudDe(f.miembro, 'Mateo');
    comprobar(Boolean(sol), 'después de un rechazo, puede volver a pedirlo');
    const antes = await avisosDe(u.miembro, 'ninos_aceptada');
    const r = await enviar('maestra', familias, (h) => h.includes(sol) && h.includes('name="nino"'), { nino: 'nuevo' });
    comprobar(r.guardado === 'aceptada', 'la responsable la acepta como niño nuevo', resumen(r));
    const h = await misHijos('miembro');
    comprobar(nombres(h.hijos) === 'Mateo' && h.hijos[0].fotos === true, 'Lucía ve a Mateo, con su permiso de fotos', JSON.stringify(h.hijos));
    comprobar((await avisosDe(u.miembro, 'ninos_aceptada')) === antes + 1, 'y le llega el aviso de que la aceptaron');
    const t = await tablon('miembro');
    comprobar(t.length === 0, 'su tablón empieza hoy: no ve lo publicado hace dos días', JSON.stringify(textos(t)));
    const otra = await enviar('maestra', familias, (h) => h.includes(sol) && h.includes('name="nino"'), { nino: 'nuevo' });
    comprobar(otra.sinFormulario || (otra.error ?? '').includes('ya no existe'), 'aceptarla dos veces no crea otro niño', resumen(otra));
    const [{ n }] = await sql`select count(*)::int as n from ninos where iglesia_id = ${B} and nombre = 'Mateo'`;
    comprobar(n === 1, 'hay un solo Mateo', `${n}`);
  }

  // El segundo progenitor: Andrés, padre de Tomás.
  {
    const r = await pedir('enlace', { nombre: 'Tomás', parentesco: 'padre', anio: String(esteAnio - 7) });
    comprobar(r.guardado === 'pedido', 'el padre de Tomás pide también, sin permiso de fotos', resumen(r));
    const sol = await solicitudDe(f.enlace, 'Tomás');
    // Por la app, como lo haría la responsable desde el teléfono.
    const a = await accion('maestra', `${EQ}#aceptarSolicitud`, [N, sol, { __campos: { nino: demo.ids.tomas } }]);
    comprobar(a.guardado === 'aceptada' && !(a.ruta ?? '').startsWith('/panel'), 'la responsable, desde la app, lo une al Tomás que ya está', resumen(a));
    const h = await misHijos('enlace');
    comprobar(nombres(h.hijos) === 'Tomás' && h.hijos[0].fotos === false, 'Andrés ve a Tomás, sin permiso de fotos suyo', JSON.stringify(h.hijos));
    const hm = await misHijos('madre');
    comprobar(nombres(hm.hijos) === 'Tomás' && hm.hijos[0].fotos === true, 'Paula sigue viendo a Tomás con su permiso intacto', JSON.stringify(hm.hijos));
    const [{ n }] = await sql`select count(*)::int as n from ninos where iglesia_id = ${B} and nombre = 'Tomás'`;
    comprobar(n === 1, 'sigue habiendo un solo Tomás', `${n}`);
  }
  {
    await pedir('enlace', { nombre: 'Tomasito', parentesco: 'padre', anio: String(esteAnio - 7) });
    const sol = await solicitudDe(f.enlace, 'Tomasito');
    const r = await enviar('maestra', familias, (h) => h.includes(sol) && h.includes('name="nino"'), { nino: demo.ids.tomas });
    comprobar((r.error ?? '').includes('ya está vinculada'), 'unirle otra vez al mismo niño lo dice', resumen(r));
    await accion('enlace', `${HIJOS}#retirarSolicitud`, [sol]);
  }
  {
    const r = await enviar('maestra', familias, (h) => h.includes(solMateo) || false, {});
    // `solMateo` ya no existe: la del rechazo. El formulario ya no está.
    comprobar(r.sinFormulario !== undefined, 'una petición ya resuelta no se puede volver a tocar desde la pantalla', resumen(r));
  }

  // Una madre con dos hijos, y un maestro que además es padre.
  {
    await pedir('madre2', { nombre: 'Sofía', anio: String(esteAnio - 3), imagen: 'on' });
    const sol = await solicitudDe(f.madre2, 'Sofía');
    const r = await enviar('maestra', familias, (h) => h.includes(sol) && h.includes('name="nino"'), { nino: 'nuevo' });
    const h = await misHijos('madre2');
    comprobar(r.guardado === 'aceptada' && nombres(h.hijos) === 'Lía,Sofía', 'Elena tiene a sus dos hijas, Lía y Sofía', `${resumen(r)}; ${nombres(h.hijos)}`);
  }
  {
    await pedir('auxiliar', { nombre: 'Pablo', parentesco: 'padre', anio: String(esteAnio - 8) });
    const sol = await solicitudDe(f.auxiliar, 'Pablo');
    const r = await enviar('maestra', familias, (h) => h.includes(sol) && h.includes('name="nino"'), { nino: 'nuevo' });
    const h = await misHijos('auxiliar');
    comprobar(r.guardado === 'aceptada' && nombres(h.hijos) === 'Pablo', 'Iván, que es maestro, ve en «Mis hijos» solo a su hijo, no a todos', `${resumen(r)}; ${nombres(h.hijos)}`);
    const t = await tablon('auxiliar');
    comprobar(t.length === 0, 'y su tablón de padre empieza hoy, aunque como maestro lo vea todo', JSON.stringify(textos(t)));
  }
  {
    const todos = ['Tomás', 'Lía', 'Sofía', 'Mateo', 'Pablo'];
    for (const [quien, suyos] of [['madre', ['Tomás']], ['madre2', ['Lía', 'Sofía']], ['miembro', ['Mateo']], ['enlace', ['Tomás']]]) {
      const r = await app(quien, '/mi/hijos');
      const ajenos = todos.filter((n) => !suyos.includes(n) && r.texto.includes(n));
      comprobar(ajenos.length === 0, `${quien}: en su «Mis hijos» no aparece ningún niño de otra familia`, ajenos.join(', '));
    }
    const s = await app('sion', '/mi/hijos');
    comprobar(!todos.some((n) => s.texto.includes(n)) && !s.texto.includes(B), 'el pastor de otra iglesia no ve nada de esta', s.texto.slice(0, 120));
  }

  // =====================================================================
  bloque('5. El cronograma');
  // =====================================================================
  const crono = `${panel}/cronograma`;
  {
    const p = await pagina('maestra', crono);
    const opciones = opcionesDe(formularios(p.texto).find((x) => x.html.includes('name="tema"'))?.html ?? '', 'maestro');
    comprobar(
      opciones.some((o) => o.value === f.auxiliar) && !opciones.some((o) => o.value === f.madre),
      'en «quién da la clase» salen los maestros y no las familias',
      JSON.stringify(opciones.map((o) => o.texto)),
    );
  }
  const clasesMalas = [
    [{ tema: '' }, 'tema', 'sin tema'],
    [{ tema: 'x'.repeat(121) }, '120', 'con un tema de 121 letras'],
    [{ fecha: 'mañana' }, 'fecha', 'con una fecha que no se entiende'],
    [{ puntos: 'x'.repeat(2001) }, '2.000', 'con 2.001 letras de puntos'],
    [{ maestro: f.sion }, 'no es de esta iglesia', 'con un maestro de otra iglesia (formulario tocado a mano)'],
  ];
  for (const [campos, espera, como] of clasesMalas) {
    const r = await enviar('maestra', crono, 'name="tema"', { fecha: haceDias(-7), tema: 'Prueba', ...campos });
    comprobar((r.error ?? '').includes(espera), `no apunta una clase ${como}`, resumen(r));
  }
  {
    const r = await enviar('maestra', crono, 'name="tema"', { fecha: haceDias(-7), tema: 'Noé y el arca', puntos: 'Obediencia', maestro: f.auxiliar });
    comprobar(r.guardado === 'clase', 'la responsable apunta una clase con su maestro', resumen(r));
    const c = await app('auxiliar', `/mi/equipo/${N}/ninos/cronograma`);
    const temas = (c.json?.datos?.proximas ?? []).map((x) => x.tema);
    comprobar(temas.includes('Noé y el arca'), 'el maestro la ve en la app', JSON.stringify(temas));
  }
  {
    const r = await enviar('auxiliar', crono, 'name="tema"', { fecha: haceDias(-14), tema: 'Jonás', maestro: f.auxiliar });
    comprobar(r.guardado === 'clase', 'el maestro también puede apuntar clases desde el panel', resumen(r));
  }
  {
    const [clase] = await sql`select id from ninos_cronograma where ministerio_id = ${N} and tema = 'Noé y el arca'`;
    const r = await enviar('maestra', `${crono}/${clase.id}`, 'name="tema"', { tema: 'Noé y el diluvio' });
    const [despues] = await sql`select tema from ninos_cronograma where id = ${clase.id}`;
    comprobar(r.guardado === 'clase' && despues?.tema === 'Noé y el diluvio', 'la edita', `${resumen(r)}; tema=${despues?.tema}`);
    const b = await enviar('maestra', `${crono}/${clase.id}`, (h) => !h.includes('name="tema"'));
    const [queda] = await sql`select id from ninos_cronograma where id = ${clase.id}`;
    comprobar(b.guardado === 'clase-borrada' && !queda, 'y la borra', resumen(b));
  }
  {
    const p = await pagina('madre', crono);
    const a = await app('madre', `/mi/equipo/${N}/ninos/cronograma`);
    comprobar(p.status !== 200 && cerrada(a) && !a.texto.includes('Jonás'), 'las familias no ven el cronograma, ni en el panel ni en la app', `panel ${p.status}, app ${a.status}`);
  }

  // =====================================================================
  bloque('6. El drive: subir fotos y vídeos');
  // =====================================================================
  let fotoSuelta;
  {
    const s = await subirComo('auxiliar', { contenido: FOTO, mime: 'image/webp' });
    fotoSuelta = s.id;
    comprobar(s.ok, 'el maestro sube una foto al drive desde el teléfono', s.error ?? '');
    const d = await pagina('maestra', `${panel}/drive`);
    comprobar(d.status === 200 && d.texto.includes(fotoSuelta), 'la foto sale en el drive del panel');
  }
  {
    const s = await subirComo('auxiliar', { tipo: 'video', mime: 'video/mp4', contenido: VIDEO, duracionS: 30 });
    comprobar(s.ok, 'sube un vídeo de 30 segundos', s.error ?? '');
  }
  const subidasMalas = [
    [{ bytes: 6 * 1024 * 1024 }, '5 MB', 'una foto de más de 5 MB'],
    [{ mime: 'image/png' }, 'JPG o WebP', 'una foto en PNG'],
    [{ tipo: 'video', mime: 'video/webm', duracionS: 10 }, 'MP4 o MOV', 'un vídeo en WebM'],
    [{ tipo: 'video', mime: 'video/mp4', bytes: 101 * 1024 * 1024, duracionS: 50 }, '100 MB', 'un vídeo de más de 100 MB'],
    [{ tipo: 'video', mime: 'video/mp4', duracionS: 61 }, 'no se puede subir', 'un vídeo de más de un minuto'],
    [{ fecha: manana }, 'no ha llegado', 'con fecha de mañana'],
  ];
  for (const [campos, espera, como] of subidasMalas) {
    const p = await prepararComo('auxiliar', { contenido: FOTO, mime: 'image/webp', ...campos });
    comprobar(p.valor?.ok === false && (p.valor?.error ?? '').includes(espera), `no deja subir ${como}`, JSON.stringify(p.valor ?? p.texto.slice(0, 120)));
  }
  {
    const antes = (await sql`select count(*)::int as n from ninos_archivos where ministerio_id = ${N}`)[0].n;
    const s = await subirComo('auxiliar', { contenido: FOTO, mime: 'image/webp', noSubir: true });
    const despues = (await sql`select count(*)::int as n from ninos_archivos where ministerio_id = ${N}`)[0].n;
    comprobar(!s.ok && (s.error ?? '').includes('no llegó entero') && despues === antes, 'una subida que se corta antes de llegar no deja nada a medias', `${s.error}; filas ${antes}→${despues}`);
  }
  {
    // Lo que diga el teléfono no basta: si el fichero que llega no es una imagen, fuera.
    const s = await subirComo('auxiliar', { contenido: Buffer.from('esto no es una foto'), mime: 'image/webp', mimeSubida: 'text/plain' });
    comprobar(!s.ok, 'un fichero que no es una foto no entra aunque se declare como foto', s.error ?? 'entró');
  }

  // =====================================================================
  bloque('7. El tablón: borrador, fotos, publicar');
  // =====================================================================
  const tablonesMalos = [
    [{ texto: '' }, 'Cuenta en una frase', 'sin texto'],
    [{ texto: 'x'.repeat(1001) }, '1.000', 'con 1.001 letras'],
    [{ fecha: manana }, 'todavía no ha llegado', 'de un día que no ha pasado'],
  ];
  for (const [campos, espera, como] of tablonesMalos) {
    const r = await accion('auxiliar', `${EQ}#crearPublicacion`, [N, { __campos: { fecha: hoy, texto: 'Hoy', ...campos } }]);
    comprobar((r.error ?? '').includes(espera), `no crea un borrador ${como}`, resumen(r));
  }
  let pub;
  {
    const r = await accion('auxiliar', `${EQ}#crearPublicacion`, [N, { __campos: { fecha: hoy, texto: 'Hoy hicimos títeres de la creación' } }]);
    pub = ultimaPublicacion(r);
    comprobar(r.guardado === 'creada' && (r.ruta ?? '').startsWith(`/mi/equipo/${N}/ninos/publicacion/`), 'el maestro escribe el borrador desde la app y entra en él', resumen(r));
    const t = await tablon('madre');
    comprobar(!textos(t).includes('Hoy hicimos títeres de la creación'), 'un borrador no lo ve ninguna familia');
  }
  {
    const s = await subirComo('auxiliar', { contenido: FOTO, mime: 'image/webp', publicacionId: pub });
    comprobar(s.ok, 'sube una foto dentro del borrador', s.error ?? '');
    const sinMarcar = await accion('auxiliar', `${EQ}#adjuntarArchivos`, [N, pub, { __campos: {} }]);
    comprobar((sinMarcar.error ?? '').includes('Marca al menos'), 'añadir del drive sin marcar nada lo dice', resumen(sinMarcar));
    const r = await accion('auxiliar', `${EQ}#adjuntarArchivos`, [N, pub, { __campos: { archivos: [fotoSuelta, demo.ids.archivoPublicado] } }]);
    const filas = await sql`select id, publicacion_id from ninos_archivos where id in ${sql([fotoSuelta, demo.ids.archivoPublicado])}`;
    const suelta = filas.find((x) => x.id === fotoSuelta);
    const deOtra = filas.find((x) => x.id === demo.ids.archivoPublicado);
    comprobar(r.guardado === 'adjuntados' && suelta?.publicacion_id === pub, 'añade la foto suelta del drive', resumen(r));
    comprobar(deOtra?.publicacion_id === demo.ids.pubNueva, 'una foto que ya va en otra publicación no se la lleva', `${deOtra?.publicacion_id}`);
    const v = await verPublicacion('auxiliar', pub);
    comprobar((v?.archivos ?? []).length === 2, 'el borrador tiene sus dos fotos', `${(v?.archivos ?? []).length}`);
    // Puede salir quien tiene el permiso de TODOS sus padres (`plan-ninos.md` §4):
    // Tomás no, porque su padre no lo dio al pedir; Lía no, porque su madre tampoco.
    const pueden = (v?.pueden ?? []).slice().sort().join(',');
    comprobar(pueden === 'Mateo,Sofía', 'arriba sale quién puede salir en fotos: Mateo y Sofía; Tomás no, le falta el permiso de su padre; Lía no', pueden);
  }
  const avisosPub = { madre: await avisosDe(u.madre, 'ninos_publicacion'), madre2: await avisosDe(u.madre2, 'ninos_publicacion'), miembro: await avisosDe(u.miembro, 'ninos_publicacion') };
  {
    const r = await accion('auxiliar', `${EQ}#publicar`, [N, pub, { __campos: {} }]);
    const [p] = await sql`select publicada_at from ninos_publicaciones where id = ${pub}`;
    comprobar(!p.publicada_at && (r.error ?? '').includes('has mirado las fotos'), 'sin la casilla de «he mirado las fotos» no se publica', resumen(r));
    const ok = await accion('auxiliar', `${EQ}#publicar`, [N, pub, { __campos: { revisado: 'on' } }]);
    comprobar(ok.guardado === 'publicada', 'con la casilla, se publica', resumen(ok));
  }
  {
    const t = await tablon('madre');
    const p = t.find((x) => x.id === pub);
    comprobar(Boolean(p), 'Paula lo ve en su tablón', JSON.stringify(textos(t)));
    comprobar((p?.archivos ?? []).length === 2, 'con sus dos fotos', `${(p?.archivos ?? []).length}`);
    const conUrl = (p?.archivos ?? []).filter((a) => a.original);
    comprobar(conUrl.length >= 1, 'las fotos llegan con su dirección firmada');
    if (conUrl[0]) {
      const img = await fetch(conUrl[0].original);
      const bytes = Buffer.from(await img.arrayBuffer());
      comprobar(img.ok && bytes.equals(FOTO), 'y la foto se descarga entera, la misma que se subió', `código ${img.status}, ${bytes.length} bytes`);
    }
    comprobar(Boolean((await tablon('madre2')).find((x) => x.id === pub)), 'Elena, aceptada hoy, también lo ve: es de hoy');
    comprobar(Boolean((await tablon('miembro')).find((x) => x.id === pub)), 'y Lucía, aceptada hoy, también');
    comprobar((await avisosDe(u.madre, 'ninos_publicacion')) === avisosPub.madre + 1, 'a Paula le llega el aviso de la publicación');
    comprobar((await avisosDe(u.madre2, 'ninos_publicacion')) === avisosPub.madre2 + 1, 'a Elena también');
    comprobar((await avisosDe(u.miembro, 'ninos_publicacion')) === avisosPub.miembro + 1, 'y a Lucía');
    // Iván es padre aceptado hoy, pero la ha publicado él (`notificaciones/emitir.ts`).
    comprobar((await avisosDe(u.auxiliar, 'ninos_publicacion')) === 0, 'Iván, que es padre pero la ha publicado él, no se avisa a sí mismo', `${await avisosDe(u.auxiliar, 'ninos_publicacion')}`);
  }
  {
    const s = await prepararComo('auxiliar', { contenido: FOTO, mime: 'image/webp', publicacionId: pub });
    comprobar(s.valor?.ok === false && (s.valor?.error ?? '').includes('Ya está publicada'), 'a lo publicado no se suben fotos sin retirarlo', JSON.stringify(s.valor));
    const otra = await subirComo('auxiliar', { contenido: FOTO, mime: 'image/webp' });
    const a = await accion('auxiliar', `${EQ}#adjuntarArchivos`, [N, pub, { __campos: { archivos: [otra.id] } }]);
    comprobar((a.error ?? '').includes('Ya está publicada'), 'ni se añaden del drive', resumen(a));
  }
  {
    const r = await accion('auxiliar', `${EQ}#editarPublicacion`, [N, pub, { __campos: { texto: 'Hoy hicimos títeres de la creación, y cantamos', fecha: hoy } }]);
    comprobar(r.guardado === 'editada', 'lo publicado se puede corregir de texto', resumen(r));
    const m = await accion('auxiliar', `${EQ}#editarPublicacion`, [N, pub, { __campos: { texto: 'Otro', fecha: haceDias(3) } }]);
    const [p] = await sql`select fecha::text as fecha, texto from ninos_publicaciones where id = ${pub}`;
    comprobar(p.fecha === hoy && (m.error ?? '').includes('fecha no se puede cambiar'), 'pero no cambiarle la fecha', `${resumen(m)}; fecha ${p.fecha}`);
  }
  {
    // Quitar una foto de lo publicado, en un toque: la que se coló.
    const [{ id: unaFoto }] = await sql`select id from ninos_archivos where publicacion_id = ${pub} order by created_at limit 1`;
    const r = await accion('auxiliar', `${EQ}#quitarDePublicacion`, [N, pub, unaFoto]);
    const p = (await tablon('madre')).find((x) => x.id === pub);
    comprobar(r.guardado === 'quitado-de-publicacion' && (p?.archivos ?? []).length === 1, 'una foto se quita de lo publicado en un toque y las familias dejan de verla', `${resumen(r)}; quedan ${(p?.archivos ?? []).length}`);
  }
  {
    const r = await accion('auxiliar', `${EQ}#retirarPublicacion`, [N, pub]);
    comprobar(r.guardado === 'retirada' && !(await tablon('madre')).find((x) => x.id === pub), 'al retirarla, deja de verse en el tablón', resumen(r));
    const antes = await avisosDe(u.madre, 'ninos_publicacion');
    const otra = await accion('auxiliar', `${EQ}#publicar`, [N, pub, { __campos: { revisado: 'on' } }]);
    comprobar(otra.guardado === 'publicada' && Boolean((await tablon('madre')).find((x) => x.id === pub)), 'y al volver a publicarla, vuelve', resumen(otra));
    comprobar((await avisosDe(u.madre, 'ninos_publicacion')) === antes + 1, 'con un aviso nuevo');
  }
  {
    // Una publicación de antes de que llegaran Elena y Lucía, pero después de Paula.
    const r = await enviar('maestra', panel, 'name="texto"', { fecha: haceDias(5), texto: 'El martes pasado plantamos semillas' });
    const vieja = ultimaPublicacion(r);
    const antes2 = await avisosDe(u.madre2, 'ninos_publicacion');
    const p = await enviar('maestra', `${panel}/publicacion/${vieja}`, (h) => h.includes('Publicar') && !h.includes('name="texto"'), { revisado: 'on' });
    comprobar(p.guardado === 'publicada', 'la responsable publica desde el panel algo de hace cinco días', resumen(p));
    comprobar(Boolean((await tablon('madre')).find((x) => x.id === vieja)), 'Paula, aceptada hace diez días, lo ve');
    comprobar(!(await tablon('madre2')).find((x) => x.id === vieja), 'Elena, aceptada hoy, no: es de antes de que llegara');
    comprobar((await avisosDe(u.madre2, 'ninos_publicacion')) === antes2, 'y no le llega aviso de algo que no puede ver');
  }
  {
    const r = await accion('auxiliar', `${EQ}#borrarPublicacion`, [N, demo.ids.pubBorrador]);
    const [queda] = await sql`select id from ninos_publicaciones where id = ${demo.ids.pubBorrador}`;
    comprobar(r.guardado === 'borrada' && !queda, 'un borrador se borra', resumen(r));
  }
  {
    const r = await enviar('maestra', `${panel}/publicacion/${pub}`, 'Borrar la publicación');
    const [queda] = await sql`select id from ninos_publicaciones where id = ${pub}`;
    const sueltas = await sql`select id from ninos_archivos where id = ${fotoSuelta} and publicacion_id is null`;
    comprobar(r.guardado === 'borrada' && !queda, 'una publicación publicada se borra desde el panel', resumen(r));
    comprobar(sueltas.length === 1, 'y sus fotos se quedan en el drive, sin publicación');
    comprobar(!(await tablon('madre')).find((x) => x.id === pub), 'las familias dejan de verla');
  }
  {
    // Un ministerio que no es el suyo, con una publicación de verdad de este: no se cruzan.
    const [{ id: ajena }] = await sql`
      insert into ninos_publicaciones (iglesia_id, ministerio_id, fecha, texto, autor_miembro_id)
      values (${B}, ${N2}, ${hoy}, 'De la Escuela dominical', ${f.maestra}) returning id`;
    const r = await accion('auxiliar', `${EQ}#publicar`, [N, ajena, { __campos: {} }]);
    const [p] = await sql`select publicada_at from ninos_publicaciones where id = ${ajena}`;
    comprobar(!p.publicada_at, 'un maestro de un ministerio no publica lo de otro cambiando el id', resumen(r));
  }

  // =====================================================================
  bloque('8. Los permisos de fotos');
  // =====================================================================
  const pueden = async () => (await verPublicacion('maestra', demo.ids.pubNueva))?.pueden ?? [];
  {
    // Andrés no lo dio al pedir; lo da ahora desde «Mis hijos».
    const r = await accion('enlace', `${HIJOS}#darPermisoFotos`, [demo.ids.tomas]);
    const h = await misHijos('enlace');
    comprobar(r.guardado === 'fotos-si' && h.hijos?.[0]?.fotos === true, 'el padre de Tomás da después el permiso que no dio al pedir', resumen(r));
    comprobar((await pueden()).includes('Tomás'), 'con el permiso de los dos, Tomás ya puede salir', JSON.stringify(await pueden()));
  }
  {
    const antes = await avisosDe(u.maestra, 'ninos_sin_fotos');
    const r = await accion('madre', `${HIJOS}#quitarPermisoFotos`, [demo.ids.tomas]);
    const h = await misHijos('madre');
    comprobar(r.guardado === 'fotos-no' && h.hijos?.[0]?.fotos === false, 'Paula quita el permiso de fotos de Tomás', resumen(r));
    comprobar((await avisosDe(u.maestra, 'ninos_sin_fotos')) === antes + 1, 'a la responsable le llega el aviso, para quitar sus fotos');
    const v = await verPublicacion('maestra', demo.ids.pubNueva);
    comprobar(!(v?.pueden ?? []).includes('Tomás'), 'Tomás sale de la lista de quién puede salir', JSON.stringify(v?.pueden));
    const otra = await accion('madre', `${HIJOS}#quitarPermisoFotos`, [demo.ids.tomas]);
    comprobar(otra.guardado === 'fotos-no' && (await avisosDe(u.maestra, 'ninos_sin_fotos')) === antes + 1, 'quitarlo dos veces no manda otro aviso', resumen(otra));
  }
  {
    const r = await accion('madre', `${HIJOS}#darPermisoFotos`, [demo.ids.tomas]);
    const h = await misHijos('madre');
    const v = await verPublicacion('maestra', demo.ids.pubNueva);
    comprobar(r.guardado === 'fotos-si' && h.hijos?.[0]?.fotos === true && (v?.pueden ?? []).includes('Tomás'), 'lo vuelve a dar y Tomás vuelve a la lista', resumen(r));
    const dos = await accion('madre', `${HIJOS}#darPermisoFotos`, [demo.ids.tomas]);
    comprobar(dos.guardado === 'fotos-si', 'darlo dos veces no da error', resumen(dos));
    const [{ n }] = await sql`select count(*)::int as n from nino_consentimientos
                              where nino_id = ${demo.ids.tomas} and miembro_id = ${f.madre} and tipo = 'imagen' and revocado_at is null`;
    comprobar(n === 1, 'y queda un solo permiso vivo', `${n}`);
  }
  {
    const r = await accion('madre2', `${HIJOS}#darPermisoFotos`, [demo.ids.tomas]);
    comprobar((r.error ?? '').includes('No estás vinculado'), 'Elena no puede dar permisos sobre Tomás', resumen(r));
    await accion('madre2', `${HIJOS}#quitarPermisoFotos`, [demo.ids.tomas]);
    const h = await misHijos('madre');
    comprobar(h.hijos?.[0]?.fotos === true, 'ni quitar el de Paula');
  }
  {
    const r = await accion('enlace', `${HIJOS}#quitarPermisoFotos`, [demo.ids.tomas]);
    comprobar(r.guardado === 'fotos-no' && !(await pueden()).includes('Tomás'), 'si lo quita el padre, aunque la madre lo mantenga, Tomás deja de poder salir', `${resumen(r)}; ${JSON.stringify(await pueden())}`);
  }

  // =====================================================================
  bloque('9. Desvincularse y quitar familias');
  // =====================================================================
  {
    const r = await accion('enlace', `${HIJOS}#desvincularme`, [demo.ids.tomas]);
    const h = await misHijos('enlace');
    comprobar(r.guardado === 'desvinculado' && (h.hijos ?? []).length === 0, 'Andrés se desvincula de Tomás y deja de verle', resumen(r));
    comprobar((await tablon('enlace')).length === 0, 'y de ver el tablón');
    const hm = await misHijos('madre');
    comprobar(nombres(hm.hijos) === 'Tomás', 'Paula sigue con Tomás', nombres(hm.hijos));
    comprobar((await pueden()).includes('Tomás'), 'y como solo queda ella, con su permiso, Tomás vuelve a poder salir', JSON.stringify(await pueden()));
  }
  {
    const sofia = await ninoLlamado('Sofía');
    const r = await accion('madre2', `${HIJOS}#desvincularme`, [sofia]);
    comprobar(r.guardado === 'desvinculado' && !(await ninoLlamado('Sofía')), 'si se va la única familia de Sofía, su nombre y su año se borran', resumen(r));
    const [{ n }] = await sql`select count(*)::int as n from nino_consentimientos where nino_id = ${sofia} and revocado_at is null`;
    comprobar(n === 0, 'y no queda ningún permiso vivo suyo', `${n}`);
    const h = await misHijos('madre2');
    comprobar(nombres(h.hijos) === 'Lía', 'Elena se queda con Lía', nombres(h.hijos));
  }
  {
    const mateo = await ninoLlamado('Mateo');
    const r = await enviar('maestra', familias, (h) => h.includes(mateo) && h.includes(f.miembro) && !h.includes('name="nino"'));
    comprobar(r.guardado === 'quitada' && !(await ninoLlamado('Mateo')), 'la responsable quita a Lucía y Mateo se va con ella', resumen(r));
    comprobar((await tablon('miembro')).length === 0 && (await misHijos('miembro')).hijos?.length === 0, 'Lucía deja de ver el tablón y a Mateo');
  }

  // =====================================================================
  bloque('10. La responsable: borrar del drive y descargar el mes');
  // =====================================================================
  {
    const [fila] = await sql`select ruta from ninos_archivos where id = ${fotoSuelta}`;
    const r = await enviar('maestra', `${panel}/drive`, (h) => h.includes(fotoSuelta) || false);
    // El formulario de borrar lleva el id en sus argumentos.
    const [queda] = await sql`select id from ninos_archivos where id = ${fotoSuelta}`;
    const { data } = await admin.storage.from('ninos-fotos').list(fila.ruta.split('/').slice(0, -1).join('/'), { search: fila.ruta.split('/').pop() });
    comprobar(r.guardado === 'archivo-borrado' && !queda, 'borra una foto del drive', resumen(r));
    comprobar((data ?? []).length === 0, 'y el fichero desaparece de Storage, no solo la fila', `${(data ?? []).length} ficheros`);
  }
  {
    const mes = hoy.slice(0, 7);
    const z = await fetch(`${BASE}${panel}/drive/exportar?mes=${mes}`, { headers: { cookie: S.maestra.cookie }, redirect: 'manual' });
    const cuerpo = Buffer.from(await z.arrayBuffer());
    comprobar(
      z.status === 200 && (z.headers.get('content-type') ?? '').includes('zip') && cuerpo.subarray(0, 2).toString() === 'PK',
      'la responsable descarga el mes en un ZIP',
      `código ${z.status}, ${z.headers.get('content-type')}, ${cuerpo.length} bytes`,
    );
    comprobar(cuerpo.includes(Buffer.from('-foto.webp')) && cuerpo.includes(Buffer.from('-video.mp4')), 'con las fotos y los vídeos subidos dentro');
    const aux = await fetch(`${BASE}${panel}/drive/exportar?mes=${mes}`, { headers: { cookie: S.auxiliar.cookie }, redirect: 'manual' });
    comprobar(aux.status === 403, 'el maestro no puede descargar el mes', `código ${aux.status}`);
    const madre = await fetch(`${BASE}${panel}/drive/exportar?mes=${mes}`, { headers: { cookie: S.madre.cookie }, redirect: 'manual' });
    comprobar(madre.status !== 200, 'una madre tampoco', `código ${madre.status}`);
  }

  // =====================================================================
  bloque('11. La iglesia con la suscripción vencida');
  // =====================================================================
  const [{ trial_until: prueba }] = await sql`select trial_until from iglesias where id = ${B}`;
  try {
    await sql`update iglesias set trial_until = now() - interval '1 day' where id = ${B}`;
    {
      const r = await accion('auxiliar', `${EQ}#crearPublicacion`, [N, { __campos: { fecha: hoy, texto: 'Con la suscripción vencida' } }]);
      const [{ n }] = await sql`select count(*)::int as n from ninos_publicaciones where texto = 'Con la suscripción vencida'`;
      comprobar(n === 0, 'vencida (dentro de la gracia): el maestro no puede publicar', resumen(r));
      const p = await pedir('madre', { nombre: 'Hermanito' });
      comprobar(!(await solicitudDe(f.madre, 'Hermanito')), 'ni una familia pedir', resumen(p));
      const t = await app('madre', '/mi/hijos/tablon');
      comprobar(t.status === 200 && (t.json?.publicaciones ?? []).length > 0, 'pero Paula sigue viendo el tablón los tres días de gracia', `código ${t.status}`);
      const c = await app('auxiliar', `/mi/equipo/${N}/ninos/cronograma`);
      comprobar(c.status === 200, 'y el maestro, el cronograma', `código ${c.status}`);
    }
    await sql`update iglesias set trial_until = now() - interval '10 days' where id = ${B}`;
    {
      const t = await app('madre', '/mi/hijos/tablon');
      const c = await app('auxiliar', `/mi/equipo/${N}/ninos/cronograma`);
      // El muro es de quien gestiona, no de los miembros: el resto del área del
      // miembro tampoco se cierra (`guardaMiembro`, `lib/api/app.ts`).
      comprobar(c.status === 403, 'pasada la gracia, el maestro ya no entra a lo del equipo', `código ${c.status}`);
      comprobar(t.status === 200, 'y las familias siguen viendo su tablón, como el resto de la app del miembro', `código ${t.status}`);
    }
  } finally {
    await sql`update iglesias set trial_until = ${prueba} where id = ${B}`;
  }

  // =====================================================================
  bloque('12. El pastor apaga el tablón');
  // =====================================================================
  {
    const m = (await sql`select modulos from ministerios where id = ${N}`)[0].modulos;
    const encendidos = Object.entries(m).filter(([k, v]) => v?.activo && k !== 'ninos').map(([k]) => k);
    const r = await enviar('pastor', `/panel/ministerios/${N}/editar`, 'name="nombre"', { modulos: encendidos, compromiso_ninos: null });
    const despues = (await sql`select modulos from ministerios where id = ${N}`)[0].modulos;
    comprobar(!despues.ninos?.activo, 'el pastor apaga el tablón sin que le pida nada', resumen(r));
    const a = await accion('maestra', `${EQ}#crearPublicacion`, [N, { __campos: { fecha: hoy, texto: 'Con el tablón apagado' } }]);
    const [{ n }] = await sql`select count(*)::int as n from ninos_publicaciones where texto = 'Con el tablón apagado'`;
    comprobar(n === 0, 'apagado, nadie publica', resumen(a));
    const p = await pedir('miembro', { nombre: 'Mateo' });
    comprobar((p.error ?? '').includes('tablón'), 'ni se puede pedir entrar', resumen(p));
    const h = await misHijos('madre');
    comprobar(!(h.ministerios ?? []).some((x) => x.id === N), 'a las familias ya no les sale para pedir', JSON.stringify(h.ministerios));
    const t = await tablon('madre');
    comprobar(t.length === 0, 'apagado, las familias dejan de ver lo publicado y sus fotos', JSON.stringify(textos(t)));
    comprobar(nombres(h.hijos) === 'Tomás', 'pero siguen viendo a su hijo, para poder quitar permisos', nombres(h.hijos));
    const q = await accion('madre', `${HIJOS}#quitarPermisoFotos`, [demo.ids.tomas]);
    comprobar(q.guardado === 'fotos-no', 'y quitar el permiso de fotos sigue funcionando', resumen(q));
    const d = await accion('madre2', `${HIJOS}#desvincularme`, [demo.ids.lia]);
    comprobar(d.guardado === 'desvinculado' && (await misHijos('madre2')).hijos?.length === 0, 'igual que desvincularse', resumen(d));
    const e = await app('maestra', `/mi/equipo/${N}/ninos`);
    comprobar(cerrada(e), 'y la pantalla del equipo deja de abrirse', `código ${e.status}`);
  }
}

/** Prepara una subida por la app y devuelve lo que contestó `prepararSubida`. */
async function prepararComo(quien, { tipo = 'foto', mime, contenido, bytes, fecha, duracionS, publicacionId, ministerio }) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const campos = { tipo, mime, bytes: String(bytes ?? contenido.length), fecha: fecha ?? hoy };
  if (duracionS != null) campos.duracionS = String(duracionS);
  if (publicacionId) campos.publicacionId = publicacionId;
  return accion(quien, `${EQ}#prepararSubida`, [ministerio ?? MINISTERIO, { __campos: campos }]);
}

/** Prepara, sube el fichero a la URL firmada y confirma, como el teléfono. */
async function subirComo(quien, opciones) {
  const p = await prepararComo(quien, opciones);
  const v = p.valor;
  if (!v?.ok) return { ok: false, error: v?.error ?? p.error ?? p.texto.slice(0, 160) };
  if (!opciones.noSubir) await putFirmado(v.fichero.url, opciones.contenido, opciones.mimeSubida ?? opciones.mime);
  const c = await accion(quien, `${EQ}#confirmarSubida`, [opciones.ministerio ?? MINISTERIO, v.id]);
  return { ok: c.valor?.ok === true, id: v.id, error: c.valor?.error ?? c.error };
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
