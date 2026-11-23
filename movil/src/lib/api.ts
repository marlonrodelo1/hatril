import { API_URL } from './entorno';
import { supabase } from './supabase';

/**
 * Cómo pide la app sus datos: a `/api/v1/app/*` de hatril.com, con la sesión
 * en `Authorization: Bearer`. Del otro lado está `endpointApp()`
 * (`src/lib/api/app.ts`), con las mismas guardas que la web.
 *
 * Los errores llegan como `{ error, ir }`: `error` ya está en palabras para la
 * persona, y `ir` dice a qué pantalla mandarla (`/acceso`, `/acepta`…).
 */
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
    readonly ir: string | null = null,
    readonly detalles: Record<string, string[]> | null = null,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

type Opciones = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Se manda como JSON. En GET, como query. */
  datos?: Record<string, unknown>;
};

export async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const metodo = opciones.method ?? 'GET';
  const conQuery = metodo === 'GET';

  const url = new URL(`${API_URL}/api/v1/app${ruta}`);
  if (conQuery && opciones.datos) {
    for (const [k, v] of Object.entries(opciones.datos)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  return enviar<T>(url, metodo, !conQuery && opciones.datos ? JSON.stringify(opciones.datos) : undefined, {
    ...(!conQuery && opciones.datos ? { 'content-type': 'application/json' } : {}),
  });
}

/**
 * Un `POST` con `multipart/form-data`: lo que necesitan las actions que suben
 * fotos (`./acciones.ts`). El navegador pone él la cabecera con el separador.
 */
export async function pedirFormulario<T>(ruta: string, cuerpo: FormData): Promise<T> {
  return enviar<T>(new URL(`${API_URL}/api/v1/app${ruta}`), 'POST', cuerpo, {});
}

async function enviar<T>(
  url: URL,
  metodo: string,
  cuerpo: BodyInit | undefined,
  cabecerasExtra: Record<string, string>,
  reintento = false,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const cabeceras: Record<string, string> = { ...cabecerasExtra };
  if (session) cabeceras.authorization = `Bearer ${session.access_token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { method: metodo, headers: cabeceras, body: cuerpo });
  } catch {
    // `fetch` solo lanza sin red. Su mensaje es técnico y en inglés.
    throw new ErrorApi('No hay conexión. Comprueba tu internet y vuelve a intentarlo.', 0);
  }

  // Un 401 con sesión suele ser un token caducado que el refresco automático
  // no llegó a renovar (la app estuvo en segundo plano). Se refresca y se
  // reintenta UNA vez. Si el refresco no da sesión, supabase-js avisa de que
  // se cerró y la app vuelve al acceso sola (`./sesion.tsx`).
  if (respuesta.status === 401 && session && !reintento) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) return enviar<T>(url, metodo, cuerpo, cabecerasExtra, true);
  }

  if (respuesta.status === 204) return null as T;

  let leido: unknown = null;
  try {
    leido = JSON.parse(await respuesta.text(), revivirFechas);
  } catch {
    leido = null;
  }

  if (!respuesta.ok) {
    const c = (leido ?? {}) as { error?: string; ir?: string; detalles?: Record<string, string[]> };
    throw new ErrorApi(
      c.error ?? 'Algo ha fallado. Inténtalo de nuevo.',
      respuesta.status,
      c.ir ?? null,
      c.detalles ?? null,
    );
  }

  return leido as T;
}

/**
 * Las fechas vuelven a ser fechas.
 *
 * Las consultas de la web devuelven `Date` (las columnas `timestamp`), y los
 * componentes que la app reaprovecha las esperan así: las formatean, las
 * comparan. En JSON viajan como texto ISO con hora y `Z`, y aquí se rehacen.
 * Las columnas `date` (`2026-11-20`, sin hora) se quedan en texto, que es como
 * las devuelve también Drizzle en la web: la regla no las toca.
 */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function revivirFechas(_clave: string, valor: unknown): unknown {
  return typeof valor === 'string' && FECHA_ISO.test(valor) ? new Date(valor) : valor;
}
