/**
 * Los clientes OAuth de Google de Hatril (Google Cloud, proyecto
 * `hatril-3ac0c`, el mismo que Firebase).
 *
 * EN EL REPO Y NO EN VARIABLES DE ENTORNO
 * ---------------------------------------
 * No son secretos —van en la página y en la app, y Google los enseña a quien
 * los mira—, y el de iOS tiene que casar con el esquema de URL que lleva el
 * `Info.plist` DENTRO del binario: si el servidor ofreciera Google a un iPhone
 * cuyo build no tiene ese esquema, la librería de Google cierra la app de golpe
 * al pulsar. Viviendo aquí, el identificador y el esquema salen del mismo
 * commit, y `npm run app:ios` se niega a sincronizar si no casan. El secreto
 * del cliente web está solo en Supabase (Authentication → Sign In / Providers →
 * Google).
 *
 * Vacío = desactivado: no sale el botón.
 */
export const GOOGLE = {
  /** Cliente «Aplicación web»: la web, y la audiencia del token en Android. */
  web: '426927529209-fgesah1e74i9bh28fkk7s99a9spl321v.apps.googleusercontent.com',
  ios: {
    /** Cliente «iOS», con el bundle `app.hatril`. */
    cliente: '426927529209-280tuf0o2khfm51g8oj17eftjcd178b4.apps.googleusercontent.com',
    /**
     * El primer build de iOS que lleva su esquema en el `Info.plist`. Un
     * iPhone con uno anterior no ve el botón de Google (`App.getInfo().build`).
     */
    desdeBuild: 2,
  },
} as const;

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc` */
export function esquemaInversoIos(cliente: string): string {
  return cliente.split('.').reverse().join('.');
}
