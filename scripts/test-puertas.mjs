/**
 * Test de puertas: lo que consulta una página del panel no llega a quien no
 * puede verla, ni por la navegación normal ni pidiendo el payload RSC.
 *
 *   npm run test:puertas
 *
 * NECESITA EL SERVIDOR DE DESARROLLO ENCENDIDO
 * -------------------------------------------
 * `npm run dev` en http://localhost:3000 (o la URL de PUERTAS_URL). El test
 * habla con la aplicación de verdad por HTTP, con la sesión de cada cuenta de
 * la demo; sin servidor no hay nada que probar y sale con código 2. Tiene que
 * ser el de DESARROLLO: la comprobación de «la página cortó ella sola» lee los
 * metadatos de segmento que Next solo pone en el payload en desarrollo (ver
 * «Qué mira» más abajo).
 *
 * POR QUÉ EXISTE
 * --------------
 * En Next 16 un `layout.tsx` no impide que su página se ejecute, y lo que la
 * página consulta viaja en el payload RSC aunque el layout redirija
 * (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`, «Layouts
 * and auth checks»). Así se encontró: `miembro@`, un miembro raso sin panel y
 * sin `ver_seguimiento`, pidió `/panel/ministerios/<Consolidación>/seguimiento`
 * con la cabecera `RSC: 1` y se llevó la lista entera, con trece teléfonos,
 * mientras `panel/layout.tsx` le mandaba a `/mi`. Typecheck, lint y el test de
 * aislamiento estaban en verde: entre iglesias aguantaba, y dentro de la
 * iglesia la RLS es por iglesia, no por permiso.
 *
 * La regla que salió de ahí está en CLAUDE.md y en `src/lib/auth/guard-panel.ts`:
 * toda página aplica ELLA MISMA la cadena entera de puertas de sus layouts, y
 * todo `route.ts` la suya. Este test es lo que impide que se olvide en la
 * próxima página que se escriba.
 *
 * QUÉ HACE
 * --------
 * 1. Lee de la base de demo, en una transacción `read only`, los ids reales de
 *    Betania (Alabanza, Consolidación, Acción social, la Radio si está, una
 *    reunión, un turno, una canción, un beneficiario…) y los datos que sirven
 *    de testigo: nombres y teléfonos de personas, correos, direcciones, notas,
 *    beneficiarios, inscritos, canciones, conceptos e importes. No escribe nada.
 * 2. Abre sesión sin contraseña para cada cuenta: `generateLink` con la clave
 *    de servicio y `verifyOtp` con la publicable, y monta la cookie de
 *    `@supabase/ssr` a mano. Al terminar revoca cada sesión.
 * 3. Pide cada ruta DOS veces: la normal y la que hace el router del cliente,
 *    con `RSC: 1`. Next 16 contesta a esa segunda con un 307 a `?_rsc`, y se
 *    sigue a mano con la misma cabecera; las demás redirecciones NO se siguen,
 *    porque son justo lo que se está mirando.
 *
 * QUÉ MIRA: ES DIFERENCIAL
 * ------------------------
 * Para cada ruta hay una cuenta que SÍ puede (`pastor@`) y otras que NO. De la
 * respuesta del pastor salen los testigos que trae de verdad esa página, y
 * ninguno puede aparecer en la de quien no puede, ni en la normal ni en la RSC.
 * Lo que la cuenta denegada ya ve en su propio panel (su nombre en la cabecera,
 * sus avisos) se descuenta: se mide con su respuesta a `/panel/cuenta/contrasena`.
 *
 * Y como una página con la demo vacía no trae testigos —hoy no hay movimientos
 * de caja ni inscritos en eventos—, se mira además QUIÉN cortó: el payload de
 * desarrollo marca el segmento de la página con su `pagePath`, y la fila de ese
 * segmento tiene que ser el error de `redirect()` o `notFound()` de la PROPIA
 * página, con el destino que toca. Si solo corta el layout, la fila de la
 * página trae lo que pintó, y eso es justo el fallo de origen aunque hoy no
 * haya datos que se escapen.
 *
 * Los `route.ts` de exportar no pasan por ningún layout: ahí se mira el código
 * (403) y que el CSV no traiga ningún testigo.
 *
 * Y toda `page.tsx` y `route.ts` que haya en disco bajo `src/app/panel` tiene
 * que estar en `rutas()`. Una página nueva sin añadir aquí es un fallo: es la
 * que se quedaría sin puerta sin que nada avisara.
 *
 * FUERA DEL PANEL, SOLO LO QUE SE AÑADE A PROPÓSITO
 * -------------------------------------------------
 * `/mi/equipo/<id>/fondo` enseña los importes del fondo de un ministerio desde
 * la app, así que entra aquí aunque no cuelgue de `/panel`. Ahí no se rebota con
 * mensaje: quien no puede recibe un 404 de la PROPIA página (ver
 * `src/lib/ministerios/en-la-app/guarda.ts`), y para eso está el caso
 * `'oculta'`, que es el 404 de quien no puede y por eso, además, se mira que no
 * traiga ningún testigo del pastor. La cobertura de `/mi` no se exige entera
 * —todavía hay pantallas que no están aquí—: solo las de `FUERA_DEL_PANEL`, que
 * tienen que existir en disco y estar en `rutas()`.
 *
 * VARIABLES
 * ---------
 *   PUERTAS_URL       base del servidor (por defecto http://localhost:3000)
 *   PUERTAS_JSON      fichero donde dejar los resultados en JSON
 *   PUERTAS_VOLCADO   carpeta donde dejar cada respuesta, para leerla a mano
 *   PUERTAS_SOLO      subcadena: solo las rutas cuya etiqueta la contenga
 *   PUERTAS_CONTROL=1 control negativo: toda cuenta pide con la sesión del
 *                     pastor, como si cada página hubiera perdido su puerta.
 *                     Todos los casos de «no puede» tienen que salir FALLO, y
 *                     sale con 0 solo si es así. Es la prueba de que el test
 *                     sabe ver una fuga, no solo de que hoy no la hay.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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
const VOLCADO = process.env.PUERTAS_VOLCADO;
const SOLO = process.env.PUERTAS_SOLO;
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

// Las cuentas de `scripts/seed-demo.sql` y `seed-base-comun.sql`.
const PASTOR = 'pastor@hatril.test'; // pastor de Betania: lo puede todo
const SECRETARIA = 'secretaria@hatril.test'; // fichero, eventos y asistencia; nada de pastor ni de caja
const LIDER = 'lider@hatril.test'; // responsable de Alabanza; sin ver_seguimiento
const COLIDER = 'colider@hatril.test'; // miembro, colíder de Acción social y Radio
const CONSOLIDACION = 'consolidacion@hatril.test'; // miembro con ver_seguimiento, responsable de Consolidación
const MIEMBRO = 'miembro@hatril.test'; // miembro raso: voluntario en Alabanza, sin panel
const ENLACE = 'enlace@hatril.test'; // miembro raso: voluntario en Acción social, sin panel
const SION = 'pastor.sion@hatril.test'; // pastor de OTRA iglesia, con la suscripción bloqueada

const CUENTAS = [PASTOR, SECRETARIA, LIDER, COLIDER, CONSOLIDACION, MIEMBRO, ENLACE, SION];
const IMPRESCINDIBLES = [PASTOR, MIEMBRO];

// La página a la que todas las cuentas del equipo llegan sin consultar nada de
// nadie: lo que traiga es el marco del panel de esa cuenta.
const RUTA_MARCO = '/panel/cuenta/contrasena';

// Las páginas de fuera de `src/app/panel` que este test cubre a propósito, con
// la misma exigencia que las del panel: existir y estar en `rutas()`.
const FUERA_DEL_PANEL = ['mi/equipo/[id]/fondo/page.tsx'];

// ============================================
// 1. La base de demo, en solo lectura
// ============================================

async function leerDemo() {
  const sql = postgres(DATABASE_URL, { prepare: false, ssl: 'require', max: 1 });
  try {
    return await sql.begin('read only', async (sql) => {
      const [iglesia] = await sql`select id from iglesias where slug = 'betania'`;
      if (!iglesia) throw new Error('No está la iglesia «betania»: falta la semilla de la demo.');
      const B = iglesia.id;

      const mins = await sql`
        select id, nombre from ministerios
         where iglesia_id = ${B} and nombre in ('Alabanza', 'Consolidación', 'Acción social')`;
      const min = Object.fromEntries(mins.map((m) => [m.nombre, m.id]));
      for (const n of ['Alabanza', 'Consolidación', 'Acción social']) {
        if (!min[n]) throw new Error(`No está el ministerio «${n}» en Betania.`);
      }

      const uno = async (q) => (await q)[0]?.id ?? null;

      const ids = {
        alabanza: min['Alabanza'],
        consolidacion: min['Consolidación'],
        accionSocial: min['Acción social'],
        // De `seed-radio.sql`, que va aparte de la demo: si falta, la emisora
        // queda cubierta solo con su caso de herramienta apagada.
        radio: await uno(sql`
          select id from ministerios
           where iglesia_id = ${B} and tipo = 'radio'
             and coalesce((modulos -> 'emisora' ->> 'activo')::boolean, false)
           order by orden, nombre limit 1`),
        reunionAlabanza: await uno(sql`
          select id from reuniones where ministerio_id = ${min['Alabanza']}
           order by fecha desc limit 1`),
        reunionCongregacion: await uno(sql`
          select r.id from reuniones r left join asistencias a on a.reunion_id = r.id
           where r.iglesia_id = ${B} and r.ministerio_id is null
           group by r.id order by count(a.id) desc, max(r.fecha) desc limit 1`),
        turnoAlabanza: await uno(sql`
          select t.id from turnos t left join turno_asignaciones ta on ta.turno_id = t.id
           where t.ministerio_id = ${min['Alabanza']}
           group by t.id order by count(ta.id) desc, max(t.fecha) desc limit 1`),
        cancionAlabanza: await uno(sql`
          select id from canciones where ministerio_id = ${min['Alabanza']}
           order by titulo limit 1`),
        personaSeguimiento: (
          await sql`
            select miembro_id as id from seguimiento_contactos
             where ministerio_id = ${min['Consolidación']}
             order by (proximo_paso is not null) desc, fecha desc limit 1`
        )[0]?.id ?? null,
        beneficiario: await uno(sql`
          select id from reparto_beneficiarios
           where ministerio_id = ${min['Acción social']} and baja_at is null
           order by numero limit 1`),
        movimiento: await uno(sql`
          select id from movimientos where iglesia_id = ${B} order by fecha desc limit 1`),
        // El fondo que el pastor vinculó a Acción social desde Fondos y cajas.
        // Sin él, la pestaña «Fondo» no existe para nadie y el caso pasa a 404.
        fondoAccionSocial: await uno(sql`
          select id from fondos
           where ministerio_id = ${min['Acción social']} and activo limit 1`),
        evento: await uno(sql`
          select e.id from eventos e left join evento_inscripciones i on i.evento_id = e.id
           where e.iglesia_id = ${B}
           group by e.id order by count(i.id) desc, max(e.inicio_en) desc limit 1`),
        // La ficha con más datos protegidos, de alguien sin cuenta: no es nadie
        // que haga la prueba.
        ficha: await uno(sql`
          select id from miembros
           where iglesia_id = ${B} and archivado_at is null and auth_user_id is null
           order by ((direccion is not null)::int + (notas is not null)::int
                     + (telefono is not null)::int + (email is not null)::int) desc,
                    nombre
           limit 1`),
      };

      // Los testigos: datos de personas y de la caja, tal como están en la base.
      const testigos = [];
      const anadir = (valor, tipo) => {
        if (typeof valor !== 'string') return;
        const v = valor.trim();
        if (v.length >= 5) testigos.push({ valor: v, tipo });
      };
      const telefono = (valor, tipo) => {
        // Solo los dígitos: casa con «+573001234567», con «tel:» y con «wa.me/57…».
        const d = (valor ?? '').replace(/\D/g, '');
        if (d.length >= 9) testigos.push({ valor: d, tipo });
      };

      for (const m of await sql`
        select nombre, apellidos, telefono, email, direccion, notas
          from miembros where iglesia_id = ${B}`) {
        anadir(`${m.nombre} ${m.apellidos ?? ''}`, 'persona');
        // Por si la página pinta nombre y apellidos en nodos distintos.
        if ((m.apellidos ?? '').trim().includes(' ')) anadir(m.apellidos, 'persona');
        telefono(m.telefono, 'teléfono');
        anadir(m.email, 'correo');
        anadir(m.direccion, 'dirección');
        anadir(m.notas, 'nota de ficha');
      }
      for (const b of await sql`
        select nombre, telefono from reparto_beneficiarios where iglesia_id = ${B}`) {
        anadir(b.nombre, 'beneficiario');
        telefono(b.telefono, 'teléfono');
      }
      for (const i of await sql`
        select nombre, email, telefono, nota from evento_inscripciones where iglesia_id = ${B}`) {
        anadir(i.nombre, 'inscrito');
        anadir(i.email, 'correo');
        telefono(i.telefono, 'teléfono');
        anadir(i.nota, 'nota de inscrito');
      }
      for (const s of await sql`
        select proximo_paso from seguimiento_contactos where iglesia_id = ${B}`) {
        anadir(s.proximo_paso, 'seguimiento');
      }
      for (const r of await sql`select notas from reuniones where iglesia_id = ${B}`) {
        anadir(r.notas, 'nota de reunión');
      }
      for (const t of await sql`select notas from turnos where iglesia_id = ${B}`) {
        anadir(t.notas, 'nota de turno');
      }
      for (const c of await sql`select titulo from canciones where iglesia_id = ${B}`) {
        anadir(c.titulo, 'canción');
      }
      for (const e of await sql`select titulo from eventos where iglesia_id = ${B}`) {
        anadir(e.titulo, 'evento');
      }
      for (const m of await sql`
        select concepto, importe from movimientos where iglesia_id = ${B}`) {
        anadir(m.concepto, 'concepto');
        const n = Math.round(Number(m.importe));
        if (n >= 1000) anadir(new Intl.NumberFormat('es-CO').format(n), 'importe');
      }
      for (const f of await sql`
        select nombre from fondos where iglesia_id = ${B}
        union select nombre from cajas where iglesia_id = ${B}`) {
        anadir(f.nombre, 'fondo o caja');
      }

      // Sin repetidos: dos personas con los mismos apellidos son un testigo.
      const vistos = new Set();
      const unicos = testigos.filter((t) => !vistos.has(t.valor) && vistos.add(t.valor));
      return { ids, testigos: unicos };
    });
  } finally {
    await sql.end();
  }
}

// ============================================
// 2. Sesiones sin contraseña
// ============================================

const admin = createClient(SUPABASE_URL, CLAVE_SERVICIO, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publico = createClient(SUPABASE_URL, CLAVE_PUBLICABLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

/**
 * La cookie que dejaría `@supabase/ssr` tras iniciar sesión: `sb-<ref>-auth-token`
 * con `'base64-' + base64url(JSON de la sesión)`, troceada en `.0`, `.1`… cada
 * 3180 caracteres cuando no cabe en una.
 */
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
// 3. Pedir y leer la respuesta
// ============================================

