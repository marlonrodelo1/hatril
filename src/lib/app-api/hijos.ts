/**
 * Contrato de «Mis hijos» en la app (`/api/v1/app/mi/hijos*`): lo que ve una
 * familia de sus hijos en el ministerio de Niños. Ver `src/lib/app-api/yo.ts`
 * para las reglas (un endpoint publicado solo crece).
 *
 * Los tipos salen de `lib/ninos/familia.ts`, que es lo que pintan las vistas
 * compartidas (`src/app/mi/hijos/_components`).
 */
import type { DatosDeMisHijos, PublicacionParaFamilia } from '@/lib/ninos/familia';

export type RespuestaHijos = DatosDeMisHijos;

/** Con URL firmadas de diez minutos: la app no las guarda más que en memoria. */
export type RespuestaTablonHijos = { publicaciones: PublicacionParaFamilia[] };
