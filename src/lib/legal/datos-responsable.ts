/**
 * Datos del responsable del tratamiento y titular del servicio.
 *
 * Centralizados aquí para que `/privacidad`, `/terminos` y los correos los
 * muestren siempre iguales. Con datos del art. 9 del RGPD de por medio, una
 * página de privacidad que no identifique bien al responsable no es un descuido
 * de forma: invalida la base jurídica del tratamiento.
 *
 * PENDIENTE ANTES DE PUBLICAR
 * ---------------------------
 *   - `url` y `email` apuntan a un dominio que todavía no existe. Hay que
 *     registrar el de Hatril y actualizarlos.
 *   - Falta el ENCARGO DE TRATAMIENTO (art. 28 RGPD) que hay que firmar con
 *     cada iglesia. Sin él, Hatril trata datos de categoría especial por cuenta
 *     de un tercero sin contrato que lo ampare, y eso ni la iglesia ni nosotros
 *     lo podemos defender. Va en `/terminos` como anexo aceptable al registrarse.
 *   - Para Colombia hace falta además el aviso de la Ley 1581 y el registro del
 *     tratamiento ante la SIC si se supera el umbral de registros.
 */
export const DATOS_RESPONSABLE = {
  /** Marca comercial bajo la que opera el servicio. */
  marca: 'Hatril',

  razonSocial: 'Marlon José Rodelo Ayala',
  nif: 'Y295572Y',
  domicilio:
    'Carretera España 79, 38390 Santa Úrsula, Santa Cruz de Tenerife',

  /** Contacto de soporte y para el ejercicio de derechos del RGPD. */
  email: 'hola@hatril.app',
  url: 'https://hatril.app',

  /** Solo sociedades. Vacío para autónomo. */
  registroMercantil: '',

  ultimaActualizacion: '2026-08-15',
} as const;
