import 'server-only';

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { withUser } from '@/lib/db';
import { ministerios } from '@/lib/db/schema';
import {
  getCurrentUserContext,
  type UserContext,
} from '@/lib/auth/user-context';
import {
  esDelEquipo,
  esPastor,
  puede,
  puedeGestionarDesdeDentro,
  puedeGestionarMinisterio,
  type Permiso,
} from '@/lib/auth/permisos';
import {
  obtenerMinisterio,
  type MinisterioDetalle,
} from '@/lib/ministerios/consultas';
import { tieneModulo, type ModuloId } from '@/lib/ministerios/modulos';
import { estadoConsentimiento } from '@/lib/rgpd/consultas';
import { createClient } from '@/lib/supabase/server';
import { leerEstadoSuscripcion } from '@/lib/suscripcion/estado';
import { exigirPoderEscribir } from '@/lib/suscripcion/muro';

/**
 * Guardas de autorización del panel.
 *
 * DOS SABORES, Y NO ES CAPRICHO
 * -----------------------------
 * Una PÁGINA puede `redirect()` al fallar: la persona acaba en un sitio con
 * sentido. Una ACTION que redirige al fallar es indistinguible del éxito para
 * quien la invoca a pelo, así que se redirige con `?error=`, que además es la
 * convención de errores de action en todo el repo.
 *
 * DÓNDE PONERLAS: EN CADA PÁGINA, CON LA CADENA ENTERA
 * ----------------------------------------------------
 * Aquí ponía «en el `layout.tsx` de la sección, no en cada página». En Next 16
 * es falso, y lo dice su documentación (`02-guides/authentication.md`, «Layouts
 * and auth checks»): un layout no controla si el resto de la ruta se renderiza.
 * La página se ejecuta igual, y lo que consulta viaja en el payload RSC aunque
 * el layout redirija. Así se encontró: un miembro raso —sin `ver_seguimiento` y
 * sin panel— pidió `/panel/ministerios/<id>/seguimiento` con la cabecera
 * `RSC: 1` y se llevó la lista entera, con trece teléfonos, mientras el layout
 * le mandaba a `/mi`.
 *
 * Así que cada página aplica ELLA MISMA todas las puertas de los layouts que
 * tiene encima: la del panel (`requirePanel`) más la de su sección. Las de
 * sección de aquí abajo llevan dentro la del panel, y una sola llamada basta.
 * El layout puede repetirla para que la navegación normal redirija, pero no
 * protege nada. Un `route.ts` no pasa por ningún layout, nunca: ese usa
 * `motivoFueraDelPanel()` y devuelve una `Response` (por qué no `redirect()`,
 * en `guard-api.ts`).
 *
 * El hueco de Gonper sigue valiendo, ahora del otro lado: `/panel/clientes`
 * guardado y `/panel/clientes/[id]` no. Una ruta dinámica es una página más, y
 * necesita su guarda.
 *
 * REPETIRLAS NO REPITE LAS CONSULTAS
 * ----------------------------------
 * `getCurrentUserContext` va con `cache()` de React, y aquí también
 * `requirePanel`, `esMinisterioDeSuIglesia` y el `obtenerMinisterio` de
 * `requireModuloMinisterio`. Comprobado en el React que trae Next
 * (`compiled/react/cjs/react.react-server.production.js` y el `getCacheForType`
 * de `react-server-dom-webpack`): la memoria cuelga de la petición RSC, y layout
 * y página se pintan en la misma —es lo que propone `layout.md` para pedir un
 * dato en los dos sitios—. Un fallo también se recuerda: el `redirect()` de la
 * primera llamada se relanza en la segunda sin volver a consultar.
 *
 * Lo que NO se ahorra es lo que un layout pide por su cuenta sin pasar por aquí:
 * el `exigirConsentimientoAlDia` de `panel/layout.tsx` y el `obtenerMinisterio`
 * de los layouts de módulo. Una consulta por clave más por carga. Y fuera de un
 * render —server actions, `route.ts`— `cache()` no memoriza: sin petición RSC
 * cada llamada es una llamada. Correcto, solo que sin ahorro.
 *
 * QUÉ NO PROTEGE ESTO
 * -------------------
 * El aislamiento entre iglesias. Eso lo garantizan las policies de RLS y
 * `withUser()`, y `getCurrentUserContext` resolviendo la iglesia desde
 * `iglesia_usuarios` y nunca desde un parámetro del cliente. Aquí solo se
 * decide QUÉ puede hacer alguien dentro de SU congregación.
 *
 * Pero dentro de su congregación, esto es la única puerta. Casi toda la RLS es
 * por iglesia y no por permiso: un miembro raso pasa las policies de
 * `miembros`, de las finanzas o del seguimiento igual que el pastor. Que una
 * guarda falte no es «una pantalla que no le tocaba»: son datos del art. 9 de
 * su propia iglesia en manos de quien no debía verlos.
 */

