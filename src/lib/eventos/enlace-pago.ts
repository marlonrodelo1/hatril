/**
 * El enlace de pago que el pastor pega al crear un evento.
 *
 * SIN LISTA BLANCA, Y ESO SE APARTA DE LO QUE HACE EL RESTO DEL REPO
 * ------------------------------------------------------------------
 * `devocionales.videoUrl` valida contra una lista de hosts de vídeo, y
 * `src/lib/iglesias/redes.ts` contra cinco redes. En los dos casos la lista se
 * podía escribir de verdad. Aquí el destino es Stripe, Wompi, Nequi, PayU,
 * Mercado Pago, el TPV del banco local de una congregación colombiana, o la
 * pasarela que salga el año que viene. Una lista cerrada no protegería a nadie:
 * garantizaría que el primer pastor con un medio que no conocemos no pueda
 * cobrar, y que el producto parezca roto por decisión nuestra.
 *
 * LO QUE SÍ SE COMPRUEBA, PORQUE ES LO QUE HACE DAÑO
 * --------------------------------------------------
 * Este enlace acaba en un `href` de la web PÚBLICA de una iglesia, al lado de su
 * nombre y su logo. Lo que se defiende es eso:
 *
 *   - Solo `https:`. Se ADMITE uno en vez de enumerar los prohibidos: enumerar
 *     lo malo deja fuera lo de mañana, y aquí no hay segunda oportunidad.
 *   - `new URL()` tiene que entenderlo. Sin eso, un `//otro.host/pagar` se
 *     resolvería contra el dominio de la iglesia.
 *   - Sin credenciales embebidas. `https://buy.stripe.com@evil.com/x` tiene
 *     hostname `evil.com`, y quien pinte el host cortando la cadena a mano
 *     mostraría «buy.stripe.com» al feligrés.
 *   - El host se devuelve aparte para enseñárselo a quien va a pulsar. Es la
 *     única mitad de esta protección que ve la víctima: el pastor ve la
 *     dirección entera al pegarla, el feligrés solo ve «Pagar la inscripción».
 *
 * NO SE ANTEPONE `https://` A CIEGAS, y ahí también se separa de `redes.ts`.
 * Allí tiene sentido, porque «instagram.com/x» es inequívocamente una
 * dirección. Aquí, un «bizum 600123456» se convertiría en una URL con pinta de
 * válida que no lleva a ninguna parte, y el pastor no se enteraría hasta que
 * alguien le dijera que no ha podido pagar. Para eso está el campo de
 * instrucciones, que se pinta como texto.
 */

export type EnlacePago = { url: string; host: string };

export type ResultadoEnlacePago =
  /** `null` significa que el campo venía vacío: el evento se queda sin enlace. */
  | { ok: true; enlace: EnlacePago | null }
  | { ok: false; error: string };

const MENSAJE =
  'El enlace de pago tiene que ser una dirección completa que empiece por https://. Si cobras por Bizum, Nequi o transferencia, ponlo en «Cómo pagar» en vez de aquí.';

export function normalizarEnlacePago(bruto: string | null | undefined): ResultadoEnlacePago {
  const limpio = (bruto ?? '').trim();
  if (!limpio) return { ok: true, enlace: null };

  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return { ok: false, error: MENSAJE };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: MENSAJE };
  }

  // `https://buy.stripe.com@evil.com/x`. El navegador va a `evil.com`.
  if (url.username || url.password) {
    return {
      ok: false,
      error:
        'Ese enlace lleva un usuario o una contraseña dentro de la dirección, y eso se usa para hacer creer que apunta a otro sitio. Pega el enlace tal cual te lo da tu pasarela de pago.',
    };
  }

  const host = url.hostname.toLowerCase();
  if (!host || !host.includes('.')) {
    return { ok: false, error: MENSAJE };
  }

  /*
   * El fragmento se tira: no viaja al servidor de destino y solo sirve para
   * alargar lo que se le enseña al feligrés. La query SÍ se conserva, al
   * contrario que en `redes.ts`: media pasarela mete el identificador del cobro
   * ahí, así que quitarla rompería el enlace.
   */
  url.hash = '';

  return { ok: true, enlace: { url: url.toString(), host } };
}
