import { conSesion, endpointApp, errorApp } from '@/lib/api/app';
import { ctxParaLaApp } from '@/lib/api/ctx-app';
import { emparejarPantalla, type NombrePantallaEquipo } from '@/lib/app-api/equipo';
import { cargar as equipos } from '@/app/mi/equipo/datos';
import { cargar as portada } from '@/app/mi/equipo/[id]/datos';
import { cargar as fondo } from '@/app/mi/equipo/[id]/fondo/datos';
import { cargar as turnos } from '@/app/mi/equipo/[id]/turnos/datos';
import { cargar as planificar } from '@/app/mi/equipo/[id]/turnos/planificar/datos';
import { cargar as turno } from '@/app/mi/equipo/[id]/turnos/[turnoId]/datos';
import { cargar as agenda } from '@/app/mi/equipo/[id]/agenda/datos';
import { cargar as reunionNueva } from '@/app/mi/equipo/[id]/agenda/nueva/datos';
import { cargar as reunion } from '@/app/mi/equipo/[id]/agenda/[reunionId]/datos';
import { cargar as reunionEditar } from '@/app/mi/equipo/[id]/agenda/[reunionId]/editar/datos';
import { cargar as repertorio } from '@/app/mi/equipo/[id]/repertorio/datos';
import { cargar as cancionNueva } from '@/app/mi/equipo/[id]/repertorio/nueva/datos';
import { cargar as cancion } from '@/app/mi/equipo/[id]/repertorio/[cancionId]/datos';
import { cargar as seguimiento } from '@/app/mi/equipo/[id]/seguimiento/datos';
import { cargar as persona } from '@/app/mi/equipo/[id]/seguimiento/[miembroId]/datos';
import { cargar as ninos } from '@/app/mi/equipo/[id]/ninos/datos';
import { cargar as ninosCronograma } from '@/app/mi/equipo/[id]/ninos/cronograma/datos';
import { cargar as ninosFamilias } from '@/app/mi/equipo/[id]/ninos/familias/datos';
import { cargar as ninosPublicacion } from '@/app/mi/equipo/[id]/ninos/publicacion/[publicacionId]/datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las pantallas de `/mi/equipo` en la app: una ruta para las diecinueve.
 *
 * Cada pantalla tiene su `cargar` en su `datos.ts`, el mismo que usa su página
 * de la web, CON SU GUARDA DENTRO: ser del equipo, que el ministerio sea de su
 * iglesia, el módulo encendido, la puerta del adaptador (`en-la-app/guarda.ts`).
 * Aquí solo se elige cuál, con la tabla cerrada de `PANTALLAS_EQUIPO`: una
 * dirección que no está ahí es un 404 sin consultar nada. Lo que sea un
 * `notFound()` o un `redirect()` de esas guardas sale como en el resto de la
 * API (404, o 403 con `ir`).
 *
 * El `ctx` que devuelven las cargas se recorta antes de salir (`ctxParaLaApp`).
 */
type Carga = (entrada: never) => Promise<{ ctx?: Parameters<typeof ctxParaLaApp>[0] } & Record<string, unknown>>;

const CARGAS: Record<NombrePantallaEquipo, Carga> = {
  equipos,
  portada,
  fondo,
  turnos,
  planificar,
  turno,
  agenda,
  reunionNueva,
  reunion,
  reunionEditar,
  repertorio,
  cancionNueva,
  cancion,
  seguimiento,
  persona,
  ninos,
  ninosCronograma,
  ninosFamilias,
  ninosPublicacion,
} as Record<NombrePantallaEquipo, Carga>;

const PREFIJO = '/api/v1/app/mi/equipo';

export const GET = endpointApp({ guarda: conSesion }, async ({ request }) => {
  const resto = request.nextUrl.pathname.slice(PREFIJO.length).replace(/^\/|\/$/g, '');
  const segmentos = resto ? resto.split('/').map((s) => decodeURIComponent(s)) : [];
  const pantalla = emparejarPantalla(segmentos);
  if (!pantalla) return errorApp('Esto no existe.', 404);

  const entrada: Record<string, string> = { ...pantalla.params };
  for (const clave of pantalla.busqueda) {
    const valor = request.nextUrl.searchParams.get(clave);
    if (valor !== null) entrada[clave] = valor.slice(0, 200);
  }

  const datos = await CARGAS[pantalla.nombre](entrada as never);
  return {
    pantalla: pantalla.nombre,
    datos: datos.ctx ? { ...datos, ctx: ctxParaLaApp(datos.ctx) } : datos,
  };
});
