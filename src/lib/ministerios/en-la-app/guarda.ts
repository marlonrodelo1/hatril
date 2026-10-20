import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { puedeGestionarMinisterio } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import {
  obtenerMinisterio,
  type MinisterioDetalle,
} from '@/lib/ministerios/consultas';
import { tieneModulo, type ModuloId } from '@/lib/ministerios/modulos';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { leerEstadoSuscripcion } from '@/lib/suscripcion/estado';
import type { ModoEnElEquipo } from './contrato';
import { adaptadorDe } from './registro';

/**
 * Las puertas de la zona de equipos en la app, `/mi/equipo`.
 *
 * DOS NIVELES
 * -----------
 * La pestaña y la portada de cada ministerio son de todo el que SIRVE en él:
 * quien lo lleva las ve en modo líder y quien participa, en modo participante
 * (`requireMiEquipo`). Las herramientas que cuelgan de él —turnos, agenda,
 * repertorio, seguimiento— son solo de quien lo lleva
 * (`requireMinisterioEnLaApp`), con las mismas puertas que el panel, una a una:
 *
 *   1. Iglesia y consentimiento al día. `/mi` no tiene guard en su layout
 *      —`/mi/avisos` funciona sin membresía—, así que aquí se pone a mano, como
 *      en cada página de `/mi`.
 *   2. Suscripción. Con la iglesia `bloqueada` esto no se sirve, igual que el
 *      layout del panel: a `/suscripcion`. En `solo_lectura` se sigue leyendo,
 *      y lo que corta es `exigirPoderEscribir` en las actions.
 *   3. Llevar ESE ministerio: `puedeGestionarMinisterio`, la puerta de
 *      `requireGestionMinisterio`. El pastor y `gestionar_ministerios` pasan
 *      como en el panel; el líder acotado, solo a los suyos.
 *   4. El módulo encendido, y la puerta de más que declare su adaptador (el
 *      seguimiento pide `ver_seguimiento`).
 *
 * 404 Y NO UN REBOTE CON MENSAJE
 * ------------------------------
 * El panel rebota a `/panel/ministerios?error=`. Aquí no hay a dónde rebotar:
 * para quien no sirve en nada, la zona entera no existe —ni la pestaña sale—, y
 * enseñarle «no tienes permiso» sería confirmarle que hay algo detrás de la
 * URL. Un ministerio ajeno, un módulo apagado, la herramienta del líder pedida
 * por un voluntario y un uuid inventado dan lo mismo.
 *
 * VAN EN CADA PÁGINA, NO EN UN LAYOUT
 * -----------------------------------
 * Es la regla de `/mi` y aquí además tiene un motivo propio: un layout no se
 * vuelve a ejecutar al navegar entre las páginas que cuelgan de él, y entre la
 * portada y un turno se navega todo el rato. La que corre siempre es la página.
 * El coste es nulo: `getCurrentUserContext` va en `cache()`.
 */

/**
 * 404 si alguno de estos ids de la URL no es un uuid.
 *
 * Para los de debajo del ministerio —un turno, una reunión, una persona—, que
 * la guarda no conoce. Sin esto, `/mi/equipo/<id>/turnos/hola` llega a Postgres
 * y el cast revienta con un 500 en vez de decir que eso no existe.
 */
export function exigirUuid(...ids: string[]): void {
  if (!ids.every((v) => z.string().uuid().safeParse(v).success)) notFound();
}

/** Las puertas 1 y 2, comunes a todas las pantallas de la zona. */
async function requireAppAbierta(): Promise<UserContext> {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);
  if (leerEstadoSuscripcion(ctx.iglesia).situacion === 'bloqueada') {
    redirect('/suscripcion');
  }
  return ctx;
}

/**
 * La raíz de la zona: hace falta servir en algún equipo, liderándolo o no.
 *
 * `ministerioIds` y no `ministeriosQueLlevo`: el voluntario también tiene aquí
 * su sitio. Ya viene sin ministerios apagados ni bajas del equipo
 * (`getCurrentUserContext`).
 */
export async function requireMisEquipos(): Promise<UserContext> {
  const ctx = await requireAppAbierta();
  if (ctx.ministerioIds.length === 0) notFound();
  return ctx;
}

/**
 * La portada de un ministerio, en el modo que le toca a quien mira.
 *
 * Líder si puede gestionarlo —la misma puerta que sus herramientas—, y
 * participante si sirve en él sin poder gestionarlo. El pastor que no está en
 * el equipo entra como líder, igual que en el panel.
 */
export async function requireMiEquipo(ministerioId: string): Promise<{
  ctx: UserContext;
  ministerio: MinisterioDetalle;
  modo: ModoEnElEquipo;
}> {
  const ctx = await requireAppAbierta();
  if (!z.string().uuid().safeParse(ministerioId).success) notFound();

  const modo: ModoEnElEquipo | null = puedeGestionarMinisterio(ctx, ministerioId)
    ? 'lider'
    : ctx.ministerioIds.includes(ministerioId)
      ? 'participante'
      : null;
  if (!modo) notFound();

  // Acotado a la iglesia del contexto: un ministerio de otra congregación sale
  // como `null`, también para el pastor de la otra.
  const ministerio = await obtenerMinisterio(ctx, ministerioId);
  if (!ministerio) notFound();

  return { ctx, ministerio, modo };
}

/**
 * Las herramientas de un ministerio: solo para quien lo lleva.
 *
 * Sin `modulo` es la puerta del ministerio; con él, además la de esa
 * herramienta. Devuelve el ministerio ya cargado —con su equipo y sus módulos— porque todas
 * las pantallas lo necesitan para pintar, y la comprobación del módulo ya lo
 * había pedido.
 */
export async function requireMinisterioEnLaApp(
  ministerioId: string,
  modulo?: ModuloId,
): Promise<{ ctx: UserContext; ministerio: MinisterioDetalle }> {
  const ctx = await requireAppAbierta();

  // Antes que nada que toque la base: un id que no es uuid haría fallar el cast
  // en Postgres con un 500, y al pastor `puedeGestionarMinisterio` le deja pasar
  // con cualquier cadena.
  if (!z.string().uuid().safeParse(ministerioId).success) notFound();
  if (!puedeGestionarMinisterio(ctx, ministerioId)) notFound();

  // `obtenerMinisterio` acota a la iglesia del contexto: un ministerio de otra
  // congregación —una cuenta en dos iglesias, el pastor de una que es miembro
  // en la otra— sale como `null`. Es lo que en el panel hace
  // `esMinisterioDeSuIglesia`.
  const ministerio = await obtenerMinisterio(ctx, ministerioId);
  if (!ministerio) notFound();

  if (modulo) {
    if (!tieneModulo(ministerio.modulos, modulo)) notFound();
    const app = adaptadorDe(modulo);
    if (app?.visiblePara && !app.visiblePara(ctx)) notFound();
  }

  return { ctx, ministerio };
}