async function pedir(cookie, ruta, rsc) {
  const cabeceras = rsc
    ? { cookie, RSC: '1' }
    : { cookie, accept: 'text/html,application/xhtml+xml' };
  const opciones = { redirect: 'manual', headers: cabeceras, signal: AbortSignal.timeout(120_000) };

  let r = await fetch(BASE + ruta, opciones);
  const location = r.headers.get('location') ?? '';
  // Solo se sigue la redirección de Next al `?_rsc` (a veces sin valor); las de
  // las guardas, no.
  if (rsc && r.status >= 300 && r.status < 400 && /[?&]_rsc(=|&|$)/.test(location)) {
    r = await fetch(new URL(location, BASE), { ...opciones, signal: AbortSignal.timeout(120_000) });
  }
  return {
    status: r.status,
    location: r.headers.get('location') ?? '',
    tipo: r.headers.get('content-type') ?? '',
    cuerpo: await r.text(),
  };
}

/** El payload RSC que va dentro del HTML, en los `self.__next_f.push([1,"…"])`. */
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

function destinoDeDigest(digest) {
  // NEXT_REDIRECT;replace;/panel/hoy?error=…;307;
  const m = /^NEXT_REDIRECT;[a-z]+;(.*);\d{3};?$/.exec(digest);
  if (m) return m[1];
  if (/^NEXT_HTTP_ERROR_FALLBACK;404/.test(digest)) return '404';
  return `error ${digest}`;
}