const MENSAJE_SOLO_PASTOR =
  'Solo el pastor de la iglesia puede entrar en esta sección.';

const MENSAJE_SIN_PERMISO = 'No tienes acceso a esta sección.';

/**
 * A dónde va quien no tiene contexto de iglesia.
 *
 * SIN ESTO HABÍA UN BUCLE
 * -----------------------
 * `getCurrentUserContext()` devuelve null en DOS situaciones que no son la
 * misma: no hay sesión, o hay sesión pero sin membresía activa —quien acaba de
 * pedir entrar en una iglesia y espera aprobación—.
 *
 * Mandar los dos casos a `/acceso` funcionaba mientras la única forma de tener
 * cuenta era fundando una iglesia. En cuanto existen las solicitudes de
 * ingreso, la segunda situación es real y produce un bucle: el guard manda a
 * `/acceso`, la persona ya tiene sesión, se identifica, vuelve al panel, y el
 * guard la vuelve a echar. Sin mensaje y sin salida.
 *
 * Así que se distingue: sin sesión, a identificarse; con sesión y sin iglesia,
 * a `/mi`, que le cuenta en qué punto está su solicitud.
 */
async function rebotar(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/mi' : '/acceso');
}

// ============================================
// PÁGINAS (y los layouts que las repiten)
// ============================================

/**
 * Exige sesión con iglesia activa. Y NADA MÁS.
 *
 * No basta para una página de `/panel`: no mira si es del equipo, ni el
 * consentimiento, ni la suscripción. Esa usa `requirePanel()` o una de las de
 * sección. Esta queda para lo que vive fuera del panel y no puede llevar esos
 * cortes —`/mi`, `/acepta`, `/suscripcion`— y para lo que solo pide el
 * contexto para pintar, debajo de una página que ya pasó su guarda.
 *
 * Distingue tres situaciones que la persona vive de forma muy distinta: sin
 * sesión, con solicitud en revisión, y sin iglesia ninguna.
 */
export async function requireIglesia(): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  return ctx;
}

/**
 * Por qué alguien con iglesia no puede estar en el panel, o `null` si puede.
 *
 * Son los tres cortes de `panel/layout.tsx`, en su orden. Viven aquí sin
 * `redirect()` para que haya UNA lista: `requirePanel` la convierte en
 * redirecciones, y un `route.ts`, que no debe redirigir, en una `Response`.
 *
 *   - `fuera_del_equipo`: un miembro raso. Su área es `/mi`; el porqué de mirar
 *     capacidades y no el rol, en `esDelEquipo`.
 *   - `consentimiento`: aceptó una versión anterior de la política. Es el mismo
 *     corte que `exigirConsentimientoAlDia`, sin el redirect.
 *   - `bloqueada`: la suscripción, pasada ya la gracia de lectura. En
 *     `solo_lectura` NO se corta: leer sigue abierto tres días.
 */
export type MotivoFueraDelPanel =
  | 'fuera_del_equipo'
  | 'consentimiento'
  | 'bloqueada';

export async function motivoFueraDelPanel(
  ctx: UserContext,
): Promise<MotivoFueraDelPanel | null> {
  if (!esDelEquipo(ctx)) return 'fuera_del_equipo';
  if (!(await estadoConsentimiento(ctx)).alDia) return 'consentimiento';
  if (leerEstadoSuscripcion(ctx.iglesia).situacion === 'bloqueada') {
    return 'bloqueada';
  }
  return null;
}

/** Los mismos destinos que `panel/layout.tsx`. */
const SALIDA_DEL_PANEL: Record<MotivoFueraDelPanel, string> = {
  fuera_del_equipo: '/mi',
  consentimiento: '/acepta',
  bloqueada: '/suscripcion',
};

