/**
 * Test de puertas de la API de la app empaquetada (`/api/v1/app/*`).
 *
 *   npm run test:puertas:app
 *
 * NECESITA EL SERVIDOR ENCENDIDO
 * ------------------------------
 * `npm run dev` en http://localhost:3000 (o la URL de PUERTAS_URL). Habla con
 * la aplicación de verdad por HTTP, cada cuenta con su token Bearer, como lo
 * hará el teléfono. Sin servidor sale con código 2.
 *
 * POR QUÉ EXISTE
 * --------------
 * La app empaquetada abre una puerta nueva a los datos: la API
 * (`docs/app-nativa/plan-spa.md` §2). `test:puertas` prueba las páginas con
 * cookie y no pasa por aquí. Y en este proyecto ya convivieron cuatro
 * comprobaciones en verde con el producto entero roto: el test de aislamiento
 * probaba las policies con SQL escrito a mano, no que la aplicación las usara.
 * Este pide lo mismo que pedirá el teléfono.
 *
 * QUÉ MIRA
 * --------
 * 1. Que todo `route.ts` bajo `src/app/api/v1/app` esté en `ENDPOINTS`. Un
 *    endpoint nuevo sin casos aquí es un fallo: es el que se quedaría sin
 *    puerta sin que nada avisara.
 * 2. Cada endpoint con cada cuenta, y sin token, con un token falso y con una
 *    cabecera que no es Bearer: el código y lo que trae.
 * 3. El aislamiento: la respuesta de una iglesia no lleva el id ni el nombre
 *    de la otra.
 * 4. CORS: los orígenes de la app leen; cualquier otro, no.
 * 5. Que con token, la cookie no cuenta: un token falso con la cookie del
 *    pastor es «sin sesión».
 *
 * Las sesiones se abren sin contraseña (`generateLink` + `verifyOtp`), como en
 * `test:puertas`, y se cierran al terminar.
 *
 * Las iglesias y las cuentas son de usar y tirar (`scripts/pruebas/demo.mjs`):
 * se montan al empezar y se borran al terminar, también si falla. Hasta el
 * 20-nov-2026 eran Betania y Sion, fijas, con contraseña en el repo; Betania
 * se borró. Betel sale en el buscador público mientras corre: es justo lo que
 * se comprueba, que lo publicado sale y lo que no, no. Fuera de eso, no escribe
 * nada en la base.
 *
 * VARIABLES
 * ---------
 *   PUERTAS_URL   base del servidor (por defecto http://localhost:3000)
 */

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CARPETA_API = join(RAIZ, 'src', 'app', 'api', 'v1', 'app');

// Las cuentas de la iglesia de prueba. Los correos cambian en cada ejecución
// (`<papel>.<run>@pruebas.hatril.test`), así que se rellenan en `probar()`.
let PASTOR;
let SECRETARIA;
let LIDER;
let MIEMBRO;
let COLIDER;
let VISITA; // sin iglesia, con solicitud
let SION; // pastor de OTRA iglesia
// Niños: la responsable y dos madres aceptadas (`scripts/pruebas/demo.mjs`).
let MAESTRA;
let MADRE; // madre de Tomás, aceptada hace diez días
let MADRE2; // madre de Lía, aceptada hoy
let AUXILIAR; // colíder de Niños: maestro, no acepta familias

let CUENTAS = [];
// El slug de Betel, para la solicitud bien formada de `solicitudValida()`.
let SLUG_BETEL;

const ORIGEN_IOS = 'capacitor://localhost';
const ORIGEN_ANDROID = 'https://localhost';
const ORIGEN_AJENO = 'https://evil.example';

// ============================================
// Los endpoints y lo que se espera de cada uno
// ============================================

/**
 * Cada `route.ts` de la API, con sus casos. `ruta` es la carpeta relativa a
 * `src/app/api/v1/app`. Un caso es una función que recibe `pedir` y las
 * iglesias de la demo y devuelve los fallos que encuentre.
 */
