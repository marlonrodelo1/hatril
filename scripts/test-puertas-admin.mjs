/**
 * Test de puertas de `/admin`: lo que consulta el panel de super admin no le
 * llega a nadie más, ni por la navegación normal ni pidiendo el payload RSC.
 *
 *   npm run test:puertas:admin
 *
 * Necesita el servidor de DESARROLLO encendido (`npm run dev`), por lo mismo
 * que `test-puertas.mjs`: la comprobación de «la página cortó ella sola» lee los
 * metadatos de segmento que Next solo pone en el payload en desarrollo.
 *
 * POR QUÉ UN TEST APARTE Y NO DENTRO DE `test-puertas.mjs`
 * --------------------------------------------------------
 * Aquel está construido alrededor del pastor de Betania: de su respuesta salen
 * los testigos, y es la cuenta que «sí puede» en todas las rutas. En `/admin`
 * el pastor es justo de los que NO pueden, y la cuenta que sí es otra. Meterlo
 * allí obligaba a doblar cada comprobación.
 *
 * POR QUÉ IMPORTA MÁS QUE EN EL PANEL
 * -----------------------------------
 * Todo `/admin` consulta con `dbAdmin`, que salta la RLS. En el panel, una
 * página sin guarda filtra los datos de SU iglesia; aquí filtraría los de
 * todas, y las cuentas de todas. `requireSuperAdmin()` en cada página es la
 * única puerta que hay.
 *
 * QUÉ MIRA
 * --------
 * Para cada ruta, la cuenta de super admin la pinta, y las demás —un pastor, un
 * miembro, una cuenta sin iglesia, el pastor de otra iglesia— no reciben ningún
 * testigo: ni un nombre de iglesia ni un correo de cuenta. Y además la PÁGINA
 * es la que corta (su segmento del payload es el `redirect('/')`), no solo el
 * layout. Sin sesión, la corta el proxy hacia `/acceso`.
 *
 * Toda `page.tsx` bajo `src/app/admin` tiene que estar en `rutas()`: una
 * pantalla nueva que nadie añade aquí es la que se quedaría sin puerta.
 *
 *   PUERTAS_URL        base del servidor (por defecto http://localhost:3000)
 *   PUERTAS_CONTROL=1  control negativo: todas las cuentas piden con la sesión
 *                      del super admin. Todos los casos de «no puede» tienen
 *                      que salir FALLO; es la prueba de que el test ve una fuga.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const BASE = (process.env.PUERTAS_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_PUBLICABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const CONTROL = process.env.PUERTAS_CONTROL === '1';

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

const ADMIN = 'admin@hatril.test';
// Las que NO pueden, cada una por un camino distinto hasta el panel.
const NO_PUEDEN = [
  'pastor@hatril.test', // pastor: lo puede todo en SU iglesia
  'miembro@hatril.test', // miembro raso
  'visita@hatril.test', // sin iglesia, como el super admin
  'pastor.sion@hatril.test', // pastor de otra iglesia, con la suscripción bloqueada
];
const SIN_SESION = '(sin sesión)';

// ============================================
// Datos: los testigos y los ids, en solo lectura
// ============================================

const admin = createClient(SUPABASE_URL, CLAVE_SERVICIO, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publico = createClient(SUPABASE_URL, CLAVE_PUBLICABLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

/**
 * Testigos: el nombre de cada iglesia y el correo de cada cuenta. Es lo que
 * enseñan las pantallas de `/admin` y lo que nadie más debería recibir junto:
 * un pastor conoce su iglesia, pero no la lista de las demás ni sus correos.
 */
async function leerDatos() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', prepare: false, max: 1 });
  try {
    return await sql.begin('read only', async (tx) => {
      const iglesias = await tx`select id, slug, nombre from iglesias`;
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const correos = data.users.map((u) => u.email).filter(Boolean);
      const betania = iglesias.find((i) => i.slug === 'betania');
      const pastor = data.users.find((u) => u.email === 'pastor@hatril.test');
      if (!betania || !pastor) throw new Error('Falta la demo: Betania o pastor@hatril.test.');
      return {
        ids: { betania: betania.id, pastor: pastor.id },
        testigos: [...iglesias.map((i) => i.nombre), ...correos],
      };
    });
  } finally {
    await sql.end();
  }
}

