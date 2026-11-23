import 'server-only';

import { cache } from 'react';

// `dbAdmin`, como todo `/admin`: lo que se cuenta son TODAS las iglesias, y no
// hay policy que deba dejar eso a un rol de aplicación. Lo que lo protege es la
// guarda de abajo, no la RLS.
import { dbAdmin } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { situacionDe, type Situacion } from '@/lib/admin/consultas';

/**
 * Si una iglesia sale en «Necesitan algo de ti» (antes «Requieren atención»)
 * del inicio de `/admin`.
 *
 * Es el MISMO criterio que filtra esa lista: pruebas que acaban esta semana,
 * vencidas y bloqueadas, y no las suspendidas, porque las suspendió alguien de
 * aquí a propósito y en pendientes estarían para siempre. Hoy está escrito dos
 * veces —aquí y en `necesitaAtencion` de `inicio-necesitan.tsx`— porque las dos
 * piezas se hicieron a la vez; recibe `{ situacion }` justo para que el inicio
 * pueda hacer `filter(requiereAtencion)` con sus filas y quedarse en una. Si
 * cambia en un sitio y no en el otro, el número del menú y la lista dejarán de
 * contar lo mismo.
 */
export function requiereAtencion({ situacion }: { situacion: Situacion }): boolean {
  return (
    situacion.grupo !== 'suspendidas' &&
    (situacion.tono === 'aviso' || situacion.tono === 'peligro')
  );
}

/**
 * Cuántas iglesias piden atención hoy: el número junto a «Inicio» en el menú.
 *
 * Una sola consulta de tres columnas, y no `listarIglesias()`: esa trae además
 * los recuentos de personas y de cuentas de cada iglesia, que aquí no hacen
 * falta y que el layout pagaría en cada carga de `/admin`. La situación sale de
 * `situacionDe`, la misma función que usa el inicio y que decide el muro de
 * pago: calcularla en SQL obligaría a copiar esa lógica en otro idioma.
 *
 * Solo un número: ningún nombre de iglesia ni, por supuesto, de persona.
 *
 * La guarda va dentro aunque el layout ya la haya pedido. Con `cache()` no
 * cuesta nada, y así esta función no puede contar nada para nadie aunque
 * mañana alguien la llame desde otro sitio.
 */
export const contarPendientes = cache(async (): Promise<number> => {
  await requireSuperAdmin();

  const filas = await dbAdmin
    .select({
      activa: iglesias.activa,
      plan: iglesias.plan,
      trialUntil: iglesias.trialUntil,
    })
    .from(iglesias);

  const ahora = new Date();
  return filas.filter((f) =>
    requiereAtencion({ situacion: situacionDe(f, ahora) }),
  ).length;
});