const ENDPOINTS = [
  {
    ruta: 'version',
    casos: {
      'pública: sin token, 200 con la mínima': async ({ pedir }) => {
        const r = await pedir('GET', '/version', null);
        return [
          ...espera(r, 200),
          ...(typeof r.json?.minima === 'string' ? [] : ['no trae `minima`']),
        ];
      },
    },
  },
  {
    ruta: 'yo',
    casos: {
      'sin token: 401 hacia el acceso': async ({ pedir }) => {
        const r = await pedir('GET', '/yo', null);
        return [...espera(r, 401), ...(r.json?.ir === '/acceso' ? [] : [`ir = ${r.json?.ir}`])];
      },
      'token falso: 401': async ({ pedir }) => espera(await pedir('GET', '/yo', 'Bearer no-es-un-token'), 401),
      'cabecera que no es Bearer: 401': async ({ pedir }) =>
        espera(await pedir('GET', '/yo', 'Basic dXN1YXJpbzpjbGF2ZQ=='), 401),
      'token falso con la cookie del pastor: 401, la cookie no cuenta': async ({ pedirConCookie }) =>
        espera(await pedirConCookie('GET', '/yo', 'Bearer no-es-un-token', PASTOR), 401),

      'pastor: su iglesia y el panel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(PASTOR, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('situacion', r.json?.situacion, 'iglesia'),
          ...igual('iglesia.id', r.json?.iglesia?.id, demo.betel.id),
          ...igual('panel', r.json?.panel, '/panel/hoy'),
          ...sinRastroDe(r, demo.sion),
        ];
      },
      'secretaria: su iglesia y el panel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SECRETARIA, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('iglesia.id', r.json?.iglesia?.id, demo.betel.id),
          ...(r.json?.panel ? [] : ['sin panel, y lleva algo en la iglesia']),
          ...sinRastroDe(r, demo.sion),
        ];
      },
      'líder: su iglesia y la pestaña de equipo': async ({ pedirComo, demo }) => {
        const r = await pedirComo(LIDER, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('iglesia.id', r.json?.iglesia?.id, demo.betel.id),
          ...(r.json?.pestanas?.equipo?.startsWith('/mi/equipo') ? [] : [`pestanas.equipo = ${r.json?.pestanas?.equipo}`]),
          ...sinRastroDe(r, demo.sion),
        ];
      },
      'miembro raso: su iglesia y SIN panel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('situacion', r.json?.situacion, 'iglesia'),
          ...igual('iglesia.id', r.json?.iglesia?.id, demo.betel.id),
          ...igual('panel', r.json?.panel, null),
          ...sinRastroDe(r, demo.sion),
        ];
      },
      'colíder: su iglesia y la pestaña de equipo': async ({ pedirComo, demo }) => {
        const r = await pedirComo(COLIDER, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('iglesia.id', r.json?.iglesia?.id, demo.betel.id),
          ...(r.json?.pestanas?.equipo ? [] : ['sin pestaña de equipo']),
        ];
      },
      'visita: sala de espera, sin iglesia y sin datos de nadie': async ({ pedirComo, demo }) => {
        const r = await pedirComo(VISITA, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('situacion', r.json?.situacion, 'sin_iglesia'),
          ...igual('iglesia', r.json?.iglesia, null),
          ...igual('radio', r.json?.radio, null),
          ...igual('panel', r.json?.panel, null),
          // La solicitud sí nombra la iglesia a la que pidió entrar, que es
          // pública en el directorio; el id de la iglesia, no.
          ...(r.texto.includes(demo.betel.id) ? ['trae el id de Betel'] : []),
          ...(r.texto.includes(demo.sion.id) ? ['trae el id de Sion'] : []),
        ];
      },
      'pastor de Sion: su iglesia, nada de Betel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SION, 'GET', '/yo');
        return [
          ...espera(r, 200),
          ...igual('iglesia.id', r.json?.iglesia?.id, demo.sion.id),
          ...sinRastroDe(r, demo.betel),
        ];
      },
    },
  },
  // ------------------------------------------------------------------
  // El directorio. Público, como `/buscar`: lo que importa es que una
  // iglesia que no está en el directorio (Sion) no salga por ningún lado.
  // ------------------------------------------------------------------
  {
    ruta: 'iglesias',
    casos: {
      'buscar Betel por su nombre: sale, sin sesión': async ({ pedir, demo }) => {
        const r = await pedir('GET', `/iglesias?q=${encodeURIComponent(demo.betel.nombre)}`, null);
        return [...espera(r, 200), ...(slugs(r).includes(demo.betel.slug) ? [] : ['no sale Betel'])];
      },
      'buscar Sion por su nombre: no está en el directorio y no sale': async ({ pedir, demo }) => {
        const r = await pedir('GET', `/iglesias?q=${encodeURIComponent(demo.sion.nombre)}`, null);
        return [...espera(r, 200), ...(slugs(r).includes(demo.sion.slug) ? ['FUGA: sale Sion'] : [])];
      },
      'por ciudad «Madrid»: Sion tampoco': async ({ pedir, demo }) => {
        const r = await pedir('GET', '/iglesias?ciudad=Madrid', null);
        return [...espera(r, 200), ...(slugs(r).includes(demo.sion.slug) ? ['FUGA: sale Sion'] : [])];
      },
      'sin búsqueda: lista vacía, no el directorio entero': async ({ pedir }) => {
        const r = await pedir('GET', '/iglesias', null);
        return [...espera(r, 200), ...igual('iglesias.length', r.json?.iglesias?.length, 0)];
      },
    },
  },
  {
    ruta: 'iglesias/sugerencias',
    casos: {
      'sugerencias con el nombre de Sion: sin Sion': async ({ pedir, demo }) => {
        const r = await pedir('GET', `/iglesias/sugerencias?q=${encodeURIComponent(demo.sion.nombre)}`, null);
        const lista = (r.json?.sugerencias ?? []).map((i) => i.slug);
        return [...espera(r, 200), ...(lista.includes(demo.sion.slug) ? ['FUGA: sale Sion'] : [])];
      },
      'una sola letra: 400': async ({ pedir }) => espera(await pedir('GET', '/iglesias/sugerencias?q=b', null), 400),
    },
  },
  {
    ruta: 'iglesias/ciudades',
    casos: {
      'las ciudades del directorio': async ({ pedir }) => {
        const r = await pedir('GET', '/iglesias/ciudades', null);
        return [...espera(r, 200), ...(Array.isArray(r.json?.ciudades) ? [] : ['no trae `ciudades`'])];
      },
    },
  },
  {
    ruta: 'iglesias/cerca',
    casos: {
      'las que tienen ubicación, sin Sion': async ({ pedir, demo }) => {
        const r = await pedir('GET', '/iglesias/cerca', null);
        return [...espera(r, 200), ...(slugs(r).includes(demo.sion.slug) ? ['FUGA: sale Sion'] : [])];
      },
    },
  },
  {
    ruta: 'iglesias/[slug]',
    casos: {
      'ficha sin sesión: pública, sin relación': async ({ pedir, demo }) => {
        const r = await pedir('GET', `/iglesias/${demo.betel.slug}`, null);
        return [...espera(r, 200), ...igual('relacion', r.json?.relacion, 'sin_sesion')];
      },
      'ficha como miembro de Betel: de_esta': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', `/iglesias/${demo.betel.slug}`);
        return [...espera(r, 200), ...igual('relacion', r.json?.relacion, 'de_esta')];
      },
      'ficha como visita: su solicitud pendiente': async ({ pedirComo, demo }) => {
        const r = await pedirComo(VISITA, 'GET', `/iglesias/${demo.betel.slug}`);
        return [...espera(r, 200), ...igual('relacion', r.json?.relacion, 'pendiente')];
      },
      'ficha de Betel como pastor de Sion: de_otra, y solo el nombre de la suya': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SION, 'GET', `/iglesias/${demo.betel.slug}`);
        return [
          ...espera(r, 200),
          ...igual('relacion', r.json?.relacion, 'de_otra'),
          ...igual('miIglesia', r.json?.miIglesia, demo.sion.nombre),
          ...(r.texto.includes(demo.sion.id) ? ['trae el id de Sion'] : []),
        ];
      },
      'una que no existe: 404': async ({ pedir }) => espera(await pedir('GET', '/iglesias/no-existe-esta', null), 404),
      'un slug raro: 404, sin consultar': async ({ pedir }) =>
        espera(await pedir('GET', '/iglesias/Bet%C3%A1nia%27--', null), 404),
    },
  },

  // ------------------------------------------------------------------
  // Las escrituras. Este test NO escribe en la base: solo se prueban las
  // puertas (sin sesión, cuerpo malo) y los caminos que no llegan a escribir.
  // ------------------------------------------------------------------
  {
    ruta: 'solicitud',
    casos: {
      'pedir entrar sin sesión: 401': async ({ pedir }) =>
        espera(await pedir('POST', '/solicitud', null, solicitudValida()), 401),
      'cancelar sin sesión: 401': async ({ pedir }) => espera(await pedir('DELETE', '/solicitud', null), 401),
      'cuerpo sin consentimiento: 400': async ({ pedirComo }) =>
        espera(await pedirComo(PASTOR, 'POST', '/solicitud', { ...solicitudValida(), consentimiento: false }), 400),
      'el pastor ya tiene iglesia: ya_tenia, sin escribir nada': async ({ pedirComo }) => {
        const r = await pedirComo(PASTOR, 'POST', '/solicitud', solicitudValida());
        return [...espera(r, 200), ...igual('resultado', r.json?.resultado, 'ya_tenia')];
      },
    },
  },
  {
    ruta: 'cuenta',
    casos: {
      'correo malo: 400': async ({ pedir }) =>
        espera(await pedir('POST', '/cuenta', null, { nombre: 'Prueba', email: 'no-es-correo', password: 'x' }), 400),
      'contraseña floja: 400, antes de crear nada': async ({ pedir }) =>
        espera(
          await pedir('POST', '/cuenta', null, { nombre: 'Prueba', email: 'nadie@hatril.test', password: 'corta' }),
          400,
        ),
    },
  },
  {
    ruta: 'cuenta/recuperar',
    casos: {
      'correo malo: 400': async ({ pedir }) =>
        espera(await pedir('POST', '/cuenta/recuperar', null, { email: 'no-es-correo' }), 400),
    },
  },
  {
    ruta: 'push',
    casos: {
      'apuntar sin sesión: 401': async ({ pedir }) =>
        espera(await pedir('POST', '/push', null, { token: 'a'.repeat(40), plataforma: 'android' }), 401),
      'olvidar sin sesión: 401': async ({ pedir }) =>
        espera(await pedir('DELETE', '/push', null, { token: 'a'.repeat(40) }), 401),
      'token con caracteres raros: 400': async ({ pedirComo }) =>
        espera(await pedirComo(MIEMBRO, 'POST', '/push', { token: '<script>'.repeat(5), plataforma: 'ios' }), 400),
    },
  },
  // ------------------------------------------------------------------
  // El área del miembro. Lo que importa: sin iglesia no se lee nada de
  // ninguna, una iglesia no ve lo de otra, y quien no modera no ve la cola.
  // ------------------------------------------------------------------
  {
    ruta: 'mi/comunidad',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/comunidad', null), 401),
      'visita sin iglesia: 403 hacia /mi, sin muro': async ({ pedirComo }) => {
        const r = await pedirComo(VISITA, 'GET', '/mi/comunidad');
        return [...espera(r, 403), ...igual('ir', r.json?.ir, '/mi')];
      },
      'miembro: su muro, nada de Sion': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/comunidad');
        return [...espera(r, 200), ...(Array.isArray(r.json?.muro) ? [] : ['no trae `muro`']), ...sinRastroDe(r, demo.sion)];
      },
      'pastor de Sion: su muro, nada de Betel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SION, 'GET', '/mi/comunidad');
        return [...espera(r, 200), ...sinRastroDe(r, demo.betel)];
      },
    },
  },
  {
    ruta: 'mi/comunidad/denuncias',
    casos: {
      'miembro raso: 403 de vuelta al muro, sin cola': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/comunidad/denuncias');
        return [...espera(r, 403), ...igual('ir', r.json?.ir, '/mi/comunidad'), ...(r.json?.cola ? ['FUGA: trae la cola'] : [])];
      },
      'pastor: la cola': async ({ pedirComo }) => {
        const r = await pedirComo(PASTOR, 'GET', '/mi/comunidad/denuncias');
        return [...espera(r, 200), ...(Array.isArray(r.json?.cola) ? [] : ['no trae `cola`'])];
      },
    },
  },
  {
    ruta: 'mi/comunidad/denuncia-enviada',
    casos: {
      'sin autor: 200, sin nombre': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/comunidad/denuncia-enviada');
        return [...espera(r, 200), ...igual('nombre', r.json?.nombre, null)];
      },
      'visita sin iglesia: 403': async ({ pedirComo }) =>
        espera(await pedirComo(VISITA, 'GET', '/mi/comunidad/denuncia-enviada'), 403),
    },
  },
  {
    ruta: 'mi/devocional',
    casos: {
      'miembro: 200': async ({ pedirComo }) => espera(await pedirComo(MIEMBRO, 'GET', '/mi/devocional'), 200),
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/mi/devocional'), 403),
      'pastor de Sion: nada de Betel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SION, 'GET', '/mi/devocional');
        return [...espera(r, 200), ...sinRastroDe(r, demo.betel)];
      },
    },
  },
  {
    ruta: 'mi/agenda',
    casos: {
      'miembro: 200 con la lista': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/agenda?v=semana');
        return [...espera(r, 200), ...igual('vista', r.json?.vista, 'semana')];
      },
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/mi/agenda'), 403),
      'pastor de Sion: nada de Betel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SION, 'GET', '/mi/agenda');
        return [...espera(r, 200), ...sinRastroDe(r, demo.betel)];
      },
    },
  },
  {
    ruta: 'mi/agenda/turno/[id]',
    casos: {
      'un id que no es uuid: 404': async ({ pedirComo }) =>
        espera(await pedirComo(MIEMBRO, 'GET', '/mi/agenda/turno/abc'), 404),
      'un uuid que no existe: 404': async ({ pedirComo }) =>
        espera(await pedirComo(MIEMBRO, 'GET', '/mi/agenda/turno/00000000-0000-4000-8000-000000000000'), 404),
      'un turno de Betel pedido desde Sion: 404': async ({ pedirComo, demo }) => {
        if (!demo.turnoBetel) return ['la iglesia de prueba no tiene turnos'];
        const r = await pedirComo(SION, 'GET', `/mi/agenda/turno/${demo.turnoBetel}`);
        return [...espera(r, 404), ...sinRastroDe(r, demo.betel)];
      },
    },
  },
  {
    ruta: 'mi/agenda/reunion/[id]',
    casos: {
      'un uuid que no existe: 404': async ({ pedirComo }) =>
        espera(await pedirComo(MIEMBRO, 'GET', '/mi/agenda/reunion/00000000-0000-4000-8000-000000000000'), 404),
      'una reunión de Betel pedida desde Sion: 404': async ({ pedirComo, demo }) => {
        if (!demo.reunionBetel) return ['la iglesia de prueba no tiene reuniones'];
        const r = await pedirComo(SION, 'GET', `/mi/agenda/reunion/${demo.reunionBetel}`);
        return [...espera(r, 404), ...sinRastroDe(r, demo.betel)];
      },
    },
  },
  {
    ruta: 'mi/avisos',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/avisos', null), 401),
      'visita sin iglesia: 200, sus avisos': async ({ pedirComo }) => {
        const r = await pedirComo(VISITA, 'GET', '/mi/avisos');
        return [...espera(r, 200), ...(Array.isArray(r.json?.avisos) ? [] : ['no trae `avisos`'])];
      },
      'miembro: 200': async ({ pedirComo }) => espera(await pedirComo(MIEMBRO, 'GET', '/mi/avisos'), 200),
    },
  },
  {
    ruta: 'mi/campana',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/campana', null), 401),
      'miembro: sus avisos y cuántos sin leer': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/campana');
        return [...espera(r, 200), ...(typeof r.json?.sinLeer === 'number' ? [] : ['no trae `sinLeer`'])];
      },
    },
  },
  {
    ruta: 'acepta',
    casos: {
      'miembro: 200 con el nombre de su iglesia': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/acepta');
        return [...espera(r, 200), ...igual('iglesiaNombre', r.json?.iglesiaNombre, demo.betel.nombre)];
      },
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/acepta'), 403),
    },
  },

  // ------------------------------------------------------------------
  // Las actions de la web, desde la app. La lista es cerrada: nada fuera de
  // `src/lib/api/acciones-app.ts`, y nada del panel.
  // ------------------------------------------------------------------
  {
    ruta: 'accion',
    casos: {
      'sin token: 401': async ({ pedirAccion }) => espera(await pedirAccion(null, 'mi/avisos#marcarTodoLeido', []), 401),
      'una que no existe: 404': async ({ pedirAccion }) =>
        espera(await pedirAccion(MIEMBRO, 'mi/comunidad#noExiste', []), 404),
      'una del panel: 404, no está en la lista': async ({ pedirAccion }) =>
        espera(await pedirAccion(MIEMBRO, 'panel/miembros#crearMiembro', []), 404),
      'trucos con el prototipo: 404': async ({ pedirAccion }) => {
        const a = await pedirAccion(MIEMBRO, 'mi/comunidad#constructor', []);
        const b = await pedirAccion(MIEMBRO, '__proto__#toString', []);
        return [...espera(a, 404), ...espera(b, 404)];
      },
      'argumentos raros: 400': async ({ pedirAccion }) =>
        espera(await pedirAccion(MIEMBRO, 'mi/avisos#abrirAviso', [{ hola: 1 }]), 400),
      'visita sin iglesia da me gusta: la propia action la echa, sin escribir': async ({ pedirAccion }) => {
        const r = await pedirAccion(VISITA, 'mi/comunidad#alternarMeGusta', ['00000000-0000-4000-8000-000000000000']);
        return [...espera(r, 200), ...(typeof r.json?.redirigir === 'string' ? [] : [`no redirige: ${r.texto.slice(0, 120)}`])];
      },
    },
  },
  // ------------------------------------------------------------------
  // Mi cuenta y la Biblia (fase 3).
  // ------------------------------------------------------------------
  {
    ruta: 'mi/cuenta',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/cuenta', null), 401),
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/mi/cuenta'), 403),
      'miembro: su cuenta, con su correo y nada de Sion': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/cuenta');
        return [...espera(r, 200), ...igual('correo', r.json?.correo, MIEMBRO), ...sinRastroDe(r, demo.sion)];
      },
    },
  },
  {
    ruta: 'mi/cuenta/bloqueados',
    casos: {
      'miembro: 200 con su lista': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/cuenta/bloqueados');
        return [...espera(r, 200), ...(Array.isArray(r.json?.bloqueos) ? [] : ['no trae `bloqueos`'])];
      },
      'visita sin iglesia: 403': async ({ pedirComo }) =>
        espera(await pedirComo(VISITA, 'GET', '/mi/cuenta/bloqueados'), 403),
    },
  },
  {
    ruta: 'mi/cuenta/borrar',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/cuenta/borrar', null), 401),
      'visita sin iglesia: 200, también puede borrar su cuenta': async ({ pedirComo }) => {
        const r = await pedirComo(VISITA, 'GET', '/mi/cuenta/borrar');
        return [...espera(r, 200), ...(typeof r.json?.dia === 'string' ? [] : ['no trae `dia`'])];
      },
    },
  },
  {
    ruta: 'mi/cuenta/donativos',
    casos: {
      'miembro: 200, lo suyo': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/cuenta/donativos');
        return [...espera(r, 200), ...igual('iglesia.slug', r.json?.iglesia?.slug, demo.betel.slug), ...sinRastroDe(r, demo.sion)];
      },
      'año raro: no rompe': async ({ pedirComo }) =>
        espera(await pedirComo(MIEMBRO, 'GET', '/mi/cuenta/donativos?anio=abc'), 200),
      'visita sin iglesia: 403': async ({ pedirComo }) =>
        espera(await pedirComo(VISITA, 'GET', '/mi/cuenta/donativos'), 403),
    },
  },
  {
    ruta: 'mi/biblia',
    casos: {
      'Juan 3: trae el capítulo': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/biblia?libro=juan&cap=3');
        return espera(r, 200);
      },
      'un libro que no existe: sin capítulo': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/biblia?libro=noexiste&cap=1');
        return [...espera(r, 200), ...igual('capitulo', r.json?.capitulo, null)];
      },
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/mi/biblia'), 403),
    },
  },

  // ------------------------------------------------------------------
  // Mis hijos (Niños, fase N4). Cada familia, lo suyo; quien además lleva el
  // ministerio, como una familia más (la RLS le enseñaría todos los niños).
  // ------------------------------------------------------------------
  {
    ruta: 'mi/hijos',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/hijos', null), 401),
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/mi/hijos'), 403),
      'madre: su hijo, y no la hija de otra familia': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MADRE, 'GET', '/mi/hijos');
        const nombres = (r.json?.hijos ?? []).map((h) => h.nombre);
        return [
          ...espera(r, 200),
          ...igual('hijos', nombres.join(','), 'Tomás'),
          ...(r.texto.includes('Lía') ? ['FUGA: trae a Lía, de otra familia'] : []),
          ...sinRastroDe(r, demo.sion),
        ];
      },
      'la otra madre: su hija': async ({ pedirComo }) => {
        const r = await pedirComo(MADRE2, 'GET', '/mi/hijos');
        return [...espera(r, 200), ...igual('hijos', (r.json?.hijos ?? []).map((h) => h.nombre).join(','), 'Lía')];
      },
      'la responsable: ningún hijo, aunque lleve el ministerio': async ({ pedirComo }) => {
        const r = await pedirComo(MAESTRA, 'GET', '/mi/hijos');
        return [...espera(r, 200), ...igual('hijos', (r.json?.hijos ?? []).length, 0)];
      },
      'miembro: ve que hay tablón, sin hijos': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/hijos');
        return [
          ...espera(r, 200),
          ...igual('ministerios', (r.json?.ministerios ?? []).length, 1),
          ...igual('hijos', (r.json?.hijos ?? []).length, 0),
        ];
      },
    },
  },
  {
    ruta: 'mi/hijos/tablon',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/hijos/tablon', null), 401),
      'visita sin iglesia: 403': async ({ pedirComo }) =>
        espera(await pedirComo(VISITA, 'GET', '/mi/hijos/tablon'), 403),
      'madre: lo publicado desde que la aceptaron, sin el borrador ni lo de antes': async ({ pedirComo }) => {
        const r = await pedirComo(MADRE, 'GET', '/mi/hijos/tablon');
        const textos = (r.json?.publicaciones ?? []).map((p) => p.texto);
        return [...espera(r, 200), ...igual('publicaciones', textos.join(' | '), 'Cantamos y pintamos el arca')];
      },
      'la madre aceptada hoy: nada de hace dos días': async ({ pedirComo }) => {
        const r = await pedirComo(MADRE2, 'GET', '/mi/hijos/tablon');
        return [...espera(r, 200), ...igual('publicaciones', (r.json?.publicaciones ?? []).length, 0)];
      },
      'la responsable: como una familia sin hijos, nada': async ({ pedirComo }) => {
        const r = await pedirComo(MAESTRA, 'GET', '/mi/hijos/tablon');
        return [...espera(r, 200), ...igual('publicaciones', (r.json?.publicaciones ?? []).length, 0)];
      },
      'miembro sin hijos: nada': async ({ pedirComo }) => {
        const r = await pedirComo(MIEMBRO, 'GET', '/mi/hijos/tablon');
        return [...espera(r, 200), ...igual('publicaciones', (r.json?.publicaciones ?? []).length, 0)];
      },
    },
  },

  // ------------------------------------------------------------------
  // Equipo (fase 4): una ruta para las quince pantallas. Cada una pone su
  // guarda en su `cargar`; aquí se mira que la tabla sea cerrada y que las
  // guardas corten. Betel tiene la prueba en vigor, así que sus cuentas pasan
  // de la suscripción y llegan a la guarda de cada pantalla.
  // ------------------------------------------------------------------
  {
    ruta: 'mi/equipo/[[...ruta]]',
    casos: {
      'sin token: 401': async ({ pedir }) => espera(await pedir('GET', '/mi/equipo', null), 401),
      'visita sin iglesia: 403': async ({ pedirComo }) => espera(await pedirComo(VISITA, 'GET', '/mi/equipo'), 403),
      'una dirección fuera de la tabla: 404': async ({ pedirComo }) =>
        espera(await pedirComo(LIDER, 'GET', '/mi/equipo/00000000-0000-4000-8000-000000000000/otra-cosa'), 404),
      'un id que no es uuid: 404, sin consultar': async ({ pedirComo }) =>
        espera(await pedirComo(LIDER, 'GET', '/mi/equipo/abc/turnos'), 404),
      'un equipo de Betel pedido desde Sion: no lo ve': async ({ pedirComo, demo }) => {
        if (!demo.alabanza) return ['la iglesia de prueba no tiene Alabanza'];
        const r = await pedirComo(SION, 'GET', `/mi/equipo/${demo.alabanza}/turnos`);
        return [
          ...(r.status === 404 || r.status === 403 ? [] : [`código ${r.status}, se esperaba 404 o 403`]),
          ...sinRastroDe(r, demo.betel),
        ];
      },
      'el ctx que sale va recortado: sin suscripción ni plan': async ({ pedirComo }) => {
        const r = await pedirComo(LIDER, 'GET', '/mi/equipo');
        if (r.status !== 200) return [];
        return [
          ...(r.texto.includes('stripeSubscriptionId') ? ['FUGA: el ctx trae la suscripción'] : []),
          ...(r.texto.includes('app_metadata') ? ['FUGA: el ctx trae el usuario entero'] : []),
        ];
      },
    },
  },
  // ------------------------------------------------------------------
  // Niños en Equipo (fase N5): la puerta ESTRECHA, la de quien lleva ESE
  // ministerio (la responsable y los maestros) y el pastor. Ni las familias
  // ni el líder de otro ministerio ni el pastor de otra iglesia.
  // ------------------------------------------------------------------
  {
    ruta: 'mi/equipo/[[...ruta]]',
    casos: {
      // La portada se caía en la app: cada tarjeta traía el `Icono` del
      // catálogo, un componente, y por JSON llegaba como un objeto que React no
      // sabe pintar. Ahora el icono se busca por id (`en-la-app/iconos.ts`).
      'portada del equipo: las tarjetas viajan sin componentes dentro': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MAESTRA, 'GET', `/mi/equipo/${demo.ninos}`);
        const tarjetas = r.json?.datos?.tarjetas ?? [];
        const raras = tarjetas.filter((t) => Object.keys(t.modulo ?? {}).sort().join(',') !== 'id,nombre');
        return [
          ...espera(r, 200),
          ...(tarjetas.length > 0 ? [] : ['no trae tarjetas']),
          ...raras.map((t) => `la tarjeta ${t.modulo?.id} trae ${Object.keys(t.modulo ?? {}).join(', ')}`),
        ];
      },
      'Niños: la responsable ve el tablón, con el borrador': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MAESTRA, 'GET', `/mi/equipo/${demo.ninos}/ninos`);
        return [
          ...espera(r, 200),
          ...igual('pantalla', r.json?.pantalla, 'ninos'),
          ...igual('publicaciones', (r.json?.datos?.publicaciones ?? []).length, 3),
          ...sinRastroDe(r, demo.sion),
        ];
      },
      'Niños: el maestro (colíder) entra, y no le salen familias que aceptar': async ({ pedirComo, demo }) => {
        const r = await pedirComo(AUXILIAR, 'GET', `/mi/equipo/${demo.ninos}/ninos`);
        return [...espera(r, 200), ...igual('familiasEsperando', r.json?.datos?.familiasEsperando, 0)];
      },
      'Niños: una madre no entra al tablón del equipo': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MADRE, 'GET', `/mi/equipo/${demo.ninos}/ninos`);
        return [
          ...(r.status === 403 || r.status === 404 ? [] : [`código ${r.status}, se esperaba 403 o 404`]),
          ...(r.texto.includes('Cantamos') ? ['FUGA: trae el tablón'] : []),
        ];
      },
      'Niños: el líder de otro ministerio no entra': async ({ pedirComo, demo }) => {
        const r = await pedirComo(LIDER, 'GET', `/mi/equipo/${demo.ninos}/ninos/familias`);
        return [
          ...(r.status === 403 || r.status === 404 ? [] : [`código ${r.status}, se esperaba 403 o 404`]),
          ...(r.texto.includes('Tomás') ? ['FUGA: trae a los niños'] : []),
        ];
      },
      'Niños: el pastor de Sion no ve nada de Betel': async ({ pedirComo, demo }) => {
        const r = await pedirComo(SION, 'GET', `/mi/equipo/${demo.ninos}/ninos/cronograma`);
        return [
          ...(r.status === 403 || r.status === 404 ? [] : [`código ${r.status}, se esperaba 403 o 404`]),
          ...sinRastroDe(r, demo.betel),
          ...(r.texto.includes('Goliat') ? ['FUGA: trae el cronograma'] : []),
        ];
      },
      'Niños: el maestro lee el cronograma': async ({ pedirComo, demo }) => {
        const r = await pedirComo(AUXILIAR, 'GET', `/mi/equipo/${demo.ninos}/ninos/cronograma`);
        return [
          ...espera(r, 200),
          ...igual('próxima', r.json?.datos?.proximas?.[0]?.tema, 'David y Goliat'),
        ];
      },
      'Niños: el maestro ve los niños y no acepta familias': async ({ pedirComo, demo }) => {
        const r = await pedirComo(AUXILIAR, 'GET', `/mi/equipo/${demo.ninos}/ninos/familias`);
        return [
          ...espera(r, 200),
          ...igual('acepta', r.json?.datos?.acepta, false),
          ...igual('niños', (r.json?.datos?.ninos ?? []).length, 2),
        ];
      },
      'Niños: la publicación trae sus fotos firmadas, sin la ruta de Storage': async ({ pedirComo, demo }) => {
        const r = await pedirComo(MAESTRA, 'GET', `/mi/equipo/${demo.ninos}/ninos/publicacion/${demo.pubNueva}`);
        const archivos = r.json?.datos?.archivos ?? [];
        return [
          ...espera(r, 200),
          ...igual('pantalla', r.json?.pantalla, 'ninosPublicacion'),
          // El sin confirmar no sale: no se sabe si llegó a subirse.
          ...igual('archivos', archivos.length, 1),
          ...(archivos.every((a) => !('ruta' in a) && !('miniaturaRuta' in a)) ? [] : ['FUGA: la ruta de Storage viaja a la app']),
          ...igual('pueden', (r.json?.datos?.pueden ?? []).join(','), 'Tomás'),
        ];
      },
      'Niños: una publicación que no existe: 404': async ({ pedirComo, demo }) =>
        espera(
          await pedirComo(MAESTRA, 'GET', `/mi/equipo/${demo.ninos}/ninos/publicacion/00000000-0000-4000-8000-000000000000`),
          404,
        ),
    },
  },
  {
    ruta: 'accion',
    casos: {
      'Niños, Equipo: una madre no retira lo publicado': async ({ pedirAccion, pedirComo, demo }) => {
        const r = await pedirAccion(MADRE, 'mi/equipo/[id]/ninos#retirarPublicacion', [demo.ninos, demo.pubNueva]);
        const despues = await pedirComo(MAESTRA, 'GET', `/mi/equipo/${demo.ninos}/ninos/publicacion/${demo.pubNueva}`);
        // `enLaApp` cierra con un 404 a quien no es del equipo, como la pantalla.
        // Si algún día redirige, que no sea al panel.
        const cerrada = r.status === 404 || (r.status === 200 && typeof r.json?.redirigir === 'string');
        return [
          ...(cerrada ? [] : [`código ${r.status}, se esperaba 404 o una redirección: ${r.texto.slice(0, 120)}`]),
          ...(r.json?.redirigir?.startsWith('/panel') ? [`redirige al panel: ${r.json.redirigir}`] : []),
          ...igual('sigue publicada', despues.json?.datos?.publicacion?.publicada, true),
        ];
      },
      'Niños, Equipo: una madre no prepara una subida': async ({ pedirAccion, demo }) => {
        const r = await pedirAccion(MADRE, 'mi/equipo/[id]/ninos#prepararSubida', [
          demo.ninos,
          { __campos: { tipo: 'foto', mime: 'image/webp', bytes: '1000', fecha: '2026-01-01', publicacionId: demo.pubBorrador } },
        ]);
        return [
          ...espera(r, 200),
          ...(typeof r.json?.redirigir === 'string' ? [] : [`no redirige: ${r.texto.slice(0, 160)}`]),
          ...(r.json?.redirigir?.startsWith('/panel') ? [`redirige al panel: ${r.json.redirigir}`] : []),
        ];
      },
      'Niños, Equipo: a lo publicado no se suben fotos sin retirarlo': async ({ pedirAccion, demo }) => {
        const r = await pedirAccion(MAESTRA, 'mi/equipo/[id]/ninos#prepararSubida', [
          demo.ninos,
          { __campos: { tipo: 'foto', mime: 'image/webp', bytes: '1000', fecha: '2026-01-01', publicacionId: demo.pubNueva } },
        ]);
        return [
          ...espera(r, 200),
          ...igual('ok', r.json?.valor?.ok, false),
          ...(String(r.json?.valor?.error ?? '').includes('Ya está publicada') ? [] : [`error: ${r.json?.valor?.error}`]),
        ];
      },
    },
  },
];