/** La cookie de `@supabase/ssr`, como en `test-puertas.mjs` (el porqué, allí). */
async function abrirSesion(email) {
  const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (e1) throw new Error(`${email}: ${e1.message}`);
  const { data, error: e2 } = await publico.auth.verifyOtp({
    token_hash: enlace.properties.hashed_token,
    type: 'magiclink',
  });
  if (e2 || !data.session) throw new Error(`${email}: ${e2?.message ?? 'sin sesión'}`);

  const valor = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
  const trozos = [];
  for (let i = 0; i < valor.length; i += 3180) trozos.push(valor.slice(i, i + 3180));
  const nombre = `sb-${REF}-auth-token`;
  const cookie =
    trozos.length === 1
      ? `${nombre}=${valor}`
      : trozos.map((t, i) => `${nombre}.${i}=${t}`).join('; ');
  return { cookie, accessToken: data.session.access_token };
}

// ============================================
// Pedir y leer
// ============================================

async function pedir(cookie, ruta, rsc) {
  const cabeceras = { ...(cookie ? { cookie } : {}), ...(rsc ? { RSC: '1' } : { accept: 'text/html' }) };
  const opciones = { redirect: 'manual', headers: cabeceras, signal: AbortSignal.timeout(120_000) };

  let r = await fetch(BASE + ruta, opciones);
  const location = r.headers.get('location') ?? '';
  // Solo se sigue la redirección de Next al `?_rsc`; las de las guardas, no.
  if (rsc && r.status >= 300 && r.status < 400 && /[?&]_rsc(=|&|$)/.test(location)) {
    r = await fetch(new URL(location, BASE), opciones);
  }
  return { status: r.status, location: r.headers.get('location') ?? '', cuerpo: await r.text() };
}

function payloadDelHtml(html) {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      out += JSON.parse(m[1]);
    } catch {
      // Un trozo que no es JSON no es payload.
    }
  }
  return out;
}

/** El destino del `redirect()` con el que cortó el segmento de la PÁGINA, o null. */
function corteDeLaPagina(payload) {
  const m = /"type":"page","pagePath":"([^"]+)","children":"\$L([0-9a-f]+)"/.exec(payload);
  if (!m) return { estado: 'sin-metadatos' };
  const fila = m[2];
  const error = payload.split('\n').find((l) => l.startsWith(fila + ':E'));
  if (!error) return { estado: 'pinta' };
  let digest = '';
  try {
    digest = JSON.parse(error.slice(fila.length + 2)).digest ?? '';
  } catch {
    digest = '';
  }
  const r = /^NEXT_REDIRECT;[a-z]+;(.*);\d{3};?$/.exec(digest);
  return r ? { estado: 'redirige', destino: r[1] } : { estado: `error ${digest}` };
}

function testigosEn(texto, testigos) {
  // El payload RSC escapa como `&` lo que el HTML no; se compara sobre
  // las dos formas sin acentos de por medio.
  return testigos.filter((t) => texto.includes(t) || texto.includes(JSON.stringify(t).slice(1, -1)));
}

// ============================================
// Rutas
// ============================================

function rutas(ids) {
  return [
    { url: '/admin', pagePath: 'admin/page.tsx' },
    { url: '/admin/iglesias', pagePath: 'admin/iglesias/page.tsx' },
    { url: `/admin/iglesias/${ids.betania}`, pagePath: 'admin/iglesias/[id]/page.tsx' },
    { url: '/admin/cuentas', pagePath: 'admin/cuentas/page.tsx' },
    { url: `/admin/cuentas/${ids.pastor}`, pagePath: 'admin/cuentas/[id]/page.tsx' },
  ];
}

function sinCubrir(defs) {
  const raiz = fileURLToPath(new URL('../src/app/', import.meta.url));
  const enDisco = readdirSync(join(raiz, 'admin'), { recursive: true })
    .map((f) => 'admin/' + String(f).replaceAll('\\', '/'))
    .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f));
  const cubiertos = new Set(defs.map((d) => d.pagePath));
  return enDisco.filter((f) => !cubiertos.has(f)).sort();
}

// ============================================
// Comprobar
// ============================================

