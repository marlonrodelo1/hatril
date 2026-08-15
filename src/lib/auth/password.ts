/**
 * La regla de la contraseña, en UN solo sitio.
 *
 * POR QUÉ EXISTE
 * --------------
 * La política de verdad la impone Supabase en el proyecto: mínimo de longitud
 * más "al menos una minúscula, una mayúscula y un dígito". Nuestros formularios
 * comprobaban SOLO la longitud y prometían "Mínimo 8 caracteres", así que una
 * contraseña de ocho minúsculas pasaba nuestra validación, llegaba a Supabase y
 * volvía rechazada con su mensaje en inglés y el abecedario entero escrito:
 *
 *   "Password should contain at least one character of each:
 *    abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789."
 *
 * A Fernando, de Imperio Cuts, le costó media hora de intentos a ciegas el día
 * que le invitaron: la pantalla le pedía una cosa y el error le exigía otra, en
 * un idioma que no es el suyo.
 *
 * Aquí se declara una vez y se importa. Si algún día se cambia la política en el
 * panel de Supabase, se cambia esto y ya — y mientras tanto, si algo se escapa,
 * `traducirErrorAuth` recoge el mensaje en inglés antes de que llegue a nadie.
 */

/** Longitud mínima. La nuestra, más exigente que el defecto de Supabase (6). */
export const PASSWORD_MIN = 8;

/**
 * Lo que se le enseña a la persona ANTES de escribir, no después de fallar.
 * Va en los placeholder y en los textos de ayuda de todos los formularios.
 */
export const PASSWORD_PISTA =
  '8 caracteres o más, con una mayúscula, una minúscula y un número';

/** Versión corta, para placeholders donde no cabe la frase entera. */
export const PASSWORD_PISTA_CORTA = 'Mín. 8, con mayúscula, minúscula y número';

/**
 * Valida contra la MISMA regla que Supabase. Devuelve el error en castellano, o
 * null si la contraseña vale.
 *
 * Se comprueba aquí y no solo en el servidor de Supabase para que el fallo se
 * explique en el idioma y con las palabras del producto. La comprobación de
 * Supabase sigue estando detrás: esta no la sustituye, la adelanta.
 */
export function validarPassword(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  const faltan: string[] = [];
  if (!/[a-z]/.test(password)) faltan.push('una minúscula');
  if (!/[A-Z]/.test(password)) faltan.push('una mayúscula');
  if (!/[0-9]/.test(password)) faltan.push('un número');
  if (faltan.length === 0) return null;

  // "una mayúscula y un número" se lee mejor que "una mayúscula, un número".
  const lista =
    faltan.length === 1
      ? faltan[0]
      : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
  return `A la contraseña le falta ${lista}. Tiene que llevar ${PASSWORD_PISTA}.`;
}

/**
 * Red de seguridad para lo que devuelve Supabase Auth.
 *
 * Sus mensajes vienen SIEMPRE en inglés, y algunos —el de la política de
 * contraseñas— son directamente ilegibles para un usuario final. Esta función
 * los sustituye por los nuestros; lo que no reconoce lo deja pasar tal cual,
 * que es mejor que tragarse un error y no decir nada.
 */
export function traducirErrorAuth(mensaje: string): string {
  const m = (mensaje || '').toLowerCase();

  if (m.includes('password should contain at least one character')) {
    return `A la contraseña le falta una mayúscula, una minúscula o un número. Tiene que llevar ${PASSWORD_PISTA}.`;
  }
  if (m.includes('password should be at least')) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  if (m.includes('password is known to be weak') || m.includes('pwned')) {
    return 'Esa contraseña aparece en filtraciones conocidas. Elige otra distinta.';
  }
  if (m.includes('new password should be different')) {
    return 'La contraseña nueva tiene que ser distinta de la anterior.';
  }
  if (m.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'Tienes que confirmar tu email antes de entrar. Mira tu bandeja.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  }
  return mensaje;
}
