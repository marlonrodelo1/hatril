import 'server-only';

import type { ContextoPermisos } from '@/lib/auth/permisos';
import {
  modulosActivos,
  type ModuloId,
  type ModuloMinisterio,
} from '@/lib/ministerios/modulos';
import { agendaEnLaApp } from '@/lib/agenda/en-la-app';
import { repartoEnLaApp } from '@/lib/reparto/en-la-app';
import { repertorioEnLaApp } from '@/lib/repertorio/en-la-app';
import { seguimientoEnLaApp } from '@/lib/seguimiento/en-la-app';
import { turnosEnLaApp } from '@/lib/turnos/en-la-app';
import type { ModoEnElEquipo, ModuloEnLaApp } from './contrato';

/**
 * Qué módulos saben pintarse en la zona de equipos de la app.
 *
 * PARA ENGANCHAR UN MÓDULO NUEVO, UNA LÍNEA
 * -----------------------------------------
 * Su adaptador vive en su carpeta (`lib/reparto/en-la-app.ts`), cumple
 * `ModuloEnLaApp`, y se apunta aquí. Nada más: la portada lo recoge sola a
 * través de `modulosActivos()`. El ejemplo entero está en
 * `docs/modulos/estado-app-lider.md`.
 *
 * `Partial` a propósito. Un módulo del catálogo sin adaptador no desaparece de
 * la portada: sale con la tarjeta de respaldo, que lleva a su pantalla del
 * panel (ver `TarjetaModulo` en `app/mi/equipo/_components`). Así un módulo
 * que se fusiona antes de tener su versión de app funciona desde el primer día,
 * y el pastor no enciende algo que luego el líder no encuentra.
 *
 * OJO con eso: la tarjeta de respaldo usa la puerta ancha,
 * `puedeGestionarMinisterio`. Un módulo cuya guarda del panel sea más estrecha
 * —como el reparto, `puedeGestionarDesdeDentro`— tiene que traer su adaptador
 * con su `visiblePara` en la misma fusión, o la tarjeta le saldrá a quien el
 * panel rebota.
 */
const ADAPTADORES: Partial<Record<ModuloId, ModuloEnLaApp>> = {
  agenda: agendaEnLaApp,
  turnos: turnosEnLaApp,
  repertorio: repertorioEnLaApp,
  seguimiento: seguimientoEnLaApp,
  reparto: repartoEnLaApp,
};

export type ModuloEnLaPortada = {
  modulo: ModuloMinisterio;
  /** `null` si el módulo todavía no tiene adaptador: se pinta el de respaldo. */
  app: ModuloEnLaApp | null;
};

/**
 * Las tarjetas de la portada de un ministerio, en el orden del catálogo.
 *
 * Solo las encendidas, y de esas solo las que esta persona puede abrir: la
 * misma regla que `PestanasMinisterio` en el panel. Una tarjeta que lleva a una
 * pantalla que rebota es peor que no tenerla.
 *
 * Para quien participa, solo los módulos que declaran `participante`, y sin
 * tarjeta de respaldo: el respaldo lleva al panel, y a un voluntario el panel
 * le rebota. Un módulo que no dice qué ve el equipo no le enseña nada.
 */
export function modulosDeLaPortada(
  ctx: ContextoPermisos,
  modulosGuardados: unknown,
  modo: ModoEnElEquipo,
  ministerioId: string,
): ModuloEnLaPortada[] {
  return modulosActivos(modulosGuardados).flatMap((modulo) => {
    const app = ADAPTADORES[modulo.id] ?? null;
    if (modo === 'participante') return app?.participante ? [{ modulo, app }] : [];
    if (app?.visiblePara && !app.visiblePara(ctx, ministerioId)) return [];
    return [{ modulo, app }];
  });
}

/** El adaptador de un módulo, para las guardas de sus pantallas. */
export function adaptadorDe(modulo: ModuloId): ModuloEnLaApp | null {
  return ADAPTADORES[modulo] ?? null;
}