// ============================================
// Comprobaciones
// ============================================

function espera(r, status) {
  return r.status === status ? [] : [`código ${r.status}, se esperaba ${status}: ${r.texto.slice(0, 160)}`];
}

function igual(campo, obtenido, esperado) {
  return obtenido === esperado ? [] : [`${campo} = ${JSON.stringify(obtenido)}, se esperaba ${JSON.stringify(esperado)}`];
}

function slugs(r) {
  return (r.json?.iglesias ?? []).map((i) => i.slug);
}

/** Una solicitud bien formada a Betel. Ver el caso «ya_tenia»: no escribe. */
function solicitudValida() {
  return {
    slug: SLUG_BETEL,
    nombre: 'Prueba de puertas',
    telefono: '600000000',
    prefijo: 'ES',
    consentimiento: true,
    asistencia: false,
  };
}

function sinRastroDe(r, iglesia) {
  const fallos = [];
  if (r.texto.includes(iglesia.id)) fallos.push(`FUGA: trae el id de ${iglesia.nombre}`);
  if (r.texto.includes(iglesia.nombre)) fallos.push(`FUGA: trae el nombre de ${iglesia.nombre}`);
  return fallos;
}

// ============================================
// La iglesia de prueba
// ============================================

/** Lo que los casos necesitan de `scripts/pruebas/demo.mjs`, con sus nombres. */
function datosDe(demo) {
  return {
    betel: demo.betel,
    sion: demo.sion,
    turnoBetel: demo.ids.turnoAlabanza,
    reunionBetel: demo.ids.reunionCongregacion,
    alabanza: demo.ids.alabanza,
    ninos: demo.ids.ninos,
    pubNueva: demo.ids.pubNueva,
    pubBorrador: demo.ids.pubBorrador,
  };
}

