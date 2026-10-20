import 'server-only';

import type { UserContext } from '@/lib/auth/user-context';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';
import { captureException } from '@/lib/observability';
import type {
  ModoEnElEquipo,
  ModuloEnLaApp,
  PiezaDeLaPortada,
  ResumenDeModulo,
} from './contrato';
import { derivadasDeLaPortada, modulosDeLaPortada } from './registro';
import { RAIZ_APP } from './rutas';

/** Lo que la portada necesita de un adaptador, sea de módulo o derivado. */
type Adaptador = Pick<ModuloEnLaApp, 'abrir' | 'pantalla' | 'resumen' | 'participante'>;

export type TarjetaDePortada = {
  /** El módulo del catálogo, o la herramienta derivada (el fondo). */
  modulo: PiezaDeLaPortada;
  /**
   * El enlace del pie: la herramienta del líder, la pantalla del panel de un
   * módulo sin adaptador, o lo que diga la vista del participante. `null`, sin
   * pie.
   */
  enlace: { texto: string; href: string } | null;
  /**
   * Lo que trae el adaptador. `null` en dos casos que se pintan distinto: el
   * módulo no tiene adaptador todavía (`sinAdaptador`) o lo tiene y ha fallado.
   */
  resumen: ResumenDeModulo | null;
  sinAdaptador: boolean;
};

/** El pie de la tarjeta del líder: su herramienta en la app, o en el panel. */
function herramientaDe(
  ministerioId: string,
  modulo: PiezaDeLaPortada,
  app: Adaptador | null,
): { texto: string; href: string } {
  return app?.pantalla === 'app'
    ? { texto: app.abrir, href: `${RAIZ_APP}/${ministerioId}/${modulo.id}` }
    : {
        texto: app?.abrir ?? 'Abrir en el panel',
        href: `/panel/ministerios/${ministerioId}/${modulo.id}`,
      };
}

/**
 * Las tarjetas de la portada de un ministerio, ya resueltas, para quien lo
 * lleva o para quien participa en él.
 *
 * UN ADAPTADOR QUE FALLA NO SE LLEVA LA PORTADA
 * ---------------------------------------------
 * Con `allSettled` y no `all`. Los adaptadores los escriben ramas distintas, y
 * la portada es lo primero que se abre: que el resumen del reparto lance no
 * puede dejar a nadie sin ver los turnos del domingo. La tarjeta que falla sale
 * diciendo que no se ha podido cargar, con su enlace, y el error va a Sentry —
 * no se traga en silencio—.
 */
export async function tarjetasDeLaPortada(
  ctx: UserContext,
  ministerio: MinisterioDetalle,
  hoy: string,
  modo: ModoEnElEquipo,
): Promise<TarjetaDePortada[]> {
  const modulos: { modulo: PiezaDeLaPortada; app: Adaptador | null }[] = [
    ...modulosDeLaPortada(ctx, ministerio.modulos, modo, ministerio.id),
    ...derivadasDeLaPortada(ctx, ministerio, modo).map((h) => ({ modulo: h, app: h })),
  ];

  const resueltos = await Promise.allSettled(
    modulos.map(({ app }) => {
      if (!app) return Promise.resolve(null);
      // `modulosDeLaPortada` solo deja pasar al participante los que declaran
      // su vista, así que aquí `participante` existe.
      return modo === 'participante'
        ? app.participante!(ctx, ministerio, hoy)
        : app.resumen(ctx, ministerio, hoy);
    }),
  );

  return Promise.all(
    modulos.map(async ({ modulo, app }, i) => {
      const r = resueltos[i]!;
      if (r.status === 'rejected') {
        await captureException(r.reason, {
          donde: `portada del equipo (${modo})`,
          modulo: modulo.id,
          ministerioId: ministerio.id,
        });
      }
      const resumen = r.status === 'fulfilled' ? r.value : null;

      return {
        modulo,
        enlace:
          modo === 'participante'
            ? (resumen?.enlace ?? null)
            : herramientaDe(ministerio.id, modulo, app),
        resumen,
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
