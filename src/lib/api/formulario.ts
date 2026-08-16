import 'server-only';

/**
 * Lectura de campos de un `FormData` para pasárselos a Zod.
 *
 * EL FALLO QUE ESTO EVITA
 * -----------------------
 * `formData.get('loquesea')` devuelve **`null`** cuando el campo no viaja en el
 * envío, y `z.string().optional()` acepta `undefined` pero NO `null`. Resultado:
 * un campo opcional que simplemente no está en el formulario tumba la
 * validación entera con «Invalid input: expected string, received null», en
 * inglés y a la cara de la persona.
 *
 * No era teórico. Rompía el inicio de sesión: `/acceso` solo pinta el campo
 * oculto `next` cuando se llega con un destino, así que entrar desde la
 * pantalla normal fallaba SIEMPRE. Nadie podía iniciar sesión.
 *
 * Y afectaba a más sitios: el formulario de miembro no pinta el bloque de datos
 * protegidos a quien no tiene el permiso, de modo que a esa persona le fallaba
 * guardar por los campos que ni siquiera vio.
 *
 * DÓNDE ESTÁ LA DIFERENCIA
 * ------------------------
 * `null` («este campo no venía») y `''` («venía vacío») no son lo mismo para
 * Zod, pero para nuestros formularios sí: los dos significan «no hay dato». Se
 * normalizan aquí, en un solo sitio, en lugar de recordar el `?? undefined` en
 * cada una de las cincuenta y seis lecturas del repo.
 */

/** Un campo de texto. `null` y `''` se convierten en `undefined`. */
export function campo(
  formData: FormData,
  nombre: string,
): string | undefined {
  const valor = formData.get(nombre);
  if (typeof valor !== 'string') return undefined;
  const limpio = valor.trim();
  return limpio === '' ? undefined : limpio;
}

/**
 * Un campo de texto obligatorio, sin normalizar a `undefined`.
 *
 * Devuelve `''` en lugar de `undefined` para que sea Zod quien dé el mensaje
 * («Escribe tu nombre») y no una comprobación suelta aquí arriba. Si esto
 * devolviera `undefined`, el error de Zod volvería a ser el genérico en inglés.
 */
export function campoObligatorio(formData: FormData, nombre: string): string {
  const valor = formData.get(nombre);
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Una casilla. Marcada o no.
 *
 * El navegador envía `'on'` si está marcada y NO envía el campo si no lo está,
 * que es justo el caso que producía el `null`.
 */
export function casilla(formData: FormData, nombre: string): boolean {
  return formData.get(nombre) === 'on';
}

/** Los valores de un campo repetido (varias casillas con el mismo `name`). */
export function campos(formData: FormData, nombre: string): string[] {
  return formData
    .getAll(nombre)
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}
