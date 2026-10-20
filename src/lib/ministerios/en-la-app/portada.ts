import 'server-only';

import type { UserContext } from '@/lib/auth/user-context';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';
import type { ModuloMinisterio } from '@/lib/ministerios/modulos';
import { captureException } from '@/lib/observability';
import type { ModuloEnLaApp, ResumenDeModulo } from './contrato';
import { modulosDeLaPortada } from './registro';
import { RAIZ_APP } from './rutas';

export type TarjetaDePortada = {
  modulo: ModuloMinisterio;
  /** A dónde lleva su enlace: la pantalla de la app, o la del panel. */
  href: string;
  /** El texto de ese enlace. */
  abrir: string;
  /**
   * Lo que trae el adaptador. `null` en dos casos que se pintan distinto: el
   * módulo no tiene adaptador todavía (`sinAdaptador`) o lo tiene y ha fallado.
   */
  resumen: ResumenDeModulo | null;
  sinAdaptador: boolean;
};

function destinoDe(
  ministerioId: string,
  modulo: ModuloMinisterio,
  app: ModuloEnLaApp | null,
): string {
  return app?.pantalla === 'app'
    ? `${RAIZ_APP}/${ministerioId}/${modulo.id}`
    : `/panel/ministerios/${ministerioId}/${modulo.id}`;
}

/**
 * Las tarjetas de la portada de un ministerio, ya resueltas.
 *
 * UN ADAPTADOR QUE FALLA NO SE LLEVA LA PORTADA
 * ---------------------------------------------
 * Con `allSettled` y no `all`. Los adaptadores los escriben ramas distintas, y
 * la portada es lo primero que abre el líder: que el resumen del reparto lance
 * no puede dejarle sin ver los turnos del domingo. La tarjeta que falla sale
 * diciendo que no se ha podido cargar, con su enlace, y el error va a Sentry —
 * no se traga en silencio—.
 */
export async function tarjetasDeLaPortada(
  ctx: UserContext,
  ministerio: MinisterioDetalle,
  hoy: string,
): Promise<TarjetaDePortada[]> {
  const modulos = modulosDeLaPortada(ctx, ministerio.modulos);

  const resueltos = await Promise.allSettled(
    modulos.map(({ app }) =>
      app ? app.resumen(ctx, ministerio, hoy) : Promise.resolve(null),
    ),
  );

  return Promise.all(
    modulos.map(async ({ modulo, app }, i) => {
      const r = resueltos[i]!;
      if (r.status === 'rejected') {
        await captureException(r.reason, {
          donde: 'portada del líder',
          modulo: modulo.id,
          ministerioId: ministerio.id,
        });
      }

      return {
        modulo,
        href: destinoDe(ministerio.id, modulo, app),
        abrir: app?.abrir ?? 'Abrir en el panel',
        resumen: r.status === 'fulfilled' ? r.value : null,
        sinAdaptador: app === null,
      };
    }),
  );
}

/** Cuántas cosas piden atención en total, para la cabecera y la lista. */
export function totalPendientes(tarjetas: TarjetaDePortada[]): number {
  return tarjetas.reduce(
    (n, t) =>
      n + (t.resumen ? t.resumen.pendientes.length + (t.resumen.restantes ?? 0) : 0),
    0,
  );
}
