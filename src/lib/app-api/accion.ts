/**
 * Contrato de `POST /api/v1/app/accion`: ejecutar una server action de la web
 * desde la app (`src/lib/api/acciones-app.ts`).
 *
 * El cuerpo va como `multipart/form-data`, porque hay actions que suben fotos:
 *
 *   - `__id`:   `modulo#nombre`, por ejemplo `mi/comunidad#publicar`.
 *   - `__args`: los argumentos en JSON. Un `FormData` va como `{"__fd": n}`, y
 *               sus campos, aparte, como `__fd<n>:<campo>`.
 *
 * La respuesta dice lo que hizo la action: devolver algo (`valor`) o
 * redirigir (`redirigir`, la ruta a la que la web habría mandado). La app
 * navega ahí: los errores de las actions viajan como `?error=` en esa ruta,
 * igual que en la web.
 */
export type RespuestaAccion = { valor: unknown } | { redirigir: string };

export const CAMPO_ID = '__id';
export const CAMPO_ARGS = '__args';
export const PREFIJO_FORM = '__fd';

/** El nombre de un campo del `FormData` número `n` dentro del cuerpo. */
export function campoDeForm(n: number, campo: string): string {
  return `${PREFIJO_FORM}${n}:${campo}`;
}