/**
 * La puerta del panel entero: lo que hace `panel/layout.tsx` antes de pintar,
 * para que cada página lo haga también por su cuenta.
 *
 * Toda página de `/panel` empieza por aquí, o por una de las de sección de
 * abajo, que ya lo llaman. Devuelve el mismo contexto que `requireIglesia`.
 *
 * Con `cache()`: sin argumentos, así que dentro de un render se ejecuta una vez
 * por muchas guardas que la pidan —`requireModuloMinisterio` la alcanza por dos
 * caminos—.
 */
export const requirePanel = cache(
  async function requirePanel(): Promise<UserContext> {
    const ctx = await requireIglesia();
    const motivo = await motivoFueraDelPanel(ctx);
    if (motivo) redirect(SALIDA_DEL_PANEL[motivo]);
    return ctx;
  },
);

/**
 * Exige ser pastor. Para ajustes, equipo, facturación y bajas.
 *
 * Lleva dentro `requirePanel()`: en una página basta con esta.
 */
export async function requirePastor(): Promise<UserContext> {
  const ctx = await requirePanel();
  if (!esPastor(ctx)) {
    redirect('/panel/hoy?error=' + encodeURIComponent(MENSAJE_SOLO_PASTOR));
  }
  return ctx;
}

/**
 * Exige un permiso concreto. El pastor pasa siempre.
 *
 * Lleva dentro `requirePanel()`: en una página basta con esta.
 */
export async function requirePermiso(permiso: Permiso): Promise<UserContext> {
  const ctx = await requirePanel();
  if (!esPastor(ctx) && !puede(ctx, permiso)) {
    redirect('/panel/hoy?error=' + encodeURIComponent(MENSAJE_SIN_PERMISO));
  }
  return ctx;
}

/**
 * Para las dos guards de ministerio, la de página y la de action.
 *
 * `desdeDentro` estrecha la puerta a pastor y a quien lidera ESTE equipo, sin
 * el camino de `gestionar_ministerios`. Es la de los módulos cuya RLS es por
 * equipo y no por iglesia; el porqué, en `puedeGestionarDesdeDentro`.
 */
export type OpcionesMinisterio = { desdeDentro?: boolean };

function puedeEntrarAlMinisterio(
  ctx: UserContext,
  ministerioId: string,
  opciones?: OpcionesMinisterio,
): boolean {
  return opciones?.desdeDentro
    ? puedeGestionarDesdeDentro(ctx, ministerioId)
    : puedeGestionarMinisterio(ctx, ministerioId);
}

/**
 * Exige poder gestionar ESTE ministerio.
 *
 * A diferencia de `requirePermiso`, no basta con mirar el mapa de permisos: hay
 * que cruzarlo con qué ministerios lidera esta persona. Ver
 * `puedeGestionarMinisterio`.
 *
 * Rebota a `/panel/ministerios` y no a `/panel/hoy`: quien llega aquí venía de
 * la rejilla de ministerios, y devolverlo al inicio le hace perder el sitio.
 *
 * Lleva dentro `requirePanel()`. Para una página de módulo (agenda, turnos…)
 * no basta: esa usa `requireModuloMinisterio`, que mira además la herramienta.
 */
export async function requireGestionMinisterio(
  ministerioId: string,
  opciones?: OpcionesMinisterio,
): Promise<UserContext> {
  const ctx = await requirePanel();
  if (
    !puedeEntrarAlMinisterio(ctx, ministerioId, opciones) ||
    !(await esMinisterioDeSuIglesia(ctx, ministerioId))
  ) {
    redirect('/panel/ministerios?error=' + encodeURIComponent(MENSAJE_SIN_PERMISO));
  }
  return ctx;
}

/**
 * `permiso` añade una puerta ANTES de las del ministerio. Es la del
 * seguimiento: `ver_seguimiento` no se abre por llevar el equipo, ni llevar el
 * equipo por tener el permiso.
 */
export type OpcionesModulo = OpcionesMinisterio & { permiso?: Permiso };

/**
 * Dentro de un render, una consulta por ministerio aunque la pidan varias
 * guardas. La clave es la pareja (ctx, id), y `ctx` es el mismo objeto en todo
 * el render porque sale del `getCurrentUserContext` memorizado.
 */
