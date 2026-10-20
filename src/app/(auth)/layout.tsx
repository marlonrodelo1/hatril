import Link from 'next/link';
import { Lock } from 'lucide-react';

import { Logo } from '@/components/marca/logo';
import { isNativeApp } from '@/lib/platform/is-native-app';

/**
 * Marco de las pantallas de acceso, registro y recuperación.
 *
 * ES LA PRIMERA PANTALLA DE LA APP
 * --------------------------------
 * La app nativa arranca en `/mi`, y sin sesión eso es `/acceso`. Así que esto
 * se diseña para un móvil de 375 px antes que para un ordenador: el símbolo
 * arriba con aire, el título, el formulario en una tarjeta blanca y los
 * legales al pie. En escritorio se añade a la izquierda una columna de marca.
 *
 * Sin fotos de archivo ni ilustraciones. Con el «lo que NO quiero» del brief
 * (nada de estética genérica de SaaS con IA, nada de dibujos tipo undraw), lo
 * que hace la pantalla es la letra, el espacio y la marca.
 *
 * LAS ZONAS SEGURAS DEL TELÉFONO
 * ------------------------------
 * El relleno suma `env(safe-area-inset-*)`: la muesca arriba, la barra de
 * inicio abajo y los lados en horizontal. Hoy esos valores son 0 —el viewport
 * no pide `viewport-fit=cover` y la barra de estado de la app no se monta
 * encima de la web—, así que no cambia nada. Está para que el día que la app
 * pinte de borde a borde (Android 16 ya lo exige a las apps nativas) el logo
 * no quede debajo de la hora ni los legales debajo de la barra de gestos.
 *
 * EL LOGO NO ES UN ENLACE DENTRO DE LA APP
 * ----------------------------------------
 * En la web lleva a la portada. En la app la portada es publicidad para
 * pastores y no pinta nada (ver `capacitor.config.ts`): un toque sin querer en
 * el logo sacaría a la persona del acceso a una página que no es para ella.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const enApp = await isNativeApp();

  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      {/* Columna de marca, desde lg. En un móvil le roba la pantalla entera
          al formulario, que es a lo que se viene. Blanca y con borde, como
          una tarjeta a toda altura: el carbón de antes era el único bloque
          oscuro de la aplicación desde que volvió al claro.

          Pegada y a la altura de la ventana: con el registro, que mide el
          doble que la pantalla, la columna se estiraba con él y la frase
          acababa a media página, lejos del logo y del pie. */}
      <aside className="hidden flex-col justify-between border-r border-border bg-surface px-12 py-12 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[44%] lg:self-start xl:w-[40%] xl:px-16">
        <Marca enApp={enApp}>
          <Logo variante="logotipo" tamano={44} />
        </Marca>

        <div className="flex max-w-[30rem] flex-col gap-8">
          <div className="flex flex-col gap-4">
            <p className="text-figure leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
              Más tiempo con las personas, menos con el desorden.
            </p>
            <p className="max-w-[46ch] text-body leading-relaxed text-pretty text-muted-foreground">
              Pensado para equipos pastorales que llevan la iglesia entre hojas
              de cálculo y grupos de WhatsApp.
            </p>
          </div>

          {/* Lo que hay dentro, en tres renglones y sin iconos: el bloque de
              iconos de plantilla es justo lo que el inventario le reprocha a
              la portada (A17). Solo lo que existe y se puede abrir hoy. */}
          <dl className="flex flex-col border-t border-border">
            {LO_QUE_HAY.map(({ que, detalle }) => (
              <div
                key={que}
                className="flex flex-col gap-0.5 border-b border-border py-3.5"
              >
                <dt className="text-body font-semibold">{que}</dt>
                <dd className="text-label text-muted-foreground">{detalle}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="flex max-w-[46ch] items-start gap-2.5 text-label text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden />
          Tus datos y los de tu congregación están cifrados y alojados en la
          Unión Europea.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] sm:pt-[calc(4rem+env(safe-area-inset-top))]">
        {/* En el teléfono, anclado arriba: al pasar de «Entrar» a «Recuperar»
            el logo se queda en el mismo sitio en vez de saltar según lo que
            mida cada formulario. Desde `sm`, centrado.

            Y `my-auto` y no `justify-center`: con el registro, que es más
            alto que la pantalla, centrar con justify deja la parte de arriba
            fuera de alcance, por encima del borde, sin forma de desplazarse
            hasta ella. El margen automático se queda en 0 cuando no cabe. */}
        <main className="mx-auto flex w-full max-w-[400px] flex-col gap-7 sm:my-auto">
          <div className="flex justify-center lg:hidden">
            <Marca enApp={enApp}>
              <Logo variante="simbolo" tamano={56} />
            </Marca>
          </div>
          {children}
        </main>

        {/* En el teléfono el pie baja hasta el borde (`mt-auto`); desde `sm`
            lo empuja el `my-auto` del formulario, y otro margen automático
            aquí le robaría un tercio del hueco y lo descentraría. */}
        <footer className="mx-auto mt-12 flex w-full max-w-[400px] flex-col max-sm:mt-auto max-sm:pt-12 items-center gap-2.5 text-label text-muted-foreground">
          <p className="flex items-center gap-1.5 lg:hidden">
            <Lock className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
            Datos cifrados y alojados en la Unión Europea
          </p>
          <nav aria-label="Legal" className="flex items-center gap-1">
            <Link
              href="/privacidad"
              className="rounded-sm px-2 py-1 text-muted-foreground no-underline outline-offset-2 hover:text-foreground hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Privacidad
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/terminos"
              className="rounded-sm px-2 py-1 text-muted-foreground no-underline outline-offset-2 hover:text-foreground hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Términos
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

const LO_QUE_HAY = [
  {
    que: 'El fichero de la congregación',
    detalle: 'Miembros y ministerios, ordenados y a salvo.',
  },
  {
    que: 'Los equipos que sirven',
    detalle: 'Turnos, repertorio y reuniones de cada ministerio.',
  },
  {
    que: 'La iglesia en el móvil',
    detalle: 'El muro, la agenda y el devocional de cada día.',
  },
];

/** El logo enlaza a la portada en la web y se queda quieto en la app. */
function Marca({
  enApp,
  children,
}: {
  enApp: boolean;
  children: React.ReactNode;
}) {
  if (enApp) return children;

  return (
    <Link
      href="/"
      aria-label="Hatril, ir a la portada"
      className="inline-flex rounded-lg no-underline outline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
