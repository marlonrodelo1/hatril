import 'server-only';

import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { puedeVerFondoDe } from '@/lib/auth/permisos';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';

/**
 * Las tres puertas de la pestaña «Fondo», para la página (y el layout, si lo
 * hubiera: aquí no hace falta, es una sola página).
 *
 *   1. `requireGestionMinisterio(id, { desdeDentro: true })`: el pastor, o el
 *      responsable y los colíderes de ESTE equipo. Sin el camino de
 *      `gestionar_ministerios`, que es organizar equipos desde secretaría.
 *   2. Finanzas encendida en la iglesia.
 *   3. Un fondo vivo vinculado a este ministerio. Lo vincula el pastor desde
 *      Fondos y cajas; sin él, la pestaña no existe.
 *
 * Las dos últimas dan 404 y no un rebote: a quien llega aquí no le falta un
 * permiso —lleva el equipo—, es que para este ministerio la pantalla no
 * existe. Es lo mismo que hace una herramienta apagada.
 *
 * En la página, y no en un layout: en Next 16 un layout no impide que la
 * página se ejecute (CLAUDE.md).
 */
export async function requireFondo(id: string) {
  const ctx = await requireGestionMinisterio(id, { desdeDentro: true });
  if (!puedeVerFondoDe(ctx, id)) notFound();
  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio || !ministerio.conFondo) notFound();
  return { ctx, ministerio };
}