const obtenerMinisterioUnaVez = cache(obtenerMinisterio);

/**
 * La guarda entera de una página de módulo de ministerio: el panel, quién
 * (lleva ESTE equipo) y qué (la herramienta encendida en ESTE ministerio).
 *
 * Es lo que hacen los `layout.tsx` de agenda, turnos, repertorio, seguimiento y
 * reparto, en el mismo orden y con las mismas salidas: sin permiso, rebote con
 * mensaje; con la herramienta apagada, `notFound()`. Un 404 y no un rebote
 * porque a quien llega ahí no le falta un permiso —lo tiene—: es una ruta que
 * para ese ministerio no existe.
 *
 * La versión de action es `exigirModulo`, que redirige con `?error=` en vez de
 * dar 404, por lo que cuenta la cabecera de este fichero.
 *
 * Devuelve el ministerio porque todas esas páginas lo piden de todas formas
 * para la cabecera y las pestañas, y `notFound()` también cuando ya no existe,
 * igual que hacían ellas.
 *
 * `requireReparto` (`ministerios/[id]/reparto/guarda.ts`) es exactamente
 * `requireModuloMinisterio(id, 'reparto', { desdeDentro: true })`, y desde que
 * `requireGestionMinisterio` pasa por `requirePanel()` ya hereda la puerta del
 * panel sin tocarlo.
 */
export async function requireModuloMinisterio(
  ministerioId: string,
  modulo: ModuloId,
  opciones?: OpcionesModulo,
): Promise<{ ctx: UserContext; ministerio: MinisterioDetalle }> {
  if (opciones?.permiso) await requirePermiso(opciones.permiso);
  const ctx = await requireGestionMinisterio(ministerioId, opciones);

  const ministerio = await obtenerMinisterioUnaVez(ctx, ministerioId);
  if (!ministerio || !tieneModulo(ministerio.modulos, modulo)) notFound();

  return { ctx, ministerio };
}

/**
 * ¿Es este ministerio de la iglesia del contexto?
 *
 * PARECE REDUNDANTE CON LA RLS Y NO LO ES
 * ---------------------------------------
 * La RLS de `ministerio_miembros` y compañía pide `pertenece_a_iglesia()`, que
 * es «tiene membresía activa en ESA iglesia», no «es la iglesia con la que está
 * trabajando ahora». Una cuenta activa en dos congregaciones pasa la RLS en las
 * dos. Y `puedeGestionarMinisterio` deja pasar al pastor y a
 * `gestionar_ministerios` con CUALQUIER id: era el pastor de la iglesia A
 * vaciando el equipo de Alabanza de la B, donde es un miembro más, con un id
 * sacado de una URL.
 *
 * Para el líder acotado ya lo cubría `ministeriosQueLidera`, que sale solo de
 * la iglesia del contexto; esto lo cierra para los otros dos caminos. Una
 * consulta por pantalla y por action de ministerio, contra la clave primaria.
 *
 * Con `cache()` para que el layout y la página, que ahora la piden los dos, no
 * hagan dos viajes. En una action no memoriza nada (cabecera del fichero).
 */
const esMinisterioDeSuIglesia = cache(async function esMinisterioDeSuIglesia(
  ctx: UserContext,
  ministerioId: string,
): Promise<boolean> {
  // Un id que no es uuid haría fallar el cast en Postgres con un 500.
  if (!z.string().uuid().safeParse(ministerioId).success) return false;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: ministerios.id })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );
  return filas.length > 0;
});

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * El portillo del muro de suscripción.
 *
 * Las cuatro guards de action cortan por defecto cuando la iglesia ya no puede
 * escribir. `sinMuro` es la excepción, y la lista de quién la usa es corta a
 * propósito: pagar, darse de baja, aceptar la política y tocar la cuenta
 * propia. Todo lo demás pasa por el muro sin decir nada, incluido lo que se
 * escriba dentro de un año.
 */
export type OpcionesAccion = { sinMuro?: boolean };

/**
 * Exige sesión con iglesia activa desde una server action.
 *
 * No lleva `destinoError` como sus hermanas: si no hay sesión, el único destino
 * con sentido es identificarse, no volver a una pantalla del panel que también
 * va a rebotar.
 */