// ============================================
// Sesiones sin contraseña
// ============================================

const admin = createClient(SUPABASE_URL, CLAVE_SERVICIO, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publico = createClient(SUPABASE_URL, CLAVE_PUBLICABLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function abrirSesion(email) {
  const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (e1) throw new Error(`${email}: ${e1.message}`);
  const { data, error: e2 } = await publico.auth.verifyOtp({
    token_hash: enlace.properties.hashed_token,
    type: 'magiclink',
  });
  if (e2 || !data.session) throw new Error(`${email}: ${e2?.message ?? 'sin sesión'}`);

  // La cookie de `@supabase/ssr`, para el caso «token falso con cookie».
  const valor = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
  const trozos = [];
  for (let i = 0; i < valor.length; i += 3180) trozos.push(valor.slice(i, i + 3180));
  const nombre = `sb-${REF}-auth-token`;
  const cookie =
    trozos.length === 1 ? `${nombre}=${valor}` : trozos.map((t, i) => `${nombre}.${i}=${t}`).join('; ');

  return { token: data.session.access_token, cookie };
}

// ============================================
// Pedir
// ============================================

async function pedirCrudo(metodo, ruta, { autorizacion, cookie, origen, cuerpo } = {}) {
  const cabeceras = {};
  if (autorizacion) cabeceras.authorization = autorizacion;
  if (cookie) cabeceras.cookie = cookie;
  if (origen) cabeceras.origin = origen;
  if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json';
  const inicio = performance.now();
  const r = await fetch(BASE + '/api/v1/app' + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  });
  const ms = Math.round(performance.now() - inicio);
  const texto = await r.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { status: r.status, headers: r.headers, texto, json, ms };
}

// ============================================
// Main
// ============================================

function rutasEnDisco(carpeta) {
  const rutas = [];
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const completa = join(carpeta, entrada.name);
    if (entrada.isDirectory()) rutas.push(...rutasEnDisco(completa));
    else if (entrada.name === 'route.ts') {
      rutas.push(relative(CARPETA_API, carpeta).split(sep).join('/'));
    }
  }
  return rutas;
}

