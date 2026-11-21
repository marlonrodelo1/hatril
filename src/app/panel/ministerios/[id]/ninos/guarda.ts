import 'server-only';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';
import { esPastor, type ContextoPermisos } from '@/lib/auth/permisos';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';

/**
 * La puerta del tablón de familias, para el layout Y para cada página.
 *
 * La del reparto (`reparto/guarda.ts`), con el mismo porqué: un layout no
 * impide que la página corra ni que su resultado viaje en el payload RSC
 * (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`).
 *
 * `desdeDentro`: el pastor, o la responsable y los colíderes (los maestros) de
 * ESTE ministerio. Sin `gestionar_ministerios`: la RLS de la `0060` no le
 * enseña nada de los niños a quien no está en el equipo, y abrirle la pantalla
 * sería darle listas vacías y botones que fallan.
 */
export async function requireNinos(id: string) {
  return requireModuloMinisterio(id, 'ninos', { desdeDentro: true });
}

/**
 * ¿Acepta familias? La responsable y el pastor; los maestros (colíderes), no.
 *
 * Es la puerta que deja ver a todos los niños, y la decisión 3 del plan. Tiene
 * que decir lo mismo que `aceptar_solicitud_nino()` y las policies de la
 * `0060`: esto solo decide qué se PINTA; lo que se puede hacer lo decide la
 * base, y a un colíder que mande el formulario a mano le devuelve HT144.
 */
export function aceptaFamilias(ctx: ContextoPermisos, ministerio: MinisterioDetalle): boolean {
  if (esPastor(ctx)) return true;
  return ministerio.equipo.some(
    (i) => i.miembroId === ctx.miembroId && i.rolEquipo === 'responsable',
  );
}