async function comprobar(def, sesiones, testigos) {
  const resultados = [];
  const ok = (cuenta, esperado, obtenido, bien) =>
    resultados.push({ ruta: def.url, cuenta, esperado, obtenido, ok: bien });

  // El super admin: tiene que pintarse y traer testigos. Si no trae ninguno,
  // el resto de comprobaciones no demostraría nada.
  {
    const s = sesiones[ADMIN];
    const normal = await pedir(s.cookie, def.url, false);
    const vistos = testigosEn(normal.cuerpo, testigos);
    ok(
      ADMIN,
      '200 con testigos',
      `${normal.status}, ${vistos.length} testigos`,
      normal.status === 200 && vistos.length > 0,
    );
  }

  for (const cuenta of [...NO_PUEDEN, SIN_SESION]) {
    const s = sesiones[cuenta];
    const cookie = s?.cookie ?? null;
    const [normal, rsc] = await Promise.all([pedir(cookie, def.url, false), pedir(cookie, def.url, true)]);
    const fuga = [...new Set([...testigosEn(normal.cuerpo, testigos), ...testigosEn(rsc.cuerpo, testigos)])];

    if (cuenta === SIN_SESION) {
      // Sin sesión corta el proxy, antes que nada: no hay segmento que leer.
      const bien = normal.status === 307 && normal.location.startsWith('/acceso') && fuga.length === 0;
      ok(cuenta, '307 → /acceso, sin testigos', `${normal.status} → ${normal.location}${fuga.length ? ` FUGA ${fuga.length}` : ''}`, bien);
      continue;
    }

    // Su propio correo puede salir en cualquier parte sin que sea fuga.
    const ajenos = fuga.filter((t) => t !== cuenta);
    const segRsc = corteDeLaPagina(rsc.cuerpo);
    const segHtml = corteDeLaPagina(payloadDelHtml(normal.cuerpo));
    const cortaLaPagina = [segRsc, segHtml].every((x) => x.estado === 'redirige' && x.destino === '/');
    const bien = cortaLaPagina && ajenos.length === 0;
    const describir = (x) => (x.estado === 'redirige' ? `página→${x.destino}` : `página ${x.estado}`);
    ok(
      cuenta,
      'la página corta → /, sin testigos',
      `html ${describir(segHtml)} · rsc ${describir(segRsc)}${ajenos.length ? ` · FUGA: ${ajenos.slice(0, 3).join(', ')}` : ''}`,
      bien,
    );
  }
  return resultados;
}

async function main() {
  try {
    await fetch(BASE + '/', { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch {
    console.error(`No responde ${BASE}. Hace falta el servidor de desarrollo: npm run dev.`);
    process.exit(2);
  }

  const { ids, testigos } = await leerDatos();
  console.log(`Datos leídos en solo lectura: ${testigos.length} testigos.`);

  const abiertas = {};
  for (const email of [ADMIN, ...NO_PUEDEN]) abiertas[email] = await abrirSesion(email);

  const sesiones = CONTROL
    ? Object.fromEntries(Object.keys(abiertas).map((e) => [e, abiertas[ADMIN]]))
    : abiertas;
  if (CONTROL) console.log('  · CONTROL NEGATIVO: todas las cuentas piden con la sesión del super admin.');

  try {
    const defs = rutas(ids);
    const resultados = [];
    for (const def of defs) resultados.push(...(await comprobar(def, sesiones, testigos)));
    for (const fichero of sinCubrir(defs)) {
      resultados.push({
        ruta: `src/app/${fichero}`,
        cuenta: '-',
        esperado: 'cubierta por este test',
        obtenido: 'no está en rutas(): añádela',
        ok: false,
      });
    }

    let anterior = '';
    for (const r of resultados) {
      if (r.ruta !== anterior) {
        console.log('\n' + r.ruta);
        anterior = r.ruta;
      }
      console.log(`  ${r.ok ? 'ok   ' : 'FALLO'} ${r.cuenta.padEnd(26)} espera ${r.esperado.padEnd(36)} ${r.obtenido}`);
    }

    const fallos = resultados.filter((r) => !r.ok);
    console.log(`\n${defs.length} rutas, ${resultados.length} combinaciones, ${fallos.length} fallos.`);

    if (CONTROL) {
      // Con la sesión del super admin para todos, cada caso de cuenta con
      // sesión que «no puede» tiene que fallar. Los de sin sesión no cambian.
      const denegados = resultados.filter((r) => NO_PUEDEN.includes(r.cuenta));
      const sinDetectar = denegados.filter((r) => r.ok);
      console.log(`Control negativo: ${denegados.length - sinDetectar.length} de ${denegados.length} detectados.`);
      process.exitCode = sinDetectar.length ? 1 : 0;
      return;
    }
    process.exitCode = fallos.length ? 1 : 0;
  } finally {
    for (const s of Object.values(abiertas)) {
      await admin.auth.admin.signOut(s.accessToken, 'local').catch(() => {});
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
