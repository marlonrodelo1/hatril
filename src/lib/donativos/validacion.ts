import { z } from 'zod';

import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import { MAXIMO_LINEA, MAX_LINEAS, MINIMO_LINEA, TIPOS_DONATIVO } from './calculo';

/**
 * El formulario de la página de dar.
 *
 * Las líneas viajan como JSON en un campo oculto (`lineas`): son una lista de
 * longitud variable, y repetir `name="tipo"` tres veces obligaría a casar los
 * campos por posición, que es justo lo que se descuadra cuando alguien quita la
 * línea del medio. El importe viaja como texto («25,5») y se normaliza aquí.
 */

const importe = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(v.trim().replace(',', '.'))))
  .pipe(
    z
      .number({ error: 'Escribe la cantidad con números.' })
      .finite('Escribe la cantidad con números.')
      .min(MINIMO_LINEA, `Cada línea, como mínimo ${MINIMO_LINEA} €.`)
      .max(MAXIMO_LINEA, `Cada línea, como mucho ${MAXIMO_LINEA.toLocaleString('es-ES')} €.`)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Como mucho, dos decimales.'),
  );

export const lineaDonativoSchema = z.object({
  tipo: z.enum(TIPOS_DONATIVO, { error: 'Elige diezmo u ofrenda.' }),
  fondoId: z.uuid('Elige para qué es.'),
  importe,
});

export const donativoSchema = z.object({
  periodicidad: z.enum(['una', 'mensual'], { error: 'Elige una vez o cada mes.' }),
  lineas: z
    .array(lineaDonativoSchema)
    .min(1, 'Añade al menos una línea.')
    .max(MAX_LINEAS, `Como mucho ${MAX_LINEAS} líneas en un pago.`),
  cubrir: z.boolean(),
  nombre: z.string().trim().min(1, 'Escribe tu nombre.').max(120, 'El nombre es demasiado largo.'),
  email: z.email('Revisa el correo: ahí llega el recibo.').max(200),
});

export type DatosDonativo = z.infer<typeof donativoSchema>;

/** Del FormData al objeto que valida `donativoSchema`. Nunca `formData.get()` directo. */
export function leerFormularioDonativo(formData: FormData) {
  let lineas: unknown = [];
  try {
    lineas = JSON.parse(campo(formData, 'lineas') ?? '[]');
  } catch {
    lineas = [];
  }
  return donativoSchema.safeParse({
    periodicidad: campo(formData, 'periodicidad') ?? 'una',
    lineas,
    cubrir: casilla(formData, 'cubrir'),
    nombre: campoObligatorio(formData, 'nombre'),
    email: campoObligatorio(formData, 'email').toLowerCase(),
  });
}
