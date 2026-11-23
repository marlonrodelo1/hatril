import { z } from 'zod';

import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';

/**
 * Contrato de la solicitud de ingreso y del alta de cuenta personal.
 *
 * Lo usan la web (`src/app/solicitar/actions.ts`) y la API de la app
 * (`/api/v1/app/solicitud`, `/api/v1/app/cuenta`), y la app lo usa además en
 * el teléfono para validar ANTES de crear la cuenta: el orden que pedía
 * `crearCuentaYSolicitar`. Con un teléfono vacío no debe quedar creada una
 * cuenta sin solicitud.
 *
 * Sin nada de servidor: lo importa también el teléfono.
 */
export const CamposSolicitud = {
  slug: z.string().trim().min(1),
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  telefono: z
    .string()
    .trim()
    .min(6, 'Escribe tu teléfono: es como la iglesia podrá contactarte.')
    .max(40),
  prefijo: z.enum(['ES', 'CO']).optional(),
  direccion: z.string().trim().max(240).optional().or(z.literal('')),
  mensaje: z.string().trim().max(600).optional().or(z.literal('')),
  consentimiento: z.literal(true, {
    message: 'Tienes que aceptar para poder enviar la solicitud.',
  }),
  asistencia: z.boolean(),
  /**
   * El código de la célula que invita, si se llegó con su enlace. Aquí solo se
   * acota: el servidor lo vuelve a leer con `leerCodigo` y lo resuelve contra
   * ESTA iglesia (`grupoDeLaInvitacion`), así que un código inventado o de otra
   * congregación no encuentra nada.
   */
  grupo: z.string().trim().max(16).optional().or(z.literal('')),
};

export const EsquemaSolicitud = z.object(CamposSolicitud);
export type DatosSolicitud = z.infer<typeof EsquemaSolicitud>;

/**
 * Los campos del formulario de solicitud (`PasosSolicitud`), tal como los
 * lee Zod. Lo usan la action de la web y la app, con el mismo formulario.
 */
export function leerSolicitud(formData: FormData) {
  return {
    slug: campoObligatorio(formData, 'slug'),
    nombre: campoObligatorio(formData, 'nombre'),
    telefono: campoObligatorio(formData, 'telefono'),
    prefijo: campo(formData, 'prefijo'),
    direccion: campo(formData, 'direccion'),
    mensaje: campo(formData, 'mensaje'),
    consentimiento: casilla(formData, 'consentimiento'),
    asistencia: casilla(formData, 'asistencia'),
    grupo: campo(formData, 'grupo'),
  };
}

export const EsquemaCuentaPersonal = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  // Sin recortar: una contraseña que termine en espacio dejaría de valer.
  password: z.string(),
});
export type DatosCuentaPersonal = z.infer<typeof EsquemaCuentaPersonal>;

/**
 * La solicitud de quien todavía no tiene cuenta: la crea en el mismo
 * formulario. Se valida TODO antes de crear la cuenta.
 */
export const EsquemaCuentaYSolicitud = z.object({
  ...CamposSolicitud,
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string(),
});

/** El mensaje cuando el correo ya tiene cuenta, el mismo en la web y en la app. */
export const MENSAJE_CORREO_CON_CUENTA =
  'Este correo ya tiene cuenta. Entra con él y vuelves aquí con la solicitud.';

export const EsquemaRecuperar = z.object({
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
});

/** `POST /api/v1/app/solicitud`: enviada, o ya tenía una iglesia o solicitud. */
export type RespuestaSolicitud = { resultado: 'enviada' | 'ya_tenia' };
