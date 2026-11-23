/**
 * Contrato de `GET /api/v1/app/yo`: quién soy, de qué iglesia y a dónde voy.
 *
 * `src/lib/app-api/` es el contrato entre la API y la app empaquetada
 * (`docs/app-nativa/plan-spa.md` §3). Lo importan los dos lados: si el
 * servidor cambia un campo, la app no compila. Por eso aquí solo hay tipos y
 * esquemas Zod, nada que necesite el servidor para cargarse.
 *
 * Y UN CAMPO PUBLICADO NO SE QUITA
 * --------------------------------
 * Una versión instalada de la app vive meses. Se añaden campos; quitarlos o
 * cambiarles el tipo rompe los teléfonos que no se han actualizado. Si hay que
 * romper, `/api/v2/app`.
 */
import type { Programa } from '@/lib/emisora/config';

/**
 * Las mismas tres situaciones que reparte `src/app/mi/page.tsx` para quien
 * tiene sesión:
 *
 *   - `iglesia`: pertenece a una. Va a su área (`/mi/comunidad`).
 *   - `baja`: pidió borrar la cuenta y está a tiempo de arrepentirse.
 *   - `sin_iglesia`: la sala de espera, con su solicitud si la hay.
 */
export type SituacionYo = 'iglesia' | 'baja' | 'sin_iglesia';

export type RespuestaYo = {
  cuenta: {
    id: string;
    email: string | null;
    /** El que pinta la cabecera (`nombreDeLaCuenta`). */
    nombre: string;
    fotoUrl: string | null;
  };
  situacion: SituacionYo;
  iglesia: {
    id: string;
    slug: string;
    nombre: string;
    ciudad: string | null;
    logoUrl: string | null;
    timezone: string;
    comunidad: {
      activa: boolean;
      quienPublica: 'todos' | 'equipo' | 'pastor';
      comentarios: boolean;
      fotos: boolean;
    };
  } | null;
  /**
   * Si es `false`, la app manda a aceptar la política antes de nada, como
   * hace `exigirConsentimientoAlDia` en la web. Sin iglesia, siempre `true`:
   * no hay ficha a la que colgar el consentimiento.
   */
  consentimientoAlDia: boolean;
  /** Las pestañas de abajo. `equipo` es su destino, o `null` si no sirve en nada. */
  pestanas: { equipo: string | null };
  /**
   * Para quien lleva algo en la iglesia: la ruta del panel que le toca
   * (`inicioDe`). La app no lo trae dentro: el botón «Abrir el panel» abre
   * esta ruta de hatril.com en el navegador del teléfono.
   */
  panel: string | null;
  radio: { nombre: string; streamUrl: string; parrilla: Programa[] } | null;
  /**
   * El botón «Dar» de la cabecera, si la iglesia recibe donativos. En la app
   * se abre SIEMPRE fuera, en el navegador (norma 3.2.2 de Apple).
   */
  dar: { conTarjeta: boolean; conTransferencia: boolean } | null;
  /** Solo en `sin_iglesia`. La primera que pidió, como en la web. */
  solicitud: {
    estado: 'pendiente' | 'aprobada' | 'rechazada';
    motivoRechazo: string | null;
    /** ISO 8601. */
    enviadaEl: string;
    iglesia: { nombre: string; slug: string; ciudad: string | null };
  } | null;
  /** Solo en `baja`. ISO 8601. */
  baja: { borrarDesde: string } | null;
};
