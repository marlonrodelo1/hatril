import 'server-only';

import { notFound, redirect } from 'next/navigation';
// Las dos funciones con que Next lee su propio `redirect()`. No salen por
// `next/navigation`, pero son las que usa él mismo para decidir a dónde
// navegar, así que el formato del `digest` no puede separarse de ellas. Si un
// día cambian de sitio, el build falla en esta línea: mejor eso que un
// `digest` partido a mano que deje de coincidir en silencio.
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { puedeGestionarMinisterio } from '@/lib/auth/permisos';
import { withUser } from '@/lib/db';
import { ministerios } from '@/lib/db/schema';
import { tieneModulo, type ModuloId } from '@/lib/ministerios/modulos';
import { exigirPoderEscribir } from '@/lib/suscripcion/muro';
import { rutaApp, traducirAlApp } from './rutas';

/**
 * Ejecuta una server action del panel desde la app, y la deja en la app.
 *
 * POR QUÉ ENVOLVER Y NO COPIAR NI TOCAR
 * -------------------------------------
 * Las actions de turnos, agenda, repertorio y seguimiento ya hacen todo lo
 * difícil: las guardas, el tercer cinturón (que el turno sea de ESE ministerio),
 * el permiso de asistencia, los avisos. Copiarlas aquí serían dos sitios donde
 * arreglar el mismo agujero. Y darles un parámetro de destino obligaba a
 * tocarlas, cuando la tanda 1 les está metiendo `exigirModulo()` en main y
 * alabanza y consolidación trabajan sobre ellas en sus ramas.
 *
 * Así que no se tocan. Cada una acaba en un `redirect()` a su pantalla del
 * panel, y como la app tiene las mismas rutas con otro prefijo (`rutas.ts`),
 * basta con atrapar ese `redirect`, cambiarle el prefijo y lanzarlo de nuevo.
 * El mensaje viaja intacto: `?guardado=asignado`, `?error=…`.
 *
 * LO QUE SE COMPRUEBA ANTES, Y POR QUÉ NO SOBRA
 * ---------------------------------------------
 *   - El muro de suscripción con el destino de AQUÍ. La action del panel lo
 *     vuelve a mirar, pero su destino de error es `/panel/ministerios`, que
 *     traducido deja a la persona en la raíz de la zona y no en la pantalla
 *     desde la que pulsó. En `solo_lectura`, que es cuando más se pulsa sin
 *     saberlo, el aviso tiene que salir donde está.
 *   - Que lleve el ministerio. Lo vuelve a mirar la action; aquí va primero
 *     para no consultar nada sobre un ministerio ajeno.
 *   - Que el módulo esté encendido. En esta rama las actions del panel no lo
 *     comprueban —solo su layout, que no corre en una action—. Cuando se fusione
 *     la tanda 1, cada una lleva su `exigirModulo()` y esto pasa a ser
 *     redundante: se puede cambiar por esa misma llamada.
 *
 * Y LO QUE NO
 * -----------
 * Cualquier otro error sale tal cual: un `notFound()`, una excepción de
 * Postgres. Solo se atrapa la redirección, y se relanza siempre.
 */
export async function enLaApp(
  opciones: {
    ministerioId: string;
    /**
     * Las herramientas que tienen que estar encendidas. Casi siempre una; la
     * lista de canciones de un culto pide dos —repertorio y turnos—, igual que
     * su `guardaDeLaLista` en la tanda 1.
     */
    modulos: readonly ModuloId[];
    /** La pantalla desde la que se pulsó. Para el muro y por si la action no redirige. */
    volver: string;
  },
  accion: () => Promise<unknown>,
): Promise<never> {
  const { ministerioId, modulos, volver } = opciones;

  const ctx = await requireIglesiaAccion({ sinMuro: true });
  exigirPoderEscribir(ctx, volver);

  if (
    !z.string().uuid().safeParse(ministerioId).success ||
    !puedeGestionarMinisterio(ctx, ministerioId)
  ) {
    notFound();
  }

  // Pasará a un `exigirModulo(ctx, ministerioId, m, volver)` por módulo al
  // fusionar la tanda 1. Acotado a la iglesia del contexto como aquella: un
  // ministerio de otra congregación sale como apagado, que es lo que es para
  // quien pregunta.
  const encendido = await withUser(ctx.user.id, async (tx) => {
    const [fila] = await tx
      .select({ modulos: ministerios.modulos })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1);
    return fila ? modulos.every((m) => tieneModulo(fila.modulos, m)) : false;
  });
  // A la portada y no a `volver`: con la herramienta apagada, su pantalla da
  // 404 y el aviso no llegaría a leerse. Es lo mismo que hace `exigirModulo`.
  if (!encendido) {
    redirect(
      `${rutaApp(ministerioId)}?error=` +
        encodeURIComponent('Esa herramienta no está encendida en este ministerio.'),
    );
  }

  let destino: string | null = null;
  try {
    await accion();
  } catch (err) {
    if (!isRedirectError(err)) throw err;
    destino = traducirAlApp(getURLFromRedirectError(err));
  }

  // Fuera del `try`, como pide la documentación de `redirect`: dentro, el
  // propio `catch` se lo tragaría.
  redirect(destino ?? volver);
}
