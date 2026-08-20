import type { Moneda } from '@/lib/db/schema';

/**
 * Cómo se escribe un importe en la moneda de cada iglesia.
 *
 * Sustituye a `precio.ts`, que venía de Gonper con `es-ES` y `EUR` cableados y
 * con el `precio_modo` de los servicios de peluquería. No lo importaba nadie.
 *
 * LOS IMPORTES LLEGAN COMO CADENA
 * -------------------------------
 * `numeric` de Postgres sale de postgres-js como `string`, y se deja así a
 * propósito: convertirlo a `number` para pintarlo invita a sumarlo, y sumar
 * dinero en coma flotante es cómo aparecen los descuadres de un céntimo que
 * nadie sabe explicar. Los totales se hacen con `sum()` en SQL.
 *
 * `Intl.NumberFormat` acepta cadena desde ES2023 y la formatea con precisión
 * arbitraria, así que no hay que convertir nada.
 */

/** Cómo se llama la moneda de la iglesia y cómo se escriben sus cantidades. */
const LOCALES: Record<Moneda, string> = {
  COP: 'es-CO',
  EUR: 'es-ES',
  USD: 'en-US',
};

/**
 * En Colombia no hay céntimos en circulación: un importe con dos decimales en
 * pesos es ruido en pantalla. En euros y dólares sí se enseñan.
 */
const DECIMALES: Record<Moneda, number> = {
  COP: 0,
  EUR: 2,
  USD: 2,
};

/**
 * «$ 250.000», «1.234,56 €».
 *
 * `useGrouping: 'always'` es obligatorio y no cosmético: `es-ES` NO agrupa por
 * debajo de 10.000 («8500 €») mientras que `es-CO` sí, así que sin forzarlo una
 * misma columna de importes mezcla dos estilos y se lee fatal.
 */
export function formatearDinero(
  importe: string | number | null | undefined,
  moneda: Moneda,
): string {
  if (importe === null || importe === undefined || importe === '') return '—';

  const decimales = DECIMALES[moneda];

  return new Intl.NumberFormat(LOCALES[moneda], {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: 'always',
  }).format(importe as number);
}

/**
 * Igual pero con el signo delante siempre: «+$ 250.000», «−$ 100.000».
 *
 * Para el libro, donde la columna de importes mezcla entradas y salidas y el
 * color por sí solo no vale — la regla del sistema de diseño es que un dato no
 * se distingue únicamente por color.
 *
 * El menos es U+2212 (−), no el guion del teclado: en una columna de cifras
 * alineadas el guion se lee como un separador y queda medio píxel más alto.
 */
export function formatearDineroConSigno(
  importe: string | number | null | undefined,
  moneda: Moneda,
): string {
  if (importe === null || importe === undefined || importe === '') return '—';

  const negativo = String(importe).trim().startsWith('-');
  const absoluto = String(importe).replace(/^-/, '');

  return `${negativo ? '−' : '+'}${formatearDinero(absoluto, moneda)}`;
}

/**
 * El importe tal y como debe volver a un campo de formulario al editar.
 *
 * `numeric(14,2)` siempre devuelve `250000.00`, y en Colombia eso no es lo que
 * el tesorero escribió ni lo que espera ver: los céntimos no existen allí. Sin
 * esto, abrir un movimiento para corregir una letra del concepto enseña un
 * importe que parece otro número.
 *
 * Sin separadores de miles a propósito. Los toleraría `parsearDinero()` al
 * reenviar, pero un campo de entrada con puntos ya puestos invita a pelearse
 * con el cursor al corregir una cifra.
 */
export function importeParaEditar(
  importe: string | null | undefined,
  moneda: Moneda,
): string {
  if (!importe) return '';
  return DECIMALES[moneda] === 0 ? importe.replace(/\.00$/, '') : importe;
}

/**
 * De lo que el tesorero teclea a lo que acepta `numeric`.
 *
 * Un tesorero colombiano escribe «250.000» y uno español «250,00». Los dos son
 * válidos y significan cosas distintas: en `es-CO` el punto agrupa y en `es-ES`
 * la coma decide los céntimos. Sin normalizar, «250.000» llegaría a Postgres
 * como doscientos cincuenta con tres decimales.
 *
 * La regla que resuelve los dos casos: el ÚLTIMO separador es el decimal solo si
 * le siguen una o dos cifras y no hay otro separador del mismo tipo detrás.
 * Todo lo demás agrupa y se tira.
 *
 * Devuelve null si no hay un número reconocible, para que la validación de Zod
 * lo rechace con un mensaje y no se cuele un `NaN` en la base.
 */
export function parsearDinero(entrada: string): string | null {
  const limpio = entrada.trim().replace(/[^\d.,-]/g, '');
  if (!limpio) return null;

  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  const corte = Math.max(ultimoPunto, ultimaComa);

  let entero = limpio;
  let decimal = '';

  if (corte !== -1) {
    const cola = limpio.slice(corte + 1);
    // Uno o dos dígitos detrás del último separador: son céntimos. Tres o más
    // —«250.000»— es una agrupación de miles.
    if (/^\d{1,2}$/.test(cola)) {
      entero = limpio.slice(0, corte);
      decimal = cola;
    }
  }

  entero = entero.replace(/[.,]/g, '');
  if (!/^-?\d+$/.test(entero)) return null;

  return decimal ? `${entero}.${decimal}` : entero;
}
