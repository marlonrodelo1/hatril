import { requirePermisoApi } from '@/lib/auth/guard-api';
import { libro } from '@/lib/finanzas/consultas';
import { mesEnLaIglesia } from '@/lib/fecha/hoy';
import { celda } from '@/lib/format/csv';

/**
 * El libro en CSV, para el contador.
 *
 * «Puedo sacar mis datos cuando quiera» es la objeción número uno de quien deja
 * un cuaderno, así que esto va con el libro y no en una fase posterior.
 *
 * CSV ESCRITO A MANO, CERO DEPENDENCIAS
 * -------------------------------------
 * Media hora de código contra una dependencia nueva en `package.json` y en la
 * imagen de Docker. XLSX y PDF llegarán cuando alguien los pida de verdad.
 *
 * LOS DOS DETALLES SUCIOS DE EXCEL EN ESPAÑOL
 * -------------------------------------------
 *   1. `sep=;` en la primera línea. Excel en español espera punto y coma como
 *      separador de columnas, porque la coma ya es el separador decimal. Con
 *      comas, el fichero entero aterriza en una sola columna.
 *   2. BOM UTF-8 al principio. Sin él, Excel abre el CSV en la codificación del
 *      sistema y «Ofrenda del día» sale como «OfrendaÂ delÂ dÃ­a».
 *
 * Y los importes van con COMA decimal y sin separador de miles, que es lo que
 * Excel en español reconoce como número. Con punto los toma por texto y el
 * contador no puede sumar la columna, que es literalmente para lo que la quiere.
 */

const CABECERA = [
  'Fecha',
  'Tipo',
  'Concepto',
  'Fondo',
  'Caja',
  'Metodo de pago',
  'Tipo de ingreso',
  'Importe',
] as const;

/*
 * `celda()` vivía aquí. Se fue a `src/lib/format/csv.ts` cuando los eventos
 * estrenaron su propio CSV, y de paso se le añadió la neutralización de
 * fórmulas que le faltaba: hacía el escapado de RFC 4180 y dejaba pasar un
 * valor que empezara por `=`, que la hoja de cálculo interpreta como fórmula.
 *
 * Aquí el riesgo era menor —el concepto lo escribe el propio tesorero—, pero el
 * arreglo es el mismo y no cuesta nada. El importe sigue SIN pasar por `celda()`
 * a propósito: empieza por `-` cuando es un gasto, y prefijarlo lo convertiría
 * en texto que el contador ya no podría sumar.
 */

export async function GET(request: Request): Promise<Response> {
  const guard = await requirePermisoApi('gestionar_finanzas');
  if (!guard.ok) return guard.respuesta;

  const { ctx } = guard;
  const url = new URL(request.url);

  const mes = mesEnLaIglesia(ctx.iglesia.timezone);
  const desde = url.searchParams.get('desde') ?? mes.desde;
  const hasta = url.searchParams.get('hasta') ?? mes.hasta;
  const fondo = url.searchParams.get('fondo') ?? undefined;

  // Sin límite bajo: el punto de esto es llevarse el periodo entero. Un año de
  // una iglesia mediana son unos centenares de filas.
  const filas = await libro(ctx, { desde, hasta, fondoId: fondo }, 10_000);

  const lineas = [
    'sep=;',
    CABECERA.join(';'),
    ...filas.map((m) =>
      [
        m.fecha,
        m.tipo === 'ingreso' ? 'Entra' : 'Sale',
        celda(m.concepto),
        celda(m.fondoNombre),
        celda(m.cajaNombre),
        m.metodoPago,
        m.tipoIngreso ?? '',
        // Coma decimal para Excel en español. `importeConSigno` ya trae el signo.
        m.importeConSigno.replace('.', ','),
      ].join(';'),
    ),
    '',
    // El aviso viaja DENTRO del fichero. Puesto solo en la pantalla, se queda en
    // la pantalla: quien reenvía el CSV a su contador ya no lo está viendo.
    celda(
      'Aviso: los conceptos son texto libre y pueden contener nombres de personas. Si entregas este fichero a tu contador, esa persona trata datos de tu congregacion por encargo tuyo.',
    ),
  ];

  const nombre = `movimientos-${desde}-a-${hasta}.csv`;

  // `\uFEFF` escrito como escape y NO como caracter literal: un BOM literal
  // es invisible en el editor, cualquiera lo borra sin darse cuenta al tocar la
  // linea, y el fallo no aparece hasta que un tesorero abre el CSV y ve
  // «OfrendaÂ delÂ dÃ­a».
  return new Response(`\uFEFF${lineas.join('\r\n')}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nombre}"`,
      // Un fichero con las cuentas de una congregación no se queda en ninguna
      // caché intermedia ni lo indexa nadie.
      'cache-control': 'no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
