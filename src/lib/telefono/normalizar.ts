/**
 * Formato único de teléfono para toda la plataforma.
 *
 * POR QUÉ EXISTE
 * --------------
 * El teléfono es como se localiza a una persona, y cada cual lo escribe a su
 * manera. En Gonper se midió sobre datos reales: de 333 teléfonos solo 33
 * estaban en un formato consistente, y 16 personas tenían DOS fichas
 * —«667008500» y «667 008 500»— con su historial partido entre las dos.
 *
 * Aquí el riesgo es el mismo: un pastor apunta a alguien el domingo y otro
 * líder lo vuelve a apuntar el miércoles escribiendo el número con espacios.
 *
 * DOS PAÍSES, NO UNO
 * ------------------
 * La versión de Gonper daba por hecho España: nueve dígitos y +34 a fuego. En
 * Colombia son diez dígitos y +57, así que un número colombiano perfectamente
 * válido salía rechazado. Por eso el país es un parámetro, y sale de la ficha
 * de la iglesia (`iglesias.pais`), no de una constante.
 *
 * FORMATO CANÓNICO: E.164 sin espacios → `+573001234567`, `+34667008500`.
 */

type Pais = 'CO' | 'ES';

const REGLAS: Record<
  Pais,
  { prefijo: string; digitos: number; empiezaPor: RegExp }
> = {
  // Colombia: móviles de 10 dígitos que empiezan por 3; fijos también de 10
  // desde la unificación de 2022, empezando por 60.
  CO: { prefijo: '57', digitos: 10, empiezaPor: /^[36]/ },
  // España: 9 dígitos. 6 y 7 móviles, 8 y 9 fijos.
  ES: { prefijo: '34', digitos: 9, empiezaPor: /^[6789]/ },
};

/**
 * Devuelve el número en E.164, o `null` si está vacío.
 *
 * Si no reconoce el formato, devuelve lo que escribió la persona con los
 * espacios quitados en vez de descartarlo. Es deliberado: un número raro pero
 * anotado sirve para llamar; un campo vacío porque la validación lo rechazó no
 * sirve para nada, y encima el pastor no se entera de que se perdió.
 */
export function normalizarTelefono(
  raw: string | null | undefined,
  pais: string = 'CO',
): string | null {
  if (!raw) return null;

  const limpio = raw.trim();
  if (!limpio) return null;

  // Se conserva el `+` inicial y se tiran el resto de adornos: espacios,
  // guiones, puntos y paréntesis del prefijo.
  const tieneMas = limpio.startsWith('+');
  const digitos = limpio.replace(/\D/g, '');

  if (!digitos) return null;

  // Ya venía en internacional: se respeta tal cual.
  if (tieneMas) return `+${digitos}`;

  // Prefijo internacional escrito con ceros: 0057…, 0034…
  if (digitos.startsWith('00')) return `+${digitos.slice(2)}`;

  const regla = REGLAS[(pais as Pais) in REGLAS ? (pais as Pais) : 'CO'];

  // Nacional sin prefijo.
  if (digitos.length === regla.digitos && regla.empiezaPor.test(digitos)) {
    return `+${regla.prefijo}${digitos}`;
  }

  // Con el prefijo del país pero sin el `+`.
  if (
    digitos.startsWith(regla.prefijo) &&
    digitos.length === regla.prefijo.length + regla.digitos
  ) {
    return `+${digitos}`;
  }

  // No encaja en ningún patrón conocido: se guarda sin espacios y se sigue.
  return digitos;
}

/** ¿Es un número reconocible para este país? Para avisar, nunca para bloquear. */
export function telefonoEsValido(
  raw: string | null | undefined,
  pais: string = 'CO',
): boolean {
  const normalizado = normalizarTelefono(raw, pais);
  return Boolean(normalizado && normalizado.startsWith('+'));
}

/**
 * Para mostrar: agrupa los dígitos de forma legible.
 *
 * `+573001234567` → `+57 300 123 4567`
 * `+34667008500`  → `+34 667 00 85 00`
 */
export function formatearTelefono(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!raw.startsWith('+')) return raw;

  if (raw.startsWith('+57') && raw.length === 13) {
    const n = raw.slice(3);
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }

  if (raw.startsWith('+34') && raw.length === 12) {
    const n = raw.slice(3);
    return `+34 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  }

  return raw;
}