/**
 * Qué hizo el segmento de la PÁGINA, leído del payload: en desarrollo cada
 * segmento lleva `{"type":"page","pagePath":"…/page.tsx","children":"$L<fila>"}`
 * y la fila es o lo que la página pintó, o el error con el que cortó.
 */
function segmentoDePagina(payload) {
  const m = /"type":"page","pagePath":"([^"]+)","children":"\$L([0-9a-f]+)"/.exec(payload);
  if (!m) return { estado: 'sin-metadatos' };
  const [, pagina, fila] = m;
  const lineas = payload.split('\n').filter((l) => l.startsWith(fila + ':'));
  const error = lineas.find((l) => l.startsWith(fila + ':E'));
  if (error) {
    let digest = '';
    try {
      digest = JSON.parse(error.slice(fila.length + 2)).digest ?? '';
    } catch {
      digest = '';
    }
    const destino = destinoDeDigest(digest);
    return { estado: destino === '404' ? '404' : destino.startsWith('error') ? 'error' : 'redirige', destino, pagina };
  }
  if (lineas.some((l) => !l.startsWith(fila + ':D'))) return { estado: 'pinta', pagina };
  return { estado: 'sin-fila', pagina };
}

function pajar(texto) {
  const plano = texto
    .replace(/<!-- -->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return plano + '\n' + plano.replace(/\\"/g, '"');
}

function testigosEn(texto, testigos) {
  const p = pajar(texto);
  return new Set(testigos.filter((t) => p.includes(t.valor)).map((t) => t.valor));
}

// ============================================
// 4. Las rutas
// ============================================

/*
 * Lo que se espera de cada cuenta en cada ruta:
 *   'pinta'        200 y la página se pinta (quien SÍ puede)
 *   '/mi', '/suscripcion'   la página redirige ahí ella sola
 *   'hoy'          la página redirige a /panel/hoy?error=…  (falta permiso o no es pastor)
 *   'min'          la página redirige a /panel/ministerios?error=…  (no lleva ESTE equipo)
 *   '404'          la página da notFound() (herramienta apagada, o no existe)
 *   'oculta'       la página da notFound() porque esta cuenta no puede verla
 *                  (la app, `/mi/equipo`): el 404 de '404' y, además, ninguno
 *                  de los testigos del pastor
 *   'csv' / 403    para los route.ts
 *
 * Por defecto: el pastor pinta, el miembro raso va a /mi y el pastor de Sion,
 * con su suscripción bloqueada, a /suscripcion antes de que nada se consulte.
 */
function rutas(ids) {
  const r = [];
  const pagina = (etiqueta, url, pagePath, casos = {}) =>
    r.push({
      etiqueta,
      url,
      pagePath,
      casos: { [PASTOR]: 'pinta', [MIEMBRO]: '/mi', [SION]: '/suscripcion', ...casos },
    });
  const ruta = (etiqueta, url, fichero, casos) =>
    r.push({
      etiqueta,
      url,
      fichero,
      routeTs: true,
      casos: { [PASTOR]: 'csv', [MIEMBRO]: 403, [SION]: 403, ...casos },
    });

  const NO_PASTOR = { [SECRETARIA]: 'hoy', [LIDER]: 'hoy', [COLIDER]: 'hoy' };
  const CAJA = { [SECRETARIA]: 'hoy', [LIDER]: 'hoy', [COLIDER]: 'hoy' };
  const FICHERO = { [SECRETARIA]: 'pinta', [LIDER]: 'hoy', [COLIDER]: 'hoy' };

  // --- La puerta del panel, sin más ---
  pagina('/panel/hoy', '/panel/hoy', 'panel/hoy/page.tsx', { [COLIDER]: 'pinta' });
  pagina('/panel/miembros', '/panel/miembros', 'panel/miembros/page.tsx', {
    [SECRETARIA]: 'pinta',
    [LIDER]: 'pinta',
  });
  pagina('/panel/miembros?ficha=<ficha>', `/panel/miembros?ficha=${ids.ficha}`, 'panel/miembros/page.tsx', {
    [SECRETARIA]: 'pinta',
  });
  pagina('/panel/devocionales', '/panel/devocionales', 'panel/devocionales/page.tsx');
  pagina('/panel/comunidad', '/panel/comunidad', 'panel/comunidad/page.tsx');
  pagina('/panel/compartir', '/panel/compartir', 'panel/compartir/page.tsx');
  pagina('/panel/cuenta', '/panel/cuenta', 'panel/cuenta/page.tsx');
  pagina('/panel/cuenta/contrasena', '/panel/cuenta/contrasena', 'panel/cuenta/contrasena/page.tsx');
  pagina('/panel/ministerios', '/panel/ministerios', 'panel/ministerios/page.tsx', { [COLIDER]: 'pinta' });
  pagina('/panel/ministerios/<Alabanza>', `/panel/ministerios/${ids.alabanza}`, 'panel/ministerios/[id]/page.tsx', {
    [LIDER]: 'pinta',
  });
  pagina('/panel/ministerios/<Consolidación>', `/panel/ministerios/${ids.consolidacion}`, 'panel/ministerios/[id]/page.tsx');
  pagina('/panel/ministerios/<Acción social>', `/panel/ministerios/${ids.accionSocial}`, 'panel/ministerios/[id]/page.tsx', {
    [ENLACE]: '/mi',
  });

  // --- Fichero, solicitudes y lo que es solo del pastor ---
  pagina('/panel/miembros/nuevo', '/panel/miembros/nuevo', 'panel/miembros/nuevo/page.tsx', FICHERO);
  pagina('/panel/miembros/<ficha>/editar', `/panel/miembros/${ids.ficha}/editar`, 'panel/miembros/[id]/editar/page.tsx', FICHERO);
  pagina('/panel/solicitudes', '/panel/solicitudes', 'panel/solicitudes/page.tsx', FICHERO);
  pagina('/panel/lideres', '/panel/lideres', 'panel/lideres/page.tsx', NO_PASTOR);
  pagina('/panel/ajustes', '/panel/ajustes', 'panel/ajustes/page.tsx', NO_PASTOR);
  pagina('/panel/suscripcion', '/panel/suscripcion', 'panel/suscripcion/page.tsx', NO_PASTOR);
  pagina('/panel/modulos', '/panel/modulos', 'panel/modulos/page.tsx', NO_PASTOR);
  pagina('/panel/ministerios/nuevo', '/panel/ministerios/nuevo', 'panel/ministerios/nuevo/page.tsx', NO_PASTOR);

  // --- Caja ---
  pagina('/panel/finanzas', '/panel/finanzas', 'panel/finanzas/page.tsx', CAJA);
  pagina('/panel/finanzas/informe', '/panel/finanzas/informe', 'panel/finanzas/informe/page.tsx', CAJA);
  pagina('/panel/finanzas/movimientos', '/panel/finanzas/movimientos', 'panel/finanzas/movimientos/page.tsx', CAJA);
  pagina('/panel/finanzas/movimientos/nuevo', '/panel/finanzas/movimientos/nuevo', 'panel/finanzas/movimientos/nuevo/page.tsx', CAJA);
  // La demo no tiene movimientos: con un uuid que no existe, el pastor llega al
  // notFound() de la página, y los demás tienen que quedarse antes, en la guarda.
  pagina(
    ids.movimiento ? '/panel/finanzas/movimientos/<movimiento>' : '/panel/finanzas/movimientos/<uuid sin movimiento>',
    `/panel/finanzas/movimientos/${ids.movimiento ?? '00000000-0000-4000-8000-000000000000'}`,
    'panel/finanzas/movimientos/[id]/page.tsx',
    { ...CAJA, [PASTOR]: ids.movimiento ? 'pinta' : '404' },
  );
  pagina('/panel/finanzas/ajustes', '/panel/finanzas/ajustes', 'panel/finanzas/ajustes/page.tsx', CAJA);
  // El arqueo del culto, con la misma puerta que la caja. Con Finanzas apagada
  // darían 404 a todos; la demo la tiene encendida (clave ausente).
  pagina('/panel/finanzas/arqueos', '/panel/finanzas/arqueos', 'panel/finanzas/arqueos/page.tsx', CAJA);
  pagina('/panel/finanzas/arqueos/nuevo', '/panel/finanzas/arqueos/nuevo', 'panel/finanzas/arqueos/nuevo/page.tsx', CAJA);
  ruta('/panel/finanzas/exportar', '/panel/finanzas/exportar?desde=2000-01-01&hasta=2100-12-31', 'panel/finanzas/exportar/route.ts', {
    [SECRETARIA]: 403,
    [LIDER]: 403,
    [COLIDER]: 403,
  });

  // --- Eventos ---
  pagina('/panel/eventos', '/panel/eventos', 'panel/eventos/page.tsx', FICHERO);
  pagina('/panel/eventos/nuevo', '/panel/eventos/nuevo', 'panel/eventos/nuevo/page.tsx', FICHERO);
  pagina('/panel/eventos/<evento>', `/panel/eventos/${ids.evento}`, 'panel/eventos/[id]/page.tsx', FICHERO);
  pagina('/panel/eventos/<evento>/editar', `/panel/eventos/${ids.evento}/editar`, 'panel/eventos/[id]/editar/page.tsx', FICHERO);
  ruta('/panel/eventos/<evento>/exportar', `/panel/eventos/${ids.evento}/exportar`, 'panel/eventos/[id]/exportar/route.ts', {
    [SECRETARIA]: 'csv',
    [LIDER]: 403,
    [COLIDER]: 403,
  });

  // --- Asistencia ---
  pagina('/panel/reuniones', '/panel/reuniones', 'panel/reuniones/page.tsx', FICHERO);
  pagina('/panel/reuniones/nueva', '/panel/reuniones/nueva', 'panel/reuniones/nueva/page.tsx', FICHERO);
  pagina('/panel/reuniones/<reunión>', `/panel/reuniones/${ids.reunionCongregacion}`, 'panel/reuniones/[id]/page.tsx', FICHERO);
  pagina('/panel/reuniones/<reunión>/editar', `/panel/reuniones/${ids.reunionCongregacion}/editar`, 'panel/reuniones/[id]/editar/page.tsx', FICHERO);

  // --- Gestión de cada ministerio ---
  const M = '/panel/ministerios';
  pagina('/panel/ministerios/<Alabanza>/editar', `${M}/${ids.alabanza}/editar`, 'panel/ministerios/[id]/editar/page.tsx', {
    [LIDER]: 'pinta',
    [COLIDER]: 'min',
    [SECRETARIA]: 'min',
  });
  pagina('/panel/ministerios/<Consolidación>/editar', `${M}/${ids.consolidacion}/editar`, 'panel/ministerios/[id]/editar/page.tsx', {
    [CONSOLIDACION]: 'pinta',
    [LIDER]: 'min',
    [COLIDER]: 'min',
    [SECRETARIA]: 'min',
  });
  pagina('/panel/ministerios/<Acción social>/editar', `${M}/${ids.accionSocial}/editar`, 'panel/ministerios/[id]/editar/page.tsx', {
    [COLIDER]: 'pinta',
    [LIDER]: 'min',
    [SECRETARIA]: 'min',
    [ENLACE]: '/mi',
  });

  // --- Herramientas de Alabanza: las lleva el líder; el colíder de otro equipo no ---
  const ALABANZA = { [LIDER]: 'pinta', [COLIDER]: 'min', [SECRETARIA]: 'min' };
  const A = `${M}/${ids.alabanza}`;
  pagina('…<Alabanza>/agenda', `${A}/agenda`, 'panel/ministerios/[id]/agenda/page.tsx', ALABANZA);
  pagina('…<Alabanza>/agenda/nueva', `${A}/agenda/nueva`, 'panel/ministerios/[id]/agenda/nueva/page.tsx', ALABANZA);
  if (ids.reunionAlabanza) {
    pagina('…<Alabanza>/agenda/<reunión>', `${A}/agenda/${ids.reunionAlabanza}`, 'panel/ministerios/[id]/agenda/[reunionId]/page.tsx', ALABANZA);
    pagina('…<Alabanza>/agenda/<reunión>/editar', `${A}/agenda/${ids.reunionAlabanza}/editar`, 'panel/ministerios/[id]/agenda/[reunionId]/editar/page.tsx', ALABANZA);
  }
  pagina('…<Alabanza>/turnos', `${A}/turnos`, 'panel/ministerios/[id]/turnos/page.tsx', ALABANZA);
  pagina('…<Alabanza>/turnos/planificar', `${A}/turnos/planificar`, 'panel/ministerios/[id]/turnos/planificar/page.tsx', ALABANZA);
  if (ids.turnoAlabanza) {
    pagina('…<Alabanza>/turnos/<turno>', `${A}/turnos/${ids.turnoAlabanza}`, 'panel/ministerios/[id]/turnos/[turnoId]/page.tsx', ALABANZA);
  }
  pagina('…<Alabanza>/repertorio', `${A}/repertorio`, 'panel/ministerios/[id]/repertorio/page.tsx', ALABANZA);
  pagina('…<Alabanza>/repertorio/nueva', `${A}/repertorio/nueva`, 'panel/ministerios/[id]/repertorio/nueva/page.tsx', ALABANZA);
  if (ids.cancionAlabanza) {
    pagina('…<Alabanza>/repertorio/<canción>', `${A}/repertorio/${ids.cancionAlabanza}`, 'panel/ministerios/[id]/repertorio/[cancionId]/page.tsx', ALABANZA);
  }

  // --- Consolidación: el seguimiento pide ver_seguimiento ADEMÁS de llevar el equipo ---
  const C = `${M}/${ids.consolidacion}`;
  pagina('…<Consolidación>/agenda', `${C}/agenda`, 'panel/ministerios/[id]/agenda/page.tsx', {
    [CONSOLIDACION]: 'pinta',
    [LIDER]: 'min',
    [COLIDER]: 'min',
    [SECRETARIA]: 'min',
  });
  const SEGUIMIENTO = { [CONSOLIDACION]: 'pinta', [LIDER]: 'hoy', [COLIDER]: 'hoy', [SECRETARIA]: 'hoy' };
  pagina('…<Consolidación>/seguimiento', `${C}/seguimiento`, 'panel/ministerios/[id]/seguimiento/page.tsx', SEGUIMIENTO);
  if (ids.personaSeguimiento) {
    pagina('…<Consolidación>/seguimiento/<persona>', `${C}/seguimiento/${ids.personaSeguimiento}`, 'panel/ministerios/[id]/seguimiento/[miembroId]/page.tsx', SEGUIMIENTO);
  }
  // Los nuevos son el seguimiento de quien acaba de llegar: las mismas tres llaves.
  pagina('…<Consolidación>/seguimiento/nuevos', `${C}/seguimiento/nuevos`, 'panel/ministerios/[id]/seguimiento/nuevos/page.tsx', SEGUIMIENTO);
  pagina('…<Consolidación>/seguimiento/nuevos/alta', `${C}/seguimiento/nuevos/alta`, 'panel/ministerios/[id]/seguimiento/nuevos/alta/page.tsx', SEGUIMIENTO);

  // --- Acción social: el reparto es de quien lleva el equipo desde dentro ---
  const ACCION = { [COLIDER]: 'pinta', [LIDER]: 'min', [SECRETARIA]: 'min', [ENLACE]: '/mi' };
  const S = `${M}/${ids.accionSocial}`;
  pagina('…<Acción social>/agenda', `${S}/agenda`, 'panel/ministerios/[id]/agenda/page.tsx', ACCION);
  pagina('…<Acción social>/reparto', `${S}/reparto`, 'panel/ministerios/[id]/reparto/page.tsx', ACCION);
  pagina('…<Acción social>/reparto/padron', `${S}/reparto/padron`, 'panel/ministerios/[id]/reparto/padron/page.tsx', ACCION);
  if (ids.beneficiario) {
    pagina('…<Acción social>/reparto/padron/<beneficiario>', `${S}/reparto/padron/${ids.beneficiario}`, 'panel/ministerios/[id]/reparto/padron/[beneficiarioId]/page.tsx', ACCION);
  }
  pagina('…<Acción social>/reparto/historial', `${S}/reparto/historial`, 'panel/ministerios/[id]/reparto/historial/page.tsx', ACCION);
  pagina('…<Acción social>/reparto/informe', `${S}/reparto/informe`, 'panel/ministerios/[id]/reparto/informe/page.tsx', ACCION);
  // El fondo de Acción social, de solo lectura: quien lleva el equipo desde
  // dentro, y solo si el pastor le vinculó un fondo. `gestionar_ministerios`
  // no entra (secretaría), ni el voluntario.
  const conFondo = ids.fondoAccionSocial ? 'pinta' : '404';
  pagina(
    ids.fondoAccionSocial ? '…<Acción social>/fondo' : '…<Acción social>/fondo (sin fondo vinculado)',
    `${S}/fondo`,
    'panel/ministerios/[id]/fondo/page.tsx',
    {
      [PASTOR]: conFondo,
      [COLIDER]: conFondo,
      [LIDER]: 'min',
      [SECRETARIA]: 'min',
      [CONSOLIDACION]: 'min',
      [ENLACE]: '/mi',
    },
  );
  // Y en Alabanza, que no tiene fondo: quien lo lleva llega al 404.
  pagina('…<Alabanza>/fondo (sin fondo)', `${A}/fondo`, 'panel/ministerios/[id]/fondo/page.tsx', {
    [PASTOR]: '404',
    [LIDER]: '404',
    [COLIDER]: 'min',
    [SECRETARIA]: 'min',
  });
  // El mismo fondo desde la app. Las puertas son las de la pestaña, puestas a
  // mano en la página: llevar Acción social desde dentro (el pastor, o Sara
  // como colíder) y que haya fondo vinculado. Enlace es voluntario de Acción
  // social: ve la portada del equipo, pero no los importes. A todos los demás
  // la zona les da 404, no un rebote, y el pastor de Sion se queda en la
  // suscripción antes de que nada se consulte (el caso por defecto).
  pagina(
    ids.fondoAccionSocial ? '/mi/equipo/<Acción social>/fondo' : '/mi/equipo/<Acción social>/fondo (sin fondo vinculado)',
    `/mi/equipo/${ids.accionSocial}/fondo`,
    'mi/equipo/[id]/fondo/page.tsx',
    {
      [PASTOR]: conFondo,
      [COLIDER]: conFondo,
      [MIEMBRO]: 'oculta',
      [LIDER]: 'oculta',
      [SECRETARIA]: 'oculta',
      [CONSOLIDACION]: 'oculta',
      [ENLACE]: 'oculta',
    },
  );

  // Turnos está APAGADO en Acción social: ni el pastor ni el colíder la tienen.
  pagina('…<Acción social>/turnos (apagado)', `${S}/turnos`, 'panel/ministerios/[id]/turnos/page.tsx', {
    [PASTOR]: '404',
    [COLIDER]: '404',
    [LIDER]: 'min',
    [SECRETARIA]: 'min',
    [ENLACE]: '/mi',
  });

  // --- Radio: la emisora es de quien lleva el equipo, por la puerta ancha ---
  // Sara (colider@) es colíder de la Radio; Alabanza y Consolidación son otros
  // equipos, y llevarlos no abre este.
  if (ids.radio) {
    pagina('…<Radio>/emisora', `${M}/${ids.radio}/emisora`, 'panel/ministerios/[id]/emisora/page.tsx', {
      [COLIDER]: 'pinta',
      [LIDER]: 'min',
      [CONSOLIDACION]: 'min',
      [SECRETARIA]: 'min',
      [ENLACE]: '/mi',
    });
  }
  // La emisora está APAGADA en Alabanza: quien lleva el equipo llega al 404, y
  // los demás se quedan antes, en la guarda. Este caso no depende de la Radio.
  pagina('…<Alabanza>/emisora (apagado)', `${A}/emisora`, 'panel/ministerios/[id]/emisora/page.tsx', {
    [PASTOR]: '404',
    [LIDER]: '404',
    [COLIDER]: 'min',
    [SECRETARIA]: 'min',
  });

  return SOLO ? r.filter((x) => x.etiqueta.includes(SOLO)) : r;
}

// ============================================
// 5. Comprobar
// ============================================

/**
 * Toda `page.tsx` y todo `route.ts` de `src/app/panel` tiene que estar en la
 * lista de arriba. Una página nueva que nadie añade aquí es justo la que se
 * queda sin puerta sin que nada avise, así que eso también es un fallo.
 */
function sinCubrir(defs) {
  const raiz = fileURLToPath(new URL('../src/app/', import.meta.url));
  const enDisco = readdirSync(join(raiz, 'panel'), { recursive: true })
    .map((f) => 'panel/' + String(f).replaceAll('\\', '/'))
    .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f));
  const cubiertos = new Set(defs.map((d) => d.pagePath ?? d.fichero));
  // Las de fuera del panel, también si alguien las mueve o las borra: una
  // entrada de FUERA_DEL_PANEL que ya no está en disco es una ruta que este
  // test cree cubrir y no cubre.
  const fuera = FUERA_DEL_PANEL.filter((f) => !existsSync(join(raiz, f)) || !cubiertos.has(f));
  return [...enDisco.filter((f) => !cubiertos.has(f)), ...fuera].sort();
}

