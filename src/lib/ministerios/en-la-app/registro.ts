import 'server-only';

import type { ContextoPermisos } from '@/lib/auth/permisos';
import {
  modulosActivos,
  type ModuloId,
  type ModuloMinisterio,
} from '@/lib/ministerios/modulos';
import { agendaEnLaApp } from '@/lib/agenda/en-la-app';
import { repertorioEnLaApp } from '@/lib/repertorio/en-la-app';
import { seguimientoEnLaApp } from '@/lib/seguimiento/en-la-app';
import { turnosEnLaApp } from '@/lib/turnos/en-la-app';
import type { ModuloEnLaApp } from './contrato';

/**
 * Qué módulos saben pintarse en la app del líder.
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
 */
const ADAPTADORES: Partial<Record<ModuloId, ModuloEnLaApp>> = {
  agenda: agendaEnLaApp,
  turnos: turnosEnLaApp,
  repertorio: repertorioEnLaApp,
  seguimiento: seguimientoEnLaApp,
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
 */
export function modulosDeLaPortada(
  ctx: ContextoPermisos,
  modulosGuardados: unknown,
): ModuloEnLaPortada[] {
  return modulosActivos(modulosGuardados).flatMap((modulo) => {
    const app = ADAPTADORES[modulo.id] ?? null;
    if (app?.visiblePara && !app.visiblePara(ctx)) return [];
    return [{ modulo, app }];
  });
}

/** El adaptador de un módulo, para las guardas de sus pantallas. */
export function adaptadorDe(modulo: ModuloId): ModuloEnLaApp | null {
  return ADAPTADORES[modulo] ?? null;
}
