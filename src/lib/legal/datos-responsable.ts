/**
 * Datos del responsable legal del tratamiento de datos personales y
 * titular del servicio Gonper Studio. Centralizado aquí para que las
 * páginas /privacidad y /terminos los muestren consistentes.
 *
 * ⚠️ IMPORTANTE — Marlon debe rellenar los placeholders [ ] antes de
 * publicar en producción. Sin esto, las páginas legales no cumplen ni
 * RGPD ni LSSI-CE (España).
 */
export const DATOS_RESPONSABLE = {
  // Marca comercial bajo la que opera el servicio.
  marca: 'Gonper Studio',

  // Razón social legal (puede ser autónomo o sociedad). Ej: "Rogotech S.L."
  // o "Marlon Rodelo Ayala".
  razonSocial: 'Marlon José Rodelo Ayala',

  // NIF (autónomo) o CIF (sociedad).
  nif: 'Y295572Y',

  // Domicilio fiscal completo: calle, número, piso, código postal,
  // localidad, provincia.
  domicilio: 'Carretera España 79, 38390 Santa Úrsula, Santa Cruz de Tenerife',

  // Email de contacto para soporte y ejercicio de derechos RGPD.
  email: 'hola@gonperstudio.shop',

  // URL pública del servicio.
  url: 'https://gonperstudio.shop',

  // Inscripción registral si aplica (solo sociedades). Dejar string vacío
  // para autónomos.
  registroMercantil: '',

  // Fecha de última actualización del documento (YYYY-MM-DD).
  ultimaActualizacion: '2026-05-19',
} as const;