function casaDestino(esperado, destino) {
  if (esperado === 'hoy') return destino.startsWith('/panel/hoy?error=');
  if (esperado === 'min') return destino.startsWith('/panel/ministerios?error=');
  return destino === esperado;
}

const DESCRIPCION = {
  pinta: '200 y la página se pinta',
  '/mi': 'la página corta → /mi',
  '/suscripcion': 'la página corta → /suscripcion',
  hoy: 'la página corta → /panel/hoy?error',
  min: 'la página corta → /panel/ministerios?error',
  404: 'la página da 404',
  oculta: 'la página da 404 (no puede verla)',
  csv: '200 text/csv',
  403: '403',
};

function describirSegmento(s) {
  if (s.estado === 'redirige') return `página→${s.destino.split('?')[0]}${s.destino.includes('?error=') ? '?error' : ''}`;
  if (s.estado === '404') return 'página→404';
  return `página ${s.estado}`;
}

let volcados = 0;
function volcar(cuenta, etiqueta, rsc, cuerpo) {
  if (!VOLCADO) return;
  mkdirSync(VOLCADO, { recursive: true });
  const nombre = `${String(++volcados).padStart(3, '0')}-${cuenta.split('@')[0]}-${etiqueta.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60)}-${rsc ? 'rsc' : 'html'}.txt`;
  writeFileSync(join(VOLCADO, nombre), cuerpo);
}

