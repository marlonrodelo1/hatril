/**
 * En qué situación está la suscripción de una iglesia. FUENTE ÚNICA DE VERDAD.
 *
 * Este fichero se reescribió entero. El anterior venía de Gonper y hablaba de
 * «salón»: sus planes eran `basico`, `solo`, `studio` y `pro` con precios en
 * euros cableados, ninguno de los cuales existe aquí. Una iglesia con plan
 * `esencial` o `comunidad` caía por su rama final y se marcaba como bloqueada —
 * es decir, el muro habría cerrado la puerta a quien acababa de pagar. No lo
 * llamaba nadie, así que nunca llegó a explotar.
 *
 * Se conservan dos ideas suyas, que eran buenas:
 *
 *   1. **Sin `server-only`.** Son cuentas sobre campos que la aplicación ya
 *      tiene en el contexto. La app móvil de la v2 tendrá que pintar el mismo
 *      aviso sin esperar a que el servidor le diga que no, y con la lógica aquí
 *      las dos superficies deciden igual. En Gonper esto vivía dentro del layout
 *      del panel, así que el móvil no lo aplicaba: un salón con la prueba
 *      vencida seguía trabajando desde la app mientras la web le cerraba.
 *   2. **La etiqueta se calcula aquí**, junto al estado. Separadas, se acaba
 *      diciendo «Cuenta activa» a quien está cancelado.
 *
 * CINCO SITUACIONES, NO DOS BOOLEANOS
 * ------------------------------------
 * La versión vieja tenía `trialExpirado`, `planActivo`, `sinSuscripcion` y
 * `planCortesia` sueltos, y había que cruzarlos en cada pantalla para saber qué
 * pasaba. Aquí es una unión discriminada: o estás en una situación o estás en
 * otra, y el compilador obliga a tratarlas todas.
 *
 * LA GRACIA DE LECTURA
 * --------------------
 * Al vencer, la iglesia NO se cierra de golpe: durante tres días se puede seguir
 * consultando, y lo único que se bloquea es escribir. Cerrar entero deja a una
 * congregación sin su fichero un domingo por la mañana por un recibo devuelto el
 * viernes, y el domingo es justo el día que lo necesita.
 */

/**
 * Los planes de pago. Coincide con `plan_enum` en Postgres, menos `trial` y
 * `cancelado`, que no son planes sino situaciones.
 *
 * Array y no unión suelta, mismo patrón que `ROLES_IGLESIA` en `permisos.ts`:
 * hace falta poder recorrerlo, y así el tipo y la lista no pueden separarse.
 */
export const PLANES_DE_PAGO = ['esencial', 'comunidad', 'plus'] as const;

export type PlanDePago = (typeof PLANES_DE_PAGO)[number];

/**
 * Días que se puede seguir consultando después de vencer.
 *
 * Constante de política, no dato por iglesia: una columna `gracia_hasta` en
 * `iglesias` obligaría a un UPDATE sobre la tabla entera para cambiar el número.
 */
export const GRACIA_DIAS = 3;

export type EstadoSuscripcion =
  /** Paga y está al día. */
  | { situacion: 'activa'; plan: PlanDePago }
  /** En periodo de prueba, con fecha de fin. */
  | { situacion: 'prueba'; diasRestantes: number; accesoHasta: Date }
  /**
   * Canceló, pero le queda periodo ya pagado. Funciona con normalidad hasta que
   * acabe — lo promete `/terminos` §4: «se puede cancelar cuando se quiera y
   * sigue funcionando hasta el final del periodo pagado».
   *
   * Estado propio y no un `prueba` con otro nombre: a quien canceló hay que
   * decirle «tu suscripción termina el 14», no «te quedan 10 días de prueba».
   * Lo segundo es falso y además le esconde que puede reactivarla.
   */
  | { situacion: 'termina'; diasRestantes: number; accesoHasta: Date }
  /** Venció hace poco: puede consultar, no puede guardar. */
  | { situacion: 'solo_lectura'; diasDeGracia: number; accesoHasta: Date }
  /** Se acabó también la gracia. */
  | { situacion: 'bloqueada' };

/**
 * Lo mínimo que hace falta para decidir. Lo cumple `UserContext['iglesia']` sin
 * adaptadores, y lo cumplirá la respuesta de la API de la app móvil escribiendo
 * los dos campos.
 */
export interface IglesiaFacturable {
  plan: string;
  /**
   * Hasta cuándo hay acceso. En `trial` es el fin de la prueba; con una
   * suscripción cancelada o vencida, el fin del periodo ya pagado. El nombre de
   * la columna sigue siendo `trial_until` por no arrastrar una migración que no
   * cambia comportamiento; ver el `comment on column` de la `0021`.
   */
  trialUntil: Date | string | null;
}

