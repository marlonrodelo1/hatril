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