async function main() {
  try {
    await fetch(BASE + '/api/v1/app/version', { signal: AbortSignal.timeout(60_000) });
  } catch {
    console.error(`No contesta ${BASE}. Enciende el servidor con \`npm run dev\`.`);
    process.exit(2);
  }

  const fallos = [];

  // 1. Cobertura: todo endpoint en disco tiene casos.
  const conCasos = new Set(ENDPOINTS.map((e) => e.ruta));
  for (const ruta of rutasEnDisco(CARPETA_API)) {
    if (!conCasos.has(ruta)) fallos.push(`${ruta}: hay un route.ts sin casos en este test`);
  }

  await conDemo({ cuentas: true, publicada: true }, (d) => probar(d, fallos));
}

async function probar(montada, fallos) {
  ({
    pastor: PASTOR,
    secretaria: SECRETARIA,
    lider: LIDER,
    miembro: MIEMBRO,
    colider: COLIDER,
    visita: VISITA,
    sion: SION,
    maestra: MAESTRA,
    madre: MADRE,
    madre2: MADRE2,
    auxiliar: AUXILIAR,
  } = montada.cuentas);
  CUENTAS = [PASTOR, SECRETARIA, LIDER, MIEMBRO, COLIDER, VISITA, SION, MAESTRA, MADRE, MADRE2, AUXILIAR];
  SLUG_BETEL = montada.betel.slug;
  const demo = datosDe(montada);
  const sesiones = {};
  try {
    for (const c of CUENTAS) sesiones[c] = await abrirSesion(c);

    const contexto = {
      demo,
      pedir: (m, ruta, autorizacion, cuerpo) => pedirCrudo(m, ruta, { autorizacion, cuerpo }),
      pedirConCookie: (m, ruta, autorizacion, cuenta) =>
        pedirCrudo(m, ruta, { autorizacion, cookie: sesiones[cuenta].cookie }),
      pedirAccion: async (cuenta, id, args) => {
        const form = new FormData();
        form.set('__id', id);
        // `{ __campos }` es un `FormData`, y viaja como lo manda la app
        // (`movil/src/lib/acciones.ts`): sus campos aparte, `{ __fd: n }` en su sitio.
        let n = 0;
        const serializados = args.map((a) => {
          if (!a || typeof a !== 'object' || !('__campos' in a)) return a;
          for (const [campo, valor] of Object.entries(a.__campos)) form.append(`__fd${n}:${campo}`, valor);
          return { __fd: n++ };
        });
        form.set('__args', JSON.stringify(serializados));
        const cabeceras = cuenta ? { authorization: `Bearer ${sesiones[cuenta].token}` } : {};
        const r = await fetch(BASE + '/api/v1/app/accion', {
          method: 'POST',
          headers: cabeceras,
          body: form,
          signal: AbortSignal.timeout(120_000),
        });
        const texto = await r.text();
        let json;
        try {
          json = JSON.parse(texto);
        } catch {
          json = undefined;
        }
        return { status: r.status, headers: r.headers, texto, json };
      },
      pedirComo: (cuenta, m, ruta, cuerpo) =>
        pedirCrudo(m, ruta, { autorizacion: `Bearer ${sesiones[cuenta].token}`, cuerpo }),
    };

    // 2 y 3. Cada caso de cada endpoint.
    let casos = 0;
    for (const { ruta, casos: suyos } of ENDPOINTS) {
      for (const [nombre, caso] of Object.entries(suyos)) {
        casos += 1;
        const encontrados = await caso(contexto);
        const marca = encontrados.length ? 'FALLO' : 'ok   ';
        console.log(`${marca} ${ruta} · ${nombre}`);
        for (const f of encontrados) {
          console.log(`        ${f}`);
          fallos.push(`${ruta} · ${nombre}: ${f}`);
        }
      }
    }

    // 4. CORS.
    const cors = [
      ['OPTIONS', ORIGEN_IOS, true],
      ['OPTIONS', ORIGEN_ANDROID, true],
      ['OPTIONS', ORIGEN_AJENO, false],
      ['GET', ORIGEN_IOS, true],
      ['GET', ORIGEN_AJENO, false],
    ];
    for (const [metodo, origen, lee] of cors) {
      casos += 1;
      const r = await pedirCrudo(metodo, '/yo', {
        origen,
        autorizacion: metodo === 'GET' ? `Bearer ${sesiones[MIEMBRO].token}` : undefined,
      });
      const permitido = r.headers.get('access-control-allow-origin');
      const bien = lee ? permitido === origen : permitido === null;
      const esperado = metodo === 'OPTIONS' ? 204 : 200;
      const problemas = [
        ...(bien ? [] : [`access-control-allow-origin = ${permitido}`]),
        ...(r.status === esperado ? [] : [`código ${r.status}, se esperaba ${esperado}`]),
        ...(r.headers.get('access-control-allow-credentials') ? ['no debe permitir credenciales'] : []),
      ];
      const nombre = `CORS ${metodo} desde ${origen}: ${lee ? 'lee' : 'no lee'}`;
      console.log(`${problemas.length ? 'FALLO' : 'ok   '} ${nombre}`);
      for (const p of problemas) {
        console.log(`        ${p}`);
        fallos.push(`${nombre}: ${p}`);
      }
    }

    // Lo que tarda `/yo` por cuenta, con el `Server-Timing` del servidor.
    console.log('\nTiempos de /yo (ida y vuelta, y los tramos del servidor en ms):');
    for (const c of CUENTAS) {
      const r = await contexto.pedirComo(c, 'GET', '/yo');
      // Cada tramo que midió el servidor (`medir()`), y el total.
      const tramos = (r.headers.get('server-timing') ?? '')
        .split(',')
        .map((t) => t.trim().replace(';dur=', ' '))
        .join(' · ');
      console.log(`  ${c.padEnd(40)} ${String(r.ms).padStart(5)} ms  ${tramos}`);
    }

    console.log(`\n${casos} casos, ${fallos.length} fallos.`);
    process.exitCode = fallos.length ? 1 : 0;
  } finally {
    for (const s of Object.values(sesiones)) {
      await admin.auth.admin.signOut(s.token, 'local').catch(() => {});
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