async function comprobarPagina(def, sesiones, testigos, marco) {
  const resultados = [];
  const respuestas = {};
  // El pastor primero: de su respuesta salen los testigos.
  const orden = Object.keys(def.casos).sort((a, b) => (a === PASTOR ? -1 : b === PASTOR ? 1 : 0));

  const medir = async (cuenta) => {
    const { cookie } = sesiones[cuenta];
    const [normal, rsc] = await Promise.all([pedir(cookie, def.url, false), pedir(cookie, def.url, true)]);
    volcar(cuenta, def.etiqueta, false, normal.cuerpo);
    volcar(cuenta, def.etiqueta, true, rsc.cuerpo);
    return {
      normal,
      rsc,
      segRsc: segmentoDePagina(rsc.cuerpo),
      segHtml: segmentoDePagina(payloadDelHtml(normal.cuerpo)),
      vistos: new Set([...testigosEn(normal.cuerpo, testigos), ...testigosEn(rsc.cuerpo, testigos)]),
    };
  };
  // El pastor antes que nadie; el resto, a la vez.
  const medidas = {};
  if (sesiones[PASTOR] && def.casos[PASTOR]) medidas[PASTOR] = await medir(PASTOR);
  await Promise.all(
    orden
      .filter((c) => c !== PASTOR && sesiones[c])
      .map(async (c) => {
        medidas[c] = await medir(c);
      }),
  );

  for (const cuenta of orden) {
    const esperado = def.casos[cuenta];
    if (!medidas[cuenta]) {
      resultados.push({ ruta: def.etiqueta, cuenta, esperado: DESCRIPCION[esperado], obtenido: 'cuenta no disponible en la demo', ok: false });
      continue;
    }
    const { normal, rsc, segRsc, segHtml, vistos } = medidas[cuenta];
    respuestas[cuenta] = vistos;

    const problemas = [];
    let resumenDatos = '';

    if (esperado === 'pinta' || esperado === '404' || esperado === 'oculta') {
      const estado = esperado === 'pinta' ? 'pinta' : '404';
      const statusEsperado = esperado === 'pinta' ? 200 : 404;
      if (normal.status !== statusEsperado) problemas.push(`HTML ${normal.status}${normal.location ? '→' + normal.location : ''}`);
      if (rsc.status !== 200) problemas.push(`RSC ${rsc.status}`);
      if (segRsc.estado !== estado) problemas.push(`RSC ${describirSegmento(segRsc)}`);
      if (segHtml.estado !== estado && segHtml.estado !== 'sin-metadatos') problemas.push(`HTML ${describirSegmento(segHtml)}`);
      if (segRsc.pagina && segRsc.pagina !== def.pagePath) problemas.push(`pagePath ${segRsc.pagina}`);
      if (cuenta === PASTOR) {
        const propios = [...vistos].filter((v) => !marco[PASTOR].has(v));
        resumenDatos = ` · ${vistos.size} testigos (${propios.length} propios de la página)`;
      }
      // El 404 de quien no puede: cortar no basta, tampoco puede traer nada de
      // lo que trae la del pastor y esta cuenta no vea ya en su marco.
      if (esperado === 'oculta') {
        const referencia = respuestas[PASTOR] ?? new Set();
        const fugas = [...vistos].filter((v) => referencia.has(v) && !(marco[cuenta]?.has(v)));
        if (fugas.length) {
          const tipos = [...new Set(testigos.filter((t) => fugas.includes(t.valor)).map((t) => t.tipo))];
          problemas.push(`FUGA de ${fugas.length} testigos (${tipos.join(', ')})`);
        }
        resumenDatos = ` · ${fugas.length}/${referencia.size} testigos del pastor`;
      }
    } else {
      // Quien NO puede: la página corta ella sola, al destino que toca, y no
      // trae ninguno de los testigos del pastor que esta cuenta no vea ya en su
      // propio marco.
      const referencia = respuestas[PASTOR] ?? new Set();
      const fugas = [...vistos].filter((v) => referencia.has(v) && !(marco[cuenta]?.has(v)));
      if (fugas.length) {
        const tipos = [...new Set(testigos.filter((t) => fugas.includes(t.valor)).map((t) => t.tipo))];
        problemas.push(`FUGA de ${fugas.length} testigos (${tipos.join(', ')})`);
      }
      if (segRsc.estado === 'sin-metadatos') {
        problemas.push('RSC sin metadatos de segmento: no se puede saber si cortó la página');
      } else if (segRsc.estado !== 'redirige' || !casaDestino(esperado, segRsc.destino)) {
        problemas.push(`RSC ${describirSegmento(segRsc)}`);
      }
      if (segHtml.estado !== 'sin-metadatos' && (segHtml.estado !== 'redirige' || !casaDestino(esperado, segHtml.destino))) {
        problemas.push(`HTML ${describirSegmento(segHtml)}`);
      }
      if (!(normal.status === 307 && casaDestino(esperado, normal.location.replace(BASE, '')))) {
        problemas.push(`HTML ${normal.status}${normal.location ? '→' + normal.location : ''}`);
      }
      // La fila que se ha mirado tiene que ser la de ESTA página, no otra.
      if (segRsc.pagina && segRsc.pagina !== def.pagePath) problemas.push(`pagePath ${segRsc.pagina}`);
      resumenDatos = ` · ${fugas.length}/${referencia.size} testigos del pastor`;
    }

    const obtenido =
      problemas.length > 0
        ? problemas.join('; ') + resumenDatos
        : `HTML ${normal.status}${normal.location ? '→' + normal.location.replace(BASE, '').split('?')[0] : ''} · RSC ${describirSegmento(segRsc)}${resumenDatos}`;
    resultados.push({ ruta: def.etiqueta, cuenta, esperado: DESCRIPCION[esperado], obtenido, ok: problemas.length === 0 });
  }
  return resultados;
}

