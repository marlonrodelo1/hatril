import {
  CAMPO_ARGS,
  CAMPO_ID,
  campoDeForm,
  type RespuestaAccion,
} from '@/lib/app-api/accion';
import { ErrorApi, pedirFormulario } from './api';
import { clienteQuery } from './cliente-query';

/**
 * Llamar a una server action de la web desde la app.
 *
 * Los componentes del área del miembro que la app reaprovecha importan sus
 * actions (`../actions`). Al compilar la app, cada uno de esos módulos se
 * sustituye por otro con las mismas funciones que llaman aquí
 * (`movil/vite.config.ts`, el plugin `accionesDeLaWeb`), y esto las ejecuta
 * en el servidor con `POST /api/v1/app/accion` (`src/lib/api/acciones-app.ts`).
 *
 * Lo que hace Next tras una action, aquí:
 *
 *   - `revalidatePath`: se invalida toda la caché, y cada pantalla abierta
 *     vuelve a pedir sus datos. Es más de lo estrictamente necesario, pero es
 *     lo que no se equivoca nunca.
 *   - `redirect()`: se navega a esa ruta. Los errores de las actions viajan
 *     como `?error=` en ella, y la pantalla los enseña como en la web.
 */
type Navegar = (ruta: string) => void;
let navegar: Navegar | null = null;

/** Lo registra el marco de la app (`../raiz.tsx`), que tiene el router. */
export function registrarNavegador(fn: Navegar | null): void {
  navegar = fn;
}

export async function llamarAccion(id: string, args: unknown[]): Promise<unknown> {
  const cuerpo = new FormData();
  cuerpo.set(CAMPO_ID, id);

  let formularios = 0;
  const serializados = args.map((a) => {
    if (a instanceof FormData) {
      const n = formularios++;
      for (const [campo, valor] of a.entries()) cuerpo.append(campoDeForm(n, campo), valor);
      return { __fd: n };
    }
    return a ?? null;
  });
  cuerpo.set(CAMPO_ARGS, JSON.stringify(serializados));

  let respuesta: RespuestaAccion;
  try {
    respuesta = await pedirFormulario<RespuestaAccion>('/accion', cuerpo);
  } catch (e) {
    // Lo que en la web habría sido una página de error: aquí, el mensaje en
    // la pantalla en la que se estaba, como hacen las actions con `?error=`.
    const mensaje = e instanceof ErrorApi ? e.message : 'Algo ha fallado. Inténtalo de nuevo.';
    const aqui = new URL(window.location.href);
    aqui.searchParams.set('error', mensaje);
    navegar?.(`${aqui.pathname}${aqui.search}`);
    return undefined;
  }

  await clienteQuery.invalidateQueries();

  if ('redirigir' in respuesta) {
    navegar?.(respuesta.redirigir);
    return undefined;
  }
  return respuesta.valor;
}
