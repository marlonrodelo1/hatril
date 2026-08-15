import { sql } from 'drizzle-orm';
import { dbAdmin } from './client';

type Tx = Parameters<Parameters<typeof dbAdmin.transaction>[0]>[0];

/**
 * Ejecuta consultas Drizzle CON la RLS aplicada, en nombre de un usuario.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Drizzle se conecta como `postgres`, que tiene BYPASSRLS: las policies no le
 * afectan. Y el cliente de Supabase, que sí las respeta, no da consultas
 * tipadas. La regla del proyecto es «Drizzle en toda query», así que hace falta
 * que Drizzle entre por la puerta estrecha.
 *
 * CÓMO
 * ----
 * Dentro de una transacción se hacen dos cosas, en este orden:
 *
 *   1. `set_config('request.jwt.claims', …, true)` — el tercer argumento en
 *      `true` lo hace LOCAL a la transacción. De aquí lee `auth.uid()`, que es
 *      lo que preguntan todas las policies.
 *   2. `SET LOCAL ROLE authenticated` — cambia el rol efectivo. `authenticated`
 *      NO tiene BYPASSRLS, así que a partir de esta línea las policies mandan.
 *
 * El orden importa: primero el claim, luego el cambio de rol. Al revés, se
 * intentaría escribir la configuración ya con los privilegios recortados.
 *
 * Ambos son `LOCAL`, así que al terminar la transacción —por COMMIT o por
 * ROLLBACK— la conexión vuelve a su estado normal y puede reciclarse en el pool
 * sin arrastrar la identidad del usuario anterior. Esa fuga, si los `SET` no
 * fueran locales, serviría los datos de una iglesia a la siguiente petición.
 *
 * LO QUE ESTO NO ES
 * -----------------
 * No es autenticación. `authUserId` tiene que venir de una sesión ya validada
 * (`getCurrentUserContext()`), nunca de un parámetro que llegue del cliente.
 * Esta función confía en quien la llama; lo que aporta es que, aun confiando, el
 * usuario solo alcanza lo que sus policies permiten.
 */
export async function withUser<T>(
  authUserId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return dbAdmin.transaction(async (tx) => {
    const claims = JSON.stringify({
      sub: authUserId,
      role: 'authenticated',
    });

    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true)`,
    );
    await tx.execute(sql`set local role authenticated`);

    return fn(tx);
  });
}

/**
 * Igual que `withUser` pero como visitante sin sesión.
 *
 * Es la puerta del directorio público de iglesias y de la web pública de cada
 * congregación. Se pasa por `anon` en lugar de usar `dbAdmin` con un `WHERE
 * visible_en_directorio = true` porque así la barrera está en la base de datos:
 * aunque una consulta pública se escriba mal, `anon` solo tiene concedidas las
 * columnas del directorio y no puede ver `miembros` ni aunque lo pida.
 */
export async function withAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return dbAdmin.transaction(async (tx) => {
    await tx.execute(sql`set local role anon`);
    return fn(tx);
  });
}