async function comprobarRouteTs(def, sesiones, testigos) {
  const resultados = [];
  const avisos = [];
  let referencia = new Set();
  const orden = Object.keys(def.casos).sort((a, b) => (a === PASTOR ? -1 : b === PASTOR ? 1 : 0));

  for (const cuenta of orden) {
    const esperado = def.casos[cuenta];
    const sesion = sesiones[cuenta];
    if (!sesion) {
      resultados.push({ ruta: def.etiqueta, cuenta, esperado: DESCRIPCION[esperado], obtenido: 'cuenta no disponible en la demo', ok: false });
      continue;
    }
    // Un route.ts no distingue RSC, pero se pide igual: es lo que haría el router.
    const respuestas = [await pedir(sesion.cookie, def.url, false), await pedir(sesion.cookie, def.url, true)];
    respuestas.forEach((r, i) => volcar(cuenta, def.etiqueta, i === 1, r.cuerpo));
    const vistos = new Set(respuestas.flatMap((r) => [...testigosEn(r.cuerpo, testigos)]));

    const problemas = [];
    let resumen = '';
    if (esperado === 'csv') {
      for (const r of respuestas) {
        if (r.status !== 200 || !r.tipo.startsWith('text/csv')) problemas.push(`${r.status} ${r.tipo}`);
      }
      if (cuenta === PASTOR) referencia = vistos;
      const filas = respuestas[0].cuerpo.split('\r\n').length;
      resumen = ` · ${filas} líneas, ${vistos.size} testigos`;
    } else {
      for (const r of respuestas) {
        if (r.status !== esperado) problemas.push(`${r.status} ${r.tipo}`);
      }
      // No es una fuga, pero quien lo recibe ve una página en blanco. Pasa con
      // una `Response` creada una vez a nivel de módulo: su cuerpo solo se lee
      // una vez por proceso.
      const vacias = respuestas.filter((r) => r.status === esperado && r.cuerpo.trim() === '').length;
      if (vacias) avisos.push(`${def.etiqueta} · ${cuenta}: ${esperado} con el cuerpo vacío (${vacias} de 2)`);
      const fugas = [...vistos].filter((v) => referencia.has(v));
      if (fugas.length) problemas.push(`FUGA de ${fugas.length} testigos`);
      const cuerpos = respuestas.map((r) => JSON.stringify(r.cuerpo.trim().slice(0, 40))).join(' / ');
      resumen = ` · cuerpo ${cuerpos} · ${fugas.length}/${referencia.size} testigos del pastor`;
    }
    const obtenido =
      (problemas.length ? problemas.join('; ') : `${respuestas[0].status} ${respuestas[0].tipo.split(';')[0]}`) + resumen;
    resultados.push({ ruta: def.etiqueta, cuenta, esperado: DESCRIPCION[esperado], obtenido, ok: problemas.length === 0 });
  }
  return { resultados, avisos };
}

