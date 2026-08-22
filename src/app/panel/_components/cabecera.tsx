import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { flagsDelMenu } from '@/lib/panel/menu';
import { esPastor, ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { listarNotificaciones, sinLeer } from '@/lib/notificaciones/consultas';
import { paraLaCampana } from '@/lib/notificaciones/campana';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { iniciales } from '@/lib/format/iniciales';
import { miFotoDePerfil } from '@/lib/miembros/foto';
// Las dos viven en `src/components` y no aquí al lado: las comparte la cabecera
// del área del miembro, que no puede importar de la carpeta privada del panel.
import { Campana } from '@/components/campana';
import { MenuCuenta } from '@/components/menu-cuenta';
import { MenuMovil } from './menu-movil';

/**
 * La cabecera de cualquier pantalla del panel.
 *
 * POR QUÉ UNA SOLA Y NO VEINTICUATRO
 * ----------------------------------
 * Cada página se pintaba su propio `<header>` y habían salido cuatro variantes
 * distintas del mismo patrón: con botón a la derecha apilando en `md:`, con
 * botón en `flex-wrap`, con enlace de «volver» encima del título, y sin nada.
 * Mientras solo hubiera un título dentro daba igual; en cuanto hay que meter la
 * campana y el menú de cuenta en todas, cuatro variantes son cuatro sitios
 * donde olvidarlo.
 *
 * NO PIDE `ctx` COMO PROP, Y ES A PROPÓSITO
 * -----------------------------------------
 * Lo resuelve ella con `requireIglesia()`. Podría recibirlo de la página —todas
 * lo tienen— pero eso son veinticuatro llamadas que pasar y veinticuatro sitios
 * donde equivocarse. Sale gratis porque `getCurrentUserContext` y
 * `flagsDelMenu` están envueltos en `cache()` de React: dentro del mismo render
 * la página, el layout y esta cabecera comparten una única ejecución.
 *
 * Lo que sí cuesta son las dos consultas de avisos. Antes el layout hacía una
 * (`sinLeer`) en cada carga para el número del menú lateral; ahora son esa y la
 * lista corta que se pinta dentro del desplegable. Las dos van por índice.
 */
export async function CabeceraPanel({
  titulo,
  subtitulo,
  volver,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Migas para las pantallas de detalle y formulario. */
  volver?: { href: string; texto: string };
  /** Las acciones de ESTA pantalla: «Crear evento», «Añadir miembro»… */
  children?: React.ReactNode;
}) {
  const ctx = await requireIglesia();
  const flags = await flagsDelMenu(ctx);

  const [avisos, pendientes, miFoto] = await Promise.all([
    listarNotificaciones(ctx.user.id),
    sinLeer(ctx),
    // La foto de quien mira. Va en el mismo Promise.all que los avisos: es
    // una consulta más y no tiene por qué esperar a las otras dos.
    miFotoDePerfil(ctx),
  ]);

  const nombre = nombreDeLaCuenta(ctx.user);

  const acciones = (
    <>
      <Campana avisos={paraLaCampana(avisos)} sinLeer={pendientes} />
      <MenuCuenta
        nombre={nombre}
        correo={ctx.user.email ?? ''}
        rol={ETIQUETAS_ROLES[ctx.rol].titulo}
        fotoUrl={miFoto}
        esPastor={esPastor(ctx)}
      />
    </>
  );

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-border bg-surface px-4 py-3 md:flex-nowrap md:gap-x-6 md:px-8 md:py-4">
      <MenuMovil
        flags={flags}
        iglesiaNombre={ctx.iglesia.nombre}
        iglesiaCiudad={ctx.iglesia.ciudad}
        iniciales={iniciales(ctx.iglesia.nombre)}
        logoUrl={ctx.iglesia.logoUrl}
        webIglesia={ctx.iglesia.webPublica ? `/i/${ctx.iglesia.slug}` : null}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {volver && (
          <Link
            href={volver.href}
            className="-ml-1 inline-flex w-fit items-center gap-0.5 text-[13px] text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            <ChevronLeft className="size-4" strokeWidth={1.9} />
            {volver.texto}
          </Link>
        )}

        <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.025em] md:text-[22px]">
          {titulo}
        </h1>

        {subtitulo && (
          <p className="truncate text-[13px] text-muted-foreground">
            {subtitulo}
          </p>
        )}
      </div>

      {/*
       * Las acciones de la pantalla saltan a una segunda fila en móvil
       * (`w-full order-last`) y vuelven a su sitio en escritorio. Antes esto se
       * resolvía pintando DOS bloques, uno `md:hidden` y otro `hidden md:flex`,
       * y eso metía la campana y el menú de cuenta duplicados en el DOM: dos
       * popovers, dos disparadores con el mismo `aria-label` y el doble de
       * trabajo de hidratación para que solo uno se viera nunca.
       */}
      {children && (
        <div className="order-last flex w-full flex-none items-center gap-2 md:order-none md:w-auto md:gap-3">
          {children}
        </div>
      )}

      <div className="flex flex-none items-center gap-1">{acciones}</div>
    </header>
  );
}
