import Link from 'next/link';

/**
 * Marco de las pantallas de acceso, registro y recuperación.
 *
 * Dos columnas en escritorio; en móvil se queda solo el formulario. La columna
 * de la izquierda no lleva ilustración ni captura del producto: una frase y el
 * nombre. Con el «lo que NO quiero» del brief (nada de estética genérica de SaaS
 * con IA, nada de ilustraciones tipo undraw), lo honesto es no meter relleno.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh">
      {/* Columna de marca. Oculta por debajo de lg: en un móvil roba la
          pantalla entera al formulario, que es a lo que se viene. */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between bg-support p-12 text-white">
        <Link
          href="/"
          className="text-[17px] font-extrabold tracking-[-0.02em] text-white no-underline hover:no-underline"
        >
          Hatril
        </Link>

        <div className="flex max-w-md flex-col gap-5">
          <p className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em] text-balance">
            Más tiempo con las personas, menos con el desorden.
          </p>
          <p className="text-[15px] leading-relaxed text-white/75 text-pretty">
            Miembros, ministerios y comunidad en un solo sitio. Pensado para
            equipos pastorales que llevan la iglesia entre hojas de cálculo y
            grupos de WhatsApp.
          </p>
        </div>

        <p className="text-[13px] text-white/60">
          Tus datos y los de tu congregación están cifrados y alojados en la
          Unión Europea.
        </p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-10 inline-block text-[17px] font-extrabold tracking-[-0.02em] text-foreground no-underline hover:no-underline lg:hidden"
          >
            Hatril
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
