import type { ReactNode } from 'react';
import { ArrowLeft, ExternalLink, HandHeart, LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { AvatarPersona } from '@/components/avatar-persona';
import { Campana } from '@/components/campana';
import { Logo } from '@/components/marca/logo';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RespuestaCampana } from '@/lib/app-api/miembro';
import { cn } from '@/lib/utils';
import { pedir } from '@movil/lib/api';
import { WEB_URL } from '@movil/lib/entorno';
import { abrirFuera } from '@movil/lib/fuera';
import { salir } from '@movil/lib/salir';
import { useSesion, useYo } from '@movil/lib/sesion';

/**
 * La cabecera de las pantallas de la app: la de `CabeceraMiembro`
 * (`src/app/mi/_components/cabecera-miembro.tsx`), pegajosa, con el glaseado
 * y el borde de 1 px, sin sombra. Las mismas piezas y en el mismo orden: el
 * logo de la iglesia, el título, «Dar», la campana y el avatar.
 *
 * Tres diferencias, las tres de la app:
 *
 *   - «Dar» se abre SIEMPRE fuera, en el navegador (norma 3.2.2 de Apple; en
 *     la web eso lo decidía `EnlaceADar` mirando el User-Agent).
 *   - El menú de la cuenta no es `MenuCuenta`, que lleva al panel dentro de la
 *     web: aquí «Abrir el panel» abre hatril.com en el navegador del teléfono.
 *   - El logo es un `<img>`: `next/image` no existe fuera de Next.
 */
export function CabeceraApp({
  titulo,
  subtitulo,
  volver,
  marca = false,
  campana = true,
  logoUrl,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: string;
  /** El logotipo de Hatril en vez del título: la sala de espera. */
  marca?: boolean;
  campana?: boolean;
  logoUrl?: string | null;
  children?: ReactNode;
}) {
  const { data: yo } = useYo();
  const { session } = useSesion();
  const conIglesia = yo?.situacion === 'iglesia';

  const avisos = useQuery({
    queryKey: ['avisos', 'campana', session?.user.id],
    queryFn: () => pedir<RespuestaCampana>('/mi/campana'),
    enabled: campana && !!session && conIglesia,
  });

  // «Dar» solo en las pantallas de primer nivel, como en la web: en una ficha
  // con flecha de volver le quitaría sitio al título.
  const primerNivel = !volver && !marca;
  const dar = primerNivel && conIglesia ? yo?.dar : null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background pt-[env(safe-area-inset-top)] supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-xl">
      <div className="mx-auto flex max-w-[620px] items-center gap-3 px-4 py-3 sm:px-5">
        {volver && (
          <Link
            to={volver}
            aria-label="Volver"
            className="flex size-9 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
          </Link>
        )}

        {logoUrl && (
          // `next/image` no existe fuera de Next: en la app, un `<img>`.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-9 flex-none rounded-lg border border-border bg-surface object-cover" />
        )}

        {marca ? (
          <Logo variante="logotipo" tamano={22} />
        ) : (
          <span className="flex min-w-0 flex-col">
            <h1 className="truncate text-[15.5px] leading-tight font-extrabold tracking-[-0.02em]">{titulo}</h1>
            {subtitulo && (
              <span className="truncate text-[12.5px] leading-tight text-muted-foreground">{subtitulo}</span>
            )}
          </span>
        )}

        <div className="ml-auto flex flex-none items-center gap-2">
          {children}

          {dar && yo?.iglesia && (
            <BotonDar slug={yo.iglesia.slug} conTarjeta={dar.conTarjeta} compacto={Boolean(children)} />
          )}

          {campana && avisos.data && <Campana avisos={avisos.data.avisos} sinLeer={avisos.data.sinLeer} />}

          {yo && (
            <Popover>
              <PopoverTrigger
                className="flex flex-none cursor-pointer rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/20"
                aria-label="Tu cuenta"
              >
                <AvatarPersona nombre={yo.cuenta.nombre} fotoUrl={yo.cuenta.fotoUrl} />
              </PopoverTrigger>

              <PopoverContent className="flex w-[264px] max-w-[calc(100vw-24px)] flex-col">
                <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
                  <span className="truncate text-[14px] font-bold tracking-[-0.01em]">{yo.cuenta.nombre}</span>
                  <span className="truncate text-[12.5px] text-muted-foreground">{yo.cuenta.email}</span>
                </div>

                {/* «Mi cuenta» es la única puerta a borrar la cuenta, a los
                    bloqueos y a lo que se ha dado, y Apple exige poder borrar
                    la cuenta desde dentro de la app (norma 5.1.1(v)). Desde
                    que la barra de abajo perdió su pestaña «Mi cuenta», el
                    camino era este menú; en la web lleva a `/panel/cuenta`,
                    que a un miembro raso le rebota a `/mi`. */}
                {conIglesia && (
                  <div className="flex flex-col p-1">
                    <Link
                      to="/mi/cuenta"
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground"
                    >
                      <UserRound className="size-[16px] flex-none" strokeWidth={1.7} />
                      Mi cuenta
                    </Link>
                  </div>
                )}

                {yo.panel && (
                  <div className={'flex flex-col p-1 ' + (conIglesia ? 'border-t border-border' : '')}>
                    <button
                      type="button"
                      onClick={() => abrirFuera(yo.panel!)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground"
                    >
                      <ExternalLink className="size-[16px] flex-none" strokeWidth={1.7} />
                      Abrir el panel
                    </button>
                  </div>
                )}

                <div className={'p-1 ' + (yo.panel || conIglesia ? 'border-t border-border' : '')}>
                  <button
                    type="button"
                    onClick={() => void salir()}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground"
                  >
                    <LogOut className="size-[16px] flex-none" strokeWidth={1.7} />
                    Cerrar sesión
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * «Dar», como en la web: con la palabra, de contorno, alto 36. Con tarjeta,
 * a la página de dar de la iglesia, fuera de la app. Solo con transferencia
 * no hay página: a la cuenta del banco de Mi cuenta, que no es cobrar y se
 * queda dentro.
 */
function BotonDar({ slug, conTarjeta, compacto }: { slug: string; conTarjeta: boolean; compacto: boolean }) {
  const clases = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'gap-1.5 px-3',
    compacto && 'max-sm:w-9 max-sm:px-0',
  );
  const cuerpo = (
    <>
      <HandHeart className="size-4" strokeWidth={1.8} aria-hidden />
      <span className={compacto ? 'max-sm:sr-only' : undefined}>Dar</span>
    </>
  );
  if (!conTarjeta) {
    return (
      <Link to="/mi/cuenta#ofrendar" className={clases}>
        {cuerpo}
      </Link>
    );
  }
  return (
    <a href={`${WEB_URL}/i/${slug}/dar`} target="_blank" rel="noopener" className={clases}>
      {cuerpo}
    </a>
  );
}