async function enParalelo(items, n, fn) {
  const salida = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        salida[i] = await fn(items[i], i);
      }
    }),
  );
  return salida;
}

// ============================================
// Main
// ============================================

async function main() {
  try {
    await fetch(BASE + '/', { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch {
    console.error(
      `No responde ${BASE}. Este test necesita el servidor de desarrollo encendido: npm run dev.`,
    );
    process.exit(2);
  }

  const { ids, testigos } = await leerDemo();
  console.log(`Base de demo leída en solo lectura: ${testigos.length} testigos.`);
  if (!ids.movimiento) console.log('  · Betania no tiene movimientos de caja: las páginas de finanzas no traen importes que comparar.');
  if (!ids.radio) console.log('  · Betania no tiene Radio con la emisora encendida (scripts/seed-radio.sql): la emisora solo se prueba apagada.');

  const abiertas = {};
  for (const email of CUENTAS) {
    try {
      abiertas[email] = await abrirSesion(email);
    } catch (e) {
      if (IMPRESCINDIBLES.includes(email)) throw e;
      console.log(`  · Sin sesión para ${email} (${e.message}); sus casos salen como fallidos.`);
    }
  }

  // Control negativo: todas las cuentas piden con la sesión del pastor, que es
  // lo que vería alguien si una página perdiera su puerta. Cada caso de «no
  // puede» tiene que salir FALLO; si alguno sale ok, el test no ve las fugas.
  const sesiones = CONTROL
    ? Object.fromEntries(Object.keys(abiertas).map((e) => [e, abiertas[PASTOR]]))
    : abiertas;
  if (CONTROL) console.log('  · CONTROL NEGATIVO: todas las cuentas piden con la sesión del pastor.');

  try {
    // El marco de cada cuenta: lo que ya ve en su propio panel.
    const marco = {};
    for (const [email, s] of Object.entries(sesiones)) {
      const [a, b] = [await pedir(s.cookie, RUTA_MARCO, false), await pedir(s.cookie, RUTA_MARCO, true)];
      marco[email] = new Set([...testigosEn(a.cuerpo, testigos), ...testigosEn(b.cuerpo, testigos)]);
    }

    const defs = rutas(ids);
    const t0 = Date.now();
    const porRuta = await enParalelo(defs, 4, async (def) =>
      def.routeTs
        ? comprobarRouteTs(def, sesiones, testigos)
        : { resultados: await comprobarPagina(def, sesiones, testigos, marco), avisos: [] },
    );

    const resultados = porRuta.flatMap((x) => x.resultados);
    const avisos = porRuta.flatMap((x) => x.avisos);
    if (!SOLO) {
      for (const fichero of sinCubrir(defs)) {
        resultados.push({
          ruta: `src/app/${fichero}`,
          cuenta: '-',
          esperado: 'cubierta por este test',
          obtenido: 'no está en rutas(): añádela con quién puede y quién no',
          ok: false,
        });
      }
    }

    let rutaAnterior = '';
    for (const r of resultados) {
      if (r.ruta !== rutaAnterior) {
        console.log('\n' + r.ruta);
        rutaAnterior = r.ruta;
      }
      console.log(
        `  ${r.ok ? 'ok   ' : 'FALLO'} ${r.cuenta.padEnd(26)} espera ${r.esperado.padEnd(42)} ${r.obtenido}`,
      );
    }

    const fallos = resultados.filter((r) => !r.ok);
    console.log(
      `\n${defs.length} rutas, ${resultados.length} combinaciones de ruta y cuenta, ${fallos.length} fallos. ` +
        `${Math.round((Date.now() - t0) / 1000)} s.`,
    );
    if (avisos.length) {
      console.log('\nAvisos (no son fugas):');
      for (const a of avisos) console.log('  · ' + a);
    }
    if (process.env.PUERTAS_JSON) {
      writeFileSync(process.env.PUERTAS_JSON, JSON.stringify({ ids, testigos: testigos.length, resultados, avisos }, null, 2));
    }

    if (CONTROL) {
      const QUIEN_PUEDE = new Set([DESCRIPCION.pinta, DESCRIPCION[404], DESCRIPCION.csv]);
      const denegados = resultados.filter((r) => !QUIEN_PUEDE.has(r.esperado));
      const sinDetectar = denegados.filter((r) => r.ok);
      const conFuga = denegados.filter((r) => r.obtenido.includes('FUGA'));
      console.log(
        `\nControl negativo: ${denegados.length - sinDetectar.length} de ${denegados.length} casos denegados detectados ` +
          `(${conFuga.length} por fuga de testigos).`,
      );
      for (const r of sinDetectar) console.log(`  SIN DETECTAR ${r.ruta} · ${r.cuenta}`);
      process.exitCode = sinDetectar.length ? 1 : 0;
      return;
    }
    process.exitCode = fallos.length ? 1 : 0;
  } finally {
    // No dejar sesiones abiertas en auth.sessions.
    for (const s of Object.values(abiertas)) {
      await admin.auth.admin.signOut(s.accessToken, 'local').catch(() => {});
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
