/**
 * Devuelve un string en español tipo "Hace X días/semanas/meses/años".
 * Para fechas en el futuro o muy recientes, devuelve "Hoy".
 */
export function tiempoRelativo(fecha: Date | string): string {
  const ahora = new Date();
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha;

  if (Number.isNaN(f.getTime())) return '';

  const diffMs = ahora.getTime() - f.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 1) return 'Hoy';
  if (diffDias === 1) return 'Hace 1 día';
  if (diffDias < 7) return `Hace ${diffDias} días`;

  const diffSemanas = Math.floor(diffDias / 7);
  if (diffSemanas === 1) return 'Hace 1 semana';
  if (diffSemanas < 5) return `Hace ${diffSemanas} semanas`;

  const diffMeses = Math.floor(diffDias / 30);
  if (diffMeses === 1) return 'Hace 1 mes';
  if (diffMeses < 12) return `Hace ${diffMeses} meses`;

  const diffAnos = Math.floor(diffDias / 365);
  if (diffAnos === 1) return 'Hace 1 año';
  return `Hace ${diffAnos} años`;
}
