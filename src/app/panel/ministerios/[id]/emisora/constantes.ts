/**
 * Los textos de confirmación de la radio.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async: exportar una constante desde ahí rompe el build.
 */
export const CONFIRMACIONES: Record<string, string> = {
  guardado: 'Guardado. La congregación ya lo ve en la aplicación.',
  'guardado-sin-senal':
    'Guardado. El reproductor no aparecerá en la aplicación hasta que pongas la dirección de la señal.',
  'fuera-de-la-web':
    'Guardado. Como ha cambiado la señal, la radio ha dejado de salir en la web de la iglesia hasta que el pastor la vuelva a activar.',
};

/** Las filas vacías que se ofrecen de más para añadir programas. */
export const FILAS_DE_MAS = 3;
