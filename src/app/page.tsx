import Link from 'next/link';
import type { Metadata } from 'next';
import {
  HandHeart,
  Inbox,
  Lock,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { totalEnDirectorio } from '@/lib/iglesias/directorio';
import { Button } from '@/components/ui/button';

/**
 * La portada.
 *
 * A QUIÉN LE HABLA
 * ----------------
 * Al pastor, que es quien decide y quien paga. El miembro que llega buscando su
 * congregación tiene su camino, pero secundario: partir la portada en dos
 * mitades simétricas suena justo y no convence a ninguno de los dos.
 *
 * SOLO SE PROMETE LO QUE EXISTE
 * -----------------------------
 * Nada de eventos, finanzas, asistencias ni app móvil: están en la v2 y
 * anunciarlos aquí es firmar una deuda que alguien va a venir a cobrar la
 * primera semana. Lo que se cuenta abajo se puede abrir y usar hoy.
 *
 * Y no se pone precio. Está en variables de entorno porque todavía no está
 * validado, así que ponerlo en la portada obligaría a desplegar cada vez que
 * cambie —y va a cambiar varias veces.
 *
 * ISR de una hora: lo único dinámico es el recuento de iglesias del directorio,
 * y ese número no necesita estar al segundo.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: 'Hatril · El fichero de tu iglesia, ordenado',
  },
  description:
    'Lleva los miembros y los ministerios de tu congregación sin hojas de cálculo sueltas. Con la web pública de tu iglesia incluida.',
};

export default async function HomePage() {
  /*
   * EL CONTADOR NO PUEDE TUMBAR EL DESPLIEGUE
   *
   * Esta página es estática con ISR, así que Next la PRERENDERIZA al construir.
   * Dentro del contenedor de Docker no existe `DATABASE_URL` —es una variable
   * de ejecución, no de compilación— y `withAnon` lanza al no encontrarla. El
   * build entero se caía con «Export encountered an error on /page: /», y en
   * local no se veía porque ahí sí está el `.env.local`.
   *
   * Que un número decorativo impida desplegar es desproporcionado: se traga el
   * fallo y se pinta la portada sin él. En la primera revalidación, con la
   * variable ya presente, aparece.
   */
  let iglesias: number | null = null;

  try {
    iglesias = await totalEnDirectorio();
  } catch (err) {
    console.warn('[portada] no se pudo contar el directorio', err);
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-5 py-3.5 md:px-8">
          <span className="text-[17px] font-extrabold tracking-[-0.02em]">
            Hatril
          </span>
          <span className="flex-1" />
          <Link
            href="/iglesias"
            className="text-[14px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            Buscar mi iglesia
          </Link>
          <Button variant="outline" size="sm" render={<Link href="/acceso" />}>
            Entrar
          </Button>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto flex max-w-[1100px] flex-col gap-10 px-5 py-14 md:px-8 md:py-20 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-6">
          <span className="t-micro">Para iglesias de España y Colombia</span>

          <h1 className="t-display text-balance">
            Más tiempo con las personas, menos con el desorden.
          </h1>

          <p className="max-w-[520px] text-pretty text-[17px] leading-relaxed text-muted-foreground">
            El fichero de tu congregación, sus ministerios y quién sirve en cada
            uno, en un sitio al que llega tu equipo desde el móvil. Con la página
            pública de tu iglesia incluida.
          </p>

          {/* El ÚNICO botón naranja de la pantalla. La regla del sistema de
              diseño no es estética: si hay dos, ninguno es el importante. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" render={<Link href="/registro" />}>
              Crea la de tu iglesia
            </Button>
            <Button variant="ghost" size="lg" render={<Link href="/iglesias" />}>
              Ver iglesias
            </Button>
          </div>

          <p className="text-[13.5px] text-muted-foreground">
            Se empieza con un periodo de prueba. No hace falta tarjeta para
            registrarse.
          </p>
        </div>

        {/*
         * En vez de una captura de pantalla, la promesa concreta.
         *
         * Una captura envejece con cada cambio de la interfaz y hay que
         * mantenerla; además, ninguna de las pantallas está aún diseñada para
         * salir en una portada. Esto dice lo mismo y no caduca.
         */}
        <aside className="w-full flex-none lg:w-[400px]">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
            <span className="t-micro">Lo que dejas de hacer</span>
            <ul className="flex flex-col gap-3.5">
              {[
                'Buscar un teléfono en tres hojas de cálculo distintas.',
                'Preguntar por el grupo quién queda en el equipo de alabanza.',
                'Escribir a mano la lista de quien pidió unirse el domingo.',
                'Explicar a la gente nueva dónde y a qué hora os reunís.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-[7px] size-1.5 flex-none rounded-full bg-support" />
                  <span className="text-pretty text-[15px] leading-relaxed">
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-[1100px] gap-px overflow-hidden px-5 py-14 md:grid-cols-2 md:px-8 md:py-16 lg:grid-cols-4">
          <Bloque
            Icono={Users}
            titulo="El fichero, al día"
            texto="Cada persona con su ficha, su situación y cómo localizarla. Con buscador y filtros, para dejar de mantener listas en paralelo."
          />
          <Bloque
            Icono={HandHeart}
            titulo="Ministerios de verdad"
            texto="Cada equipo con su responsable, sus colíderes y quién sirve. El líder lleva el suyo sin que le abras la congregación entera."
          />
          <Bloque
            Icono={Inbox}
            titulo="Quien quiere entrar"
            texto="Pide unirse desde tu página, tú lo apruebas y entra en el fichero. Sin apuntar nombres en el móvil a la salida del culto."
          />
          <Bloque
            Icono={ShieldCheck}
            titulo="Tú repartes el acceso"
            texto="Secretaría, líderes, tesorero. Cada uno ve lo que le corresponde y ni una fila más, y lo decides tú persona a persona."
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[1100px] px-5 py-14 md:px-8 md:py-20">
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 md:p-9 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground">
              <Lock className="size-3.5" strokeWidth={2} />
              Lo que más nos ha costado
            </span>

            <h2 className="t-titulo text-balance">
              Los datos de tu iglesia no pueden alcanzar a otra. Y lo impide la
              base de datos, no nuestra buena intención.
            </h2>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3.5 text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
            <p>
              Saber que alguien pertenece a una congregación dice algo de sus
              creencias, y la ley lo protege igual que un dato de salud. Una fuga
              entre iglesias no sería un fallo a corregir el lunes: sería una
              brecha que hay que notificar.
            </p>
            <p>
              Por eso el aislamiento no está en el código de la aplicación, donde
              un descuido lo salta, sino en la propia base de datos: aunque la
              aplicación pidiera por error los miembros de otra congregación, la
              base devuelve cero filas.
            </p>
            <p>
              Se comprueba en cada cambio con una batería de pruebas dedicada a
              eso solo.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-5 px-5 py-14 md:items-center md:px-8 md:py-16 md:text-center">
          <h2 className="t-titulo text-balance md:max-w-[620px]">
            ¿Buscas tu propia iglesia?
          </h2>
          <p className="max-w-[520px] text-pretty text-[16px] leading-relaxed text-muted-foreground">
            {iglesias === null
              ? 'Busca tu congregación en el directorio, mira sus horarios y pide unirte.'
              : iglesias === 0
                ? 'Todavía no hay ninguna congregación publicada en el directorio. Si la tuya usa Hatril, pídele su enlace.'
                : iglesias === 1
                  ? 'Hay una congregación publicada en el directorio. Búscala, mira sus horarios y pide unirte.'
                  : `Hay ${iglesias} congregaciones publicadas en el directorio. Busca la tuya, mira sus horarios y pide unirte.`}
          </p>
          <Button variant="outline" render={<Link href="/iglesias" />}>
            Ir al directorio
          </Button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-[13.5px] text-muted-foreground md:px-8">
          <span className="font-semibold text-foreground">Hatril</span>
          <Link href="/iglesias" className="no-underline hover:underline">
            Directorio
          </Link>
          <Link href="/privacidad" className="no-underline hover:underline">
            Privacidad
          </Link>
          <Link href="/terminos" className="no-underline hover:underline">
            Términos
          </Link>
          <span className="flex-1" />
          <span>Hecho en Tenerife</span>
        </div>
      </footer>
    </div>
  );
}

function Bloque({
  Icono,
  titulo,
  texto,
}: {
  Icono: LucideIcon;
  titulo: string;
  texto: string;
}) {
  // La rejilla de arriba usa `gap-px` sobre el borde para que las separaciones
  // sean líneas de 1px continuas, que es como se hace la profundidad aquí. Sin
  // sombras y sin tarjetas flotando.
  return (
    <div className="flex flex-col items-start gap-3 bg-surface px-0 py-5 md:px-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-background text-support">
        <Icono className="size-5" strokeWidth={1.7} />
      </span>
      <h3 className="t-subtitulo text-balance">{titulo}</h3>
      <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
        {texto}
      </p>
    </div>
  );
}
