/**
 * Dónde guarda la página de dar lo rellenado antes de ir a Stripe
 * (`sessionStorage`, de esa pestaña). Lo lee la propia página al volver sin
 * pagar y lo borra la de gracias al llegar con el pago hecho o en camino: si
 * no, volver atrás desde gracias diría «No se ha cobrado nada» a quien acaba
 * de pagar.
 */
export function claveBorrador(slug: string): string {
  return `hatril:dar:${slug}`;
}
