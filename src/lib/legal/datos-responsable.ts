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
 *   - `url` y `email` apuntan a un dominio en trámite de registro. Cuando esté,
 *     no hay que tocar nada más: todo sale de aquí.
 *   - **`ALOJAMIENTO` está sin rellenar.** Ver su comentario justo abajo.
 *   - Para Colombia hace falta además el registro del tratamiento ante la SIC si
 *     se supera el umbral de registros.
 *
 * El ENCARGO DE TRATAMIENTO del art. 28 ya no falta: está en `/terminos` como
 * anexo, y se acepta al registrar la iglesia.
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

  ultimaActualizacion: '2026-08-16',
} as const;

/**
 * Quién más toca los datos, y para qué.
 *
 * Vive junto al responsable porque `/privacidad` y `/terminos` tienen que decir
 * exactamente lo mismo: dos listas escritas a mano acaban divergiendo, y una
 * política que nombra un encargado que el contrato no menciona es peor que no
 * tener lista.
 *
 * NO ES DECORACIÓN. El art. 13.1.e obliga a informar de los destinatarios, y con
 * datos del art. 9 esa lista es de lo primero que mira quien reclama.
 *
 * Regla para mantenerla: **si una herramienta puede llegar a ver un dato de una
 * persona, va aquí, aunque no lo guarde.** Un servidor que solo procesa la
 * petición ya la ve, y sus logs pueden retenerla.
 *
 * Sentry y PostHog están instalados en `src/lib/observability/` pero SIN claves,
 * así que hoy no envían nada y por eso no aparecen. El día que se configure
 * alguno, se añade aquí ANTES de desplegarlo.
 */
export type Encargado = {
  nombre: string;
  finalidad: string;
  ubicacion: string;
  /** `false` cuando la herramienta está integrada pero todavía no en uso. */
  activo: boolean;
};

/**
 * El alojamiento del servidor.
 *
 * SIN RELLENAR A PROPÓSITO, y visible en la página para que no se publique así.
 *
 * Se preguntó y la respuesta fue «los datos están en Supabase». Es cierto para
 * los datos GUARDADOS —base, sesiones y ficheros están en Supabase—, pero no
 * agota la obligación: el contenedor de Next.js recibe cada nombre, cada correo
 * y cada vínculo con una congregación al procesar la petición, y sus registros
 * pueden retenerlos un tiempo. Eso es tratamiento, y su proveedor es un
 * encargado que hay que nombrar.
 *
 * Hace falta el nombre legal del proveedor y el país del centro de datos. La IP
 * del despliegue (`187.124.37.206`) está en un rango que no es europeo, así que
 * conviene confirmarlo antes de escribir «UE» en una política.
 */
export const ALOJAMIENTO: Encargado = {
  nombre: '[PENDIENTE: proveedor del VPS]',
  finalidad: 'Ejecuta la aplicación y procesa cada petición',
  ubicacion: '[PENDIENTE: país del centro de datos]',
  activo: true,
};

export const ENCARGADOS: readonly Encargado[] = [
  {
    nombre: 'Supabase Inc.',
    finalidad:
      'Guarda la base de datos, las cuentas de acceso y los ficheros que suba cada iglesia',
    ubicacion: 'Irlanda (UE), región eu-west-1',
    activo: true,
  },
  ALOJAMIENTO,
  {
    nombre: 'Stripe Payments Europe, Ltd.',
    finalidad:
      'Cobra la suscripción de la iglesia. No recibe datos de los miembros',
    ubicacion: 'Irlanda (UE)',
    activo: false,
  },
  {
    nombre: 'Resend',
    finalidad:
      'Envía los correos del servicio: aviso de solicitud, recuperar contraseña',
    ubicacion: 'Estados Unidos, con cláusulas contractuales tipo',
    activo: false,
  },
] as const;

/** ¿Queda algo sin rellenar? La página lo avisa en vez de publicarse a medias. */
export function faltanDatosLegales(): boolean {
  return ENCARGADOS.some(
    (e) => e.nombre.includes('PENDIENTE') || e.ubicacion.includes('PENDIENTE'),
  );
}
