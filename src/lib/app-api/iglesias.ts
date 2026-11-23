/**
 * Contrato del directorio de iglesias en la app: `/api/v1/app/iglesias*`.
 * Ver `src/lib/app-api/yo.ts` para las reglas del contrato.
 *
 * Es lo mismo que enseñan a cualquiera, sin sesión, `/buscar`, `/iglesia/[slug]`
 * y la web de cada iglesia: el directorio sale como `anon` (`withAnon`), y la
 * ficha es la de la página pública. Nada de aquí es de un miembro.
 */
import type { IglesiaEnLista } from '@/app/buscar/_components/fila-iglesia';
import type { HorarioSemanal } from '@/lib/db/schema';

export type RespuestaBuscar = { iglesias: IglesiaEnLista[] };

export type RespuestaSugerencias = {
  sugerencias: { slug: string; nombre: string; ciudad: string | null; pais: string }[];
};

export type RespuestaCiudades = {
  ciudades: { ciudad: string; pais: string; iglesias: number }[];
};

export type RespuestaCerca = {
  iglesias: (IglesiaEnLista & { latitud: number; longitud: number })[];
  /** Si hay mapa de Google (`/mapa`): el servidor tiene su clave. */
  mapas: boolean;
};

/**
 * Qué tiene que ver quien mira con esta iglesia. Lo que en la web decidía la
 * página con la sesión: con iglesia no se pide entrar en otra, y con una
 * solicitud pendiente tampoco.
 *
 *   - `sin_sesion`: no ha entrado.
 *   - `de_esta` / `de_otra`: ya pertenece a una iglesia.
 *   - `pendiente`: tiene una solicitud esperando (en esta o en otra).
 *   - `libre`: con sesión y sin nada; puede pedir entrar.
 */
export type RelacionConIglesia = 'sin_sesion' | 'de_esta' | 'de_otra' | 'pendiente' | 'libre';

export type RespuestaFicha = {
  iglesia: {
    slug: string;
    nombre: string;
    denominacion: string | null;
    descripcion: string | null;
    ciudad: string | null;
    pais: string;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    horarios: HorarioSemanal[];
    timezone: string;
    latitud: number | null;
    longitud: number | null;
    aceptaSolicitudes: boolean;
    webPublica: boolean;
  };
  relacion: RelacionConIglesia;
  /** Si hay mapa de Google (`/mapa`): el servidor tiene su clave. */
  mapas: boolean;
  /** Con `pendiente`: la iglesia de la solicitud, que puede ser otra. */
  pendienteEn: { nombre: string; slug: string } | null;
  /** Con `de_esta` o `de_otra`: el nombre de su iglesia. */
  miIglesia: string | null;
  /** El nombre de la cuenta, para rellenar la solicitud. */
  nombreSugerido: string | null;
};
