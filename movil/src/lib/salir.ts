import { olvidarEsteTelefono } from './push';
import { supabase } from './supabase';

/**
 * Cerrar sesión en la app.
 *
 * Primero se borra el token de push de ESTE teléfono, con la sesión todavía
 * viva: si no, al siguiente que entre en el mismo teléfono le llegarían los
 * avisos de la cuenta anterior. En la web lo hacía `salir()` leyendo la cookie
 * `hatril_push`; aquí el token lo sabe la propia app.
 *
 * Que falle borrar el token no impide salir: la sesión tiene que cerrarse
 * igual, y el token huérfano lo limpia FCM cuando deje de valer.
 *
 * Y al final, una carga limpia del acceso, sin `next`: si se quedara la
 * pantalla en la que estaba, quien entrase después en el mismo teléfono
 * aterrizaría en ella. La carga además tira todo lo que hubiera en memoria,
 * que es lo que se quiere con datos de otra persona.
 */
export async function salir(): Promise<void> {
  await olvidarEsteTelefono().catch(() => {});
  await supabase.auth.signOut();
  window.location.replace('/acceso');
}
