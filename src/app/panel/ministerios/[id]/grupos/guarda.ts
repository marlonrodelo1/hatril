import 'server-only';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';

/**
 * Las puertas de los grupos en el panel, para el layout Y para cada página.
 *
 * `requireModuloMinisterio` con `desdeDentro`, como el reparto: el pastor, o el
 * responsable y los colíderes de ESTA red. Sin `gestionar_ministerios`: la RLS
 * de la `0047` es por relación y a quien organiza los ministerios desde
 * secretaría no le enseña ninguna célula; abrirle la pantalla sería darle una
 * lista vacía. Y el módulo encendido: apagado, la ruta no existe.
 *
 * En cada página y no solo en el layout: en Next 16 un layout no impide que la
 * página se ejecute (CLAUDE.md).
 */
export function requireGrupos(id: string) {
  return requireModuloMinisterio(id, 'grupos', { desdeDentro: true });
}