export async function requireIglesiaAccion(
  opciones?: OpcionesAccion,
): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  if (!opciones?.sinMuro) exigirPoderEscribir(ctx);
  return ctx;
}

export async function requirePastorAccion(
  destinoError = '/panel/hoy',
  opciones?: OpcionesAccion,
): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  // El rol primero y el muro después: a quien no es pastor se le dice que esta
  // sección no es suya, que es lo que le pasa a ella. «Tu iglesia no ha pagado»
  // es cierto pero no es su problema ni puede resolverlo.
  if (!esPastor(ctx)) {
    redirect(`${destinoError}?error=` + encodeURIComponent(MENSAJE_SOLO_PASTOR));
  }
  if (!opciones?.sinMuro) exigirPoderEscribir(ctx, destinoError);
  return ctx;
}

export async function requirePermisoAccion(
  permiso: Permiso,
  destinoError = '/panel/hoy',
  opciones?: OpcionesAccion,
): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return rebotar();
  if (!opciones?.sinMuro) exigirPoderEscribir(ctx, destinoError);
  if (!esPastor(ctx) && !puede(ctx, permiso)) {
    redirect(
      `${destinoError}?error=` +
        encodeURIComponent('No tienes permiso para hacer eso.'),
    );
  }
  return ctx;
}

/** La versión para actions de `requireGestionMinisterio`. */
export async function requireGestionMinisterioAccion(
  ministerioId: string,
  destinoError = '/panel/ministerios',
  opciones?: OpcionesMinisterio,
): Promise<UserContext> {
  const ctx = await requireIglesiaAccion({ sinMuro: true });
  exigirPoderEscribir(ctx, destinoError);
  if (
    !puedeEntrarAlMinisterio(ctx, ministerioId, opciones) ||
    !(await esMinisterioDeSuIglesia(ctx, ministerioId))
  ) {
    redirect(
      `${destinoError}?error=` +
        encodeURIComponent('No tienes permiso para hacer eso.'),
    );
  }
  return ctx;
}

/**
 * Exige que la herramienta esté encendida en ESTE ministerio.
 *
 * Va DETRÁS de `requireGestionMinisterioAccion`, en cada action de módulo, y
 * no sustituye a ninguna de las dos cosas que ya hay:
 *
 *   - El `layout.tsx` de cada módulo da 404 con la herramienta apagada, pero un
 *     layout no corre en una server action. Hasta que existió esto, quien lleva
 *     un equipo podía escribir en la agenda o el seguimiento apagados con un
 *     POST fabricado. Lo escrito no se veía ni se podía borrar hasta que alguien
 *     volviera a encender el módulo, y entonces aparecía de golpe.
 *   - `requireGestionMinisterioAccion` dice quién puede tocar el equipo, no
 *     qué herramientas tiene. Son dos preguntas, y la segunda la decide el
 *     pastor desde `/panel/modulos` y la pantalla de editar.
 *
 * Lee la columna en su propia consulta, contra la clave primaria y acotada a
 * la iglesia del contexto, igual que `esMinisterioDeSuIglesia`: un id de otra
 * congregación sale como «apagado», que es lo que es para quien pregunta.
 *
 * Vuelve al ministerio y no a la herramienta, que con el módulo apagado da 404.
 * La versión de página es `requireModuloMinisterio`.
 */
export async function exigirModulo(
  ctx: UserContext,
  ministerioId: string,
  modulo: ModuloId,
  destinoError = `/panel/ministerios/${ministerioId}`,
): Promise<void> {
  const encendido =
    z.string().uuid().safeParse(ministerioId).success &&
    (await withUser(ctx.user.id, async (tx) => {
      const [fila] = await tx
        .select({ modulos: ministerios.modulos })
        .from(ministerios)
        .where(
          and(
            eq(ministerios.id, ministerioId),
            eq(ministerios.iglesiaId, ctx.iglesia.id),
          ),
        )
        .limit(1);
      return fila ? tieneModulo(fila.modulos, modulo) : false;
    }));

  if (!encendido) {
    redirect(
      `${destinoError}?error=` +
        encodeURIComponent('Esa herramienta no está encendida en este ministerio.'),
    );
  }
}
