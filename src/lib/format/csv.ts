/**
 * Celdas de CSV, escapadas y desactivadas como fórmula.
 *
 * ESTABA EN `finanzas/exportar/route.ts` Y SALE AQUÍ POR UN MOTIVO
 * ----------------------------------------------------------------
 * La versión de allí hacía bien el escapado de RFC 4180 y NO neutralizaba las
 * fórmulas. En finanzas el riesgo era pequeño: el concepto lo escribe el propio
 * tesorero, así que para atacarse necesitaba escribirse él la trampa.
 *
 * Con los eventos deja de serlo. El nombre y la nota de una inscripción vienen
 * de un formulario público, sin cuenta, desde internet, y el CSV está pensado
 * justamente para reenviarse: al contador, al que organiza el retiro, al que
 * lleva la lista en la puerta.
 *
 * QUÉ HACE EL PREFIJO
 * -------------------
 * Excel, LibreOffice y Google Sheets interpretan como FÓRMULA cualquier celda
 * que empiece por `=`, `+`, `-`, `@`, tabulador o retorno de carro. Un nombre
 * como `=HYPERLINK("https://sitio.malo","Pincha")` se convierte en un enlace
 * pulsable dentro de la hoja de la iglesia, y hay familias de fórmulas que
 * llegan a sacar datos de la hoja hacia fuera.
 *
 * El apóstrofo delante le dice a la hoja de cálculo «esto es texto», no se ve al
 * abrirlo y no cambia el valor. Es la mitigación que recomienda OWASP.
 *
 * OJO CON LOS NÚMEROS NEGATIVOS
 * -----------------------------
 * `-250000` empieza por `-`, así que pasar un importe por aquí lo convertiría en
 * texto y el contador dejaría de poder sumar la columna, que es literalmente
 * para lo que quiere el fichero. Por eso los importes NO pasan por esta función
 * en ningún sitio: se escriben directos, como ya hacía finanzas. Si alguien
 * añade una columna numérica, que la deje fuera.
 */

const PELIGROSOS = /^[=+\-@\t\r]/;

export function celda(valor: string | null | undefined): string {
  let s = String(valor ?? '');

  if (PELIGROSOS.test(s)) s = `'${s}`;

  // RFC 4180: las comillas se doblan, y el campo se envuelve si lleva
  // separador, comillas o salto de línea. Sin esto, un concepto con un punto y
  // coma parte la fila en dos y desplaza todas las columnas siguientes.
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * El fichero entero, ya con el BOM y el `sep=;`.
 *
 * DOS COSAS QUE COSTARON UN RATO
 * ------------------------------
 * `sep=;` en la primera línea, porque Excel en español espera punto y coma; con
 * coma mete la fila entera en una sola columna.
 *
 * Y el BOM va como `﻿`, ESCAPADO y no como carácter literal: un BOM
 * literal es invisible en el editor y cualquiera lo borra sin darse cuenta al
 * tocar la línea. El fallo no aparece hasta que alguien abre el CSV y lee
 * «Ofrenda del dÃ­a». Al comprobarlo, ojo: `fetch().text()` ELIMINA el BOM al
 * decodificar, así que parece que falta cuando está. Hay que mirar los bytes.
 */
export function ficheroCsv(lineas: string[]): string {
  return `﻿${['sep=;', ...lineas].join('\r\n')}`;
}
