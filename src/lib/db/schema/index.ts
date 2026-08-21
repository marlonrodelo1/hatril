/**
 * Schema de Hatril, partido por dominio.
 *
 * Gonper tiene sus 40 tablas en un solo `schema.ts` de 1.962 líneas y ya cuesta
 * encontrar nada. Aquí cada fichero es un área del negocio y este índice es el
 * único punto de importación: `import { miembros } from '@/lib/db/schema'`.
 *
 * Orden de dependencia (importa para las migraciones): enums → iglesias →
 * miembros → ministerios → asistencia → seguimiento → comunidad →
 * notificaciones → finanzas → eventos → rgpd.
 * `plataforma` no depende de nada.
 *
 * `asistencia` va detrás de `ministerios` y no antes: `reuniones` apunta a un
 * ministerio cuando es un ensayo, y a nada cuando es el culto del domingo.
 */

export * from './enums';
export * from './iglesias';
export * from './miembros';
export * from './ministerios';
export * from './asistencia';
export * from './seguimiento';
export * from './comunidad';
export * from './notificaciones';
export * from './finanzas';
export * from './eventos';
export * from './rgpd';
export * from './plataforma';
