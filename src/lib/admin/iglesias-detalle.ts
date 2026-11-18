import 'server-only';

// `dbAdmin`, como todo lo de `/admin`: el super admin mira TODAS las iglesias y
// no hay policy que deba dejar eso a un rol de aplicación. Lo único que separa
// esto de internet es `requireSuperAdmin()` en cada página que lo llama.
import { dbAdmin } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import {
  listarIglesias,
  situacionDe,
  type FilaIglesia,
} from '@/lib/admin/consultas';
import {
  leerEstadoSuscripcion,
  type EstadoSuscripcion,
} from '@/lib/suscripcion/estado';

/**
 * Las iglesias del listado, con lo que el rediseño de Inicio e Iglesias pide
 * además de lo de siempre (zona 4, 18-nov).
 *
 * POR QUÉ NO SE TOCA `listarIglesias`
 * -----------------------------------
 * La usan otras pantallas de `/admin` que se están rehaciendo a la vez, y sus
 * recuentos son los que valen. Aquí se reutiliza tal cual y se le suma una
 * consulta pequeña con las tres columnas que faltaban:
 *
 *   - `timezone`: las fechas de UNA iglesia —hasta cuándo tiene acceso— se
 *     escriben en su hora. Es su día el que se acaba, no el nuestro.
 *   - `logoUrl`: la inicial de la fila, o su logo si lo tiene.
 *   - `direccion`: el buscador busca también por ella.
 *
 * Ninguna es de un miembro: siguen saliendo solo recuentos.
 *
 * `estado` es el de `leerEstadoSuscripcion`, la misma función que decide el muro
 * de pago, para poder decir «le quedan 3 días» o «solo lectura hasta el 18» sin
 * volver a hacer la cuenta en otro sitio. `situacion` se recalcula con el MISMO
 * `ahora`: si no, una iglesia justo en el cambio de día podría salir «en prueba»
 * en la insignia y «vencida» en la frase de al lado.
 */
export type FilaIglesiaDetalle = FilaIglesia & {
  timezone: string;
  logoUrl: string | null;
  direccion: string | null;
  estado: EstadoSuscripcion;
};

/** El defecto de la columna `iglesias.timezone`. */
const ZONA_POR_DEFECTO = 'America/Bogota';

export async function listarIglesiasDetalle(
  ahora: Date = new Date(),
): Promise<FilaIglesiaDetalle[]> {
  const [filas, extra] = await Promise.all([
    listarIglesias(),
    dbAdmin
      .select({
        id: iglesias.id,
        timezone: iglesias.timezone,
        logoUrl: iglesias.logoUrl,
        direccion: iglesias.direccion,
      })
      .from(iglesias),
  ]);

  // Una iglesia dada de alta entre las dos consultas no estaría en `extra`: sale
  // con la zona por defecto y sin logo, que es como nace de todos modos.
  const porId = new Map(extra.map((e) => [e.id, e]));

  return filas.map((f) => {
    const e = porId.get(f.id);
    return {
      ...f,
      timezone: e?.timezone ?? ZONA_POR_DEFECTO,
      logoUrl: e?.logoUrl ?? null,
      direccion: e?.direccion ?? null,
      situacion: situacionDe(f, ahora),
      estado: leerEstadoSuscripcion(f, ahora),
    };
  });
}