const MS_POR_DIA = 86_400_000;

function comoFecha(v: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Días enteros que faltan para una fecha. Negativo si ya pasó. */
function diasHasta(fecha: Date, ahora: Date): number {
  return Math.ceil((fecha.getTime() - ahora.getTime()) / MS_POR_DIA);
}

/**
 * `ahora` es un parámetro y no `new Date()` dentro por una razón práctica: es lo
 * que permite probar los cuatro estados sin tocar el reloj del sistema ni
 * esperar siete días.
 */
export function leerEstadoSuscripcion(
  iglesia: IglesiaFacturable | null | undefined,
  ahora: Date = new Date(),
): EstadoSuscripcion {
  if (!iglesia) return { situacion: 'bloqueada' };

  // Un plan de pago manda, y punto. Si dejó de pagar, el webhook ya lo habrá
  // bajado a `cancelado`: preguntarle además por `trial_until` aquí duplicaría
  // la decisión que Stripe ya tomó, y las dos podrían discrepar.
  if ((PLANES_DE_PAGO as readonly string[]).includes(iglesia.plan)) {
    return { situacion: 'activa', plan: iglesia.plan as PlanDePago };
  }

  const accesoHasta = comoFecha(iglesia.trialUntil);

  // Sin fecha no hay nada que interpretar, y se falla CERRADO. Es el caso de una
  // fila antigua o de un alta a medias: dejar pasar por defecto convertiría
  // cualquier dato ausente en una cuenta gratis indefinida.
  if (!accesoHasta) return { situacion: 'bloqueada' };

  const dias = diasHasta(accesoHasta, ahora);

  if (dias > 0) {
    // Quien tiene fecha futura y NO esta en trial es alguien que cancelo: el
    // webhook le puso `cancelado` con el fin del periodo ya pagado.
    return iglesia.plan === 'trial'
      ? { situacion: 'prueba', diasRestantes: dias, accesoHasta }
      : { situacion: 'termina', diasRestantes: dias, accesoHasta };
  }

  // `dias` es 0 o negativo: ya venció. Quedan los días de gracia.
  const diasDeGracia = GRACIA_DIAS + dias;
  if (diasDeGracia > 0) {
    return { situacion: 'solo_lectura', diasDeGracia, accesoHasta };
  }

  return { situacion: 'bloqueada' };
}

/**
 * ¿Puede esta iglesia GUARDAR algo?
 *
 * El predicado que consultan los guards de las server actions. Leer no se
 * pregunta nunca: en `solo_lectura` el panel entero sigue navegable, y en
 * `bloqueada` de la redirección se encarga el layout.
 */
export function puedeEscribir(estado: EstadoSuscripcion): boolean {
  return (
    estado.situacion === 'activa' ||
    estado.situacion === 'prueba' ||
    estado.situacion === 'termina'
  );
}

/** ¿Hay que enseñar un aviso? Distinto de bloquear: los últimos días de prueba avisan. */
export function convieneAvisar(estado: EstadoSuscripcion): boolean {
  return (
    estado.situacion === 'solo_lectura' ||
    ((estado.situacion === 'prueba' || estado.situacion === 'termina') &&
      estado.diasRestantes <= 3)
  );
}

/**
 * Cómo se le cuenta a la persona, en una frase.
 *
 * Escrito desde lo que le pasa a ella, no desde el nombre del estado: «no puedes
 * guardar cambios» dice qué va a encontrarse; «suscripción inactiva» le hace
 * adivinar.
 */
export function etiquetaEstado(estado: EstadoSuscripcion): string {
  switch (estado.situacion) {
    case 'activa':
      return 'Tu suscripción está al día.';
    case 'prueba':
      return estado.diasRestantes === 1
        ? 'Te queda 1 día de prueba.'
        : `Te quedan ${estado.diasRestantes} días de prueba.`;
    case 'termina': {
      const dia = estado.accesoHasta.toLocaleDateString('es', {
        day: 'numeric',
        month: 'long',
      });
      return `Has cancelado. Tu suscripción sigue activa hasta el ${dia}.`;
    }
    case 'solo_lectura':
      return estado.diasDeGracia === 1
        ? 'Se acabó la prueba. Puedes consultar 1 día más, pero no guardar cambios.'
        : `Se acabó la prueba. Puedes consultar ${estado.diasDeGracia} días más, pero no guardar cambios.`;
    case 'bloqueada':
      return 'Necesitas una suscripción para seguir usando Hatril.';
  }
}
