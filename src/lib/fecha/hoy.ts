/**
 * Qué día es HOY en la iglesia, como `YYYY-MM-DD`.
 *
 * POR QUÉ NO VALE `new Date().toISOString().slice(0, 10)`
 * -------------------------------------------------------
 * Eso da el día en UTC. El servidor está en Europa y las primeras
 * congregaciones en Bogotá, siete horas por detrás: entre las 17:00 y la
 * medianoche de Colombia, UTC ya está en el día siguiente. El devocional del
 * domingo desaparecería de la web el domingo por la tarde, que es justo cuando
 * más gente lo abre.
 *
 * Por eso cada iglesia guarda su `timezone` desde el primer día. Aquí es donde
 * sirve.
 *
 * `en-CA` no es un capricho: es el único locale corriente cuyo formato de fecha
 * corto ya es `YYYY-MM-DD`, que es como se comparan las columnas `date` de
 * Postgres. Montarlo a mano con `getFullYear` obligaría a rellenar ceros y a
 * volver a pelearse con la zona.
 */
export function hoyEnLaIglesia(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * El primer y el último día del mes en curso EN LA IGLESIA, como `YYYY-MM-DD`.
 *
 * POR QUÉ NO SE HACE EN SQL
 * -------------------------
 * La tentación es `date_trunc('month', now())`. Se evalúa en UTC, así que para
 * Bogotá el mes empezaría a las 19:00 del día 30 del mes anterior: cinco horas
 * de movimientos del mes pasado contados en el nuevo.
 *
 * En «3 personas se han sumado este mes» eso es cosmético. En un libro de caja
 * es un error contable, y de los que solo se descubren cuando el total del mes
 * no cuadra con lo que el tesorero apuntó en su cuaderno — momento en el que ya
 * no se fía del producto.
 *
 * Los límites se calculan aquí y se pasan como cadenas a un `between` sobre la
 * columna `date`, que no tiene zona horaria y por tanto no puede desplazarse.
 */
export function mesEnLaIglesia(
  timezone: string,
  /** `YYYY-MM` para pedir otro mes. Por defecto, el que corre ahora allí. */
  mes?: string,
): { desde: string; hasta: string; etiqueta: string } {
  const referencia = mes ?? hoyEnLaIglesia(timezone).slice(0, 7);
  const [anio, m] = referencia.split('-').map(Number);

  // Día 0 del mes siguiente es el último del actual, y `Date.UTC` lo calcula
  // sin tocar husos porque solo se usan los números, nunca el instante.
  const ultimoDia = new Date(Date.UTC(anio!, m!, 0)).getUTCDate();
  const dd = String(ultimoDia).padStart(2, '0');
  const mm = String(m).padStart(2, '0');

  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${anio}-${mm}-${dd}`,
    etiqueta: new Date(anio!, m! - 1, 1).toLocaleDateString('es', {
      month: 'long',
      year: 'numeric',
    }),
  };
}

/** «jueves, 21 de agosto», para enseñar una fecha guardada. */
export function formatearFechaLarga(fecha: string): string {
  // Se parte a mano en vez de `new Date(fecha)`: esa cadena la interpreta
  // JavaScript como medianoche UTC, y al pintarla en un huso por detrás sale el
  // día anterior. Con los tres números no hay conversión que valga.
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a!, m! - 1, d!).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
