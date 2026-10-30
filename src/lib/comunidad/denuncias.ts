import type { MotivoDenuncia } from '@/lib/db/schema/enums';

/**
 * Los motivos de una denuncia, con la frase que ve quien denuncia y la corta
 * que ve quien modera.
 *
 * Fuera de `actions.ts` y de `moderacion.ts` porque los pide también la hoja del
 * muro, que es de cliente: un fichero `'use server'` solo exporta funciones
 * async, y uno `server-only` no se puede importar desde el navegador. Una sola
 * lista, para que la hoja y la pantalla del pastor no acaben hablando de cosas
 * distintas.
 */
export const MOTIVOS_DENUNCIA: {
  valor: MotivoDenuncia;
  /** Lo que se lee al elegir. */
  texto: string;
  /** Lo que se lee en la cola del moderador, junto al número. */
  corto: string;
}[] = [
  { valor: 'ofensivo', texto: 'Falta al respeto o es ofensiva', corto: 'Ofensiva' },
  { valor: 'spam', texto: 'Es publicidad o spam', corto: 'Publicidad o spam' },
  { valor: 'sin_permiso', texto: 'Sale alguien sin su permiso', corto: 'Alguien sin permiso' },
  { valor: 'privado', texto: 'Cuenta algo privado de otra persona', corto: 'Algo privado' },
  { valor: 'otro', texto: 'Otra cosa', corto: 'Otra cosa' },
];

export function motivoCorto(m: MotivoDenuncia): string {
  return MOTIVOS_DENUNCIA.find((x) => x.valor === m)?.corto ?? m;
}
