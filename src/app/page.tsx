import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  HandHeart,
  Inbox,
  Lock,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { totalEnDirectorio } from '@/lib/iglesias/directorio';
import { Logo } from '@/components/marca/logo';
import { buttonVariants } from '@/components/ui/button';
import {
  Maqueta,
  MarcoMovil,
  MarcoNavegador,
  PantallaAgenda,
  PantallaInicioPanel,
  PantallaMuro,
  PantallaTurnos,
  PiezaSolicitud,
  PiezaWebPublica,
  PiezaYaDentro,
} from './_portada/maquetas';

/**
 * La portada.
 *
 * LA IDEA, EN UNA LÍNEA
 * ---------------------
 * «La iglesia no se acaba el domingo.» Hatril tiene dos caras —el panel con el
 * que el equipo lleva a la gente y la app con la que cada miembro sigue con su
 * congregación entre semana— y la portada anterior solo contaba la primera, con
 * texto y viñetas. Ahora se ENSEÑA el producto: el panel y el teléfono juntos
 * arriba, y luego una sección para cada cara con su pantalla.
 *
 * A QUIÉN LE HABLA
 * ----------------
 * Sigue siendo el pastor quien decide y quien paga, así que el botón de alta es
 * el único de color y la portada le habla de tú. Pero lo que le convence es ver
 * lo que va a tener su gente en el móvil, y por eso la app sale en el primer
 * vistazo y no al final.
 *
 * EL RITMO: CREMA, BLANCO, CARBÓN
 * -------------------------------
 * Cada sección cambia de fondo para que se lea dónde empieza la siguiente sin
 * sombras ni separadores dibujados: crema (portada), blanco (el pastor), crema
 * (el miembro), blanco (el camino de alguien nuevo), carbón (la protección de
 * los datos) y crema (el cierre). El carbón es el único bloque oscuro, y va en
 * lo que más pesa.
 *
 * SOLO SE PROMETE LO QUE EXISTE
 * -----------------------------
 * Todo lo que se cuenta y se dibuja se puede abrir hoy: el fichero, los
 * ministerios con sus turnos, las solicitudes, la web pública, el muro, el
 * devocional, la agenda, la Biblia y la radio. NO se anuncia la app de las
 * tiendas: no está publicada, y el área del miembro funciona hoy desde el
 * navegador del móvil, que es lo que se dice.
 *
 * Y no se pone precio. Está en variables de entorno porque todavía no está
 * validado, así que ponerlo en la portada obligaría a desplegar cada vez que
 * cambie —y va a cambiar varias veces.
 *
 * EL BOTÓN DORADO SALE DOS VECES, Y NUNCA A LA VEZ
 * ------------------------------------------------
 * La regla es un botón de color por PANTALLA: si hay dos a la vista, ninguno es
 * el importante. Arriba y en el cierre los separan cinco secciones; no
 * coinciden en ningún tamaño de ventana. Y es la misma acción, así que lleva el
 * mismo botón (guía visual, «Botones»). En el dorado y no en el naranja desde
 * el 23-oct, a petición de Marlon; el porqué de la letra oscura, en
 * `--hatril-dorado`.
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
    'Lleva los miembros y los ministerios de tu congregación sin hojas de cálculo sueltas, y dale a cada miembro su iglesia en el móvil: el muro, el devocional, su agenda y la Biblia. Con la web pública de tu iglesia incluida.',
};

/*
 * La escala de cartel de la portada. La guía visual la deja vivir solo aquí y
 * en la web pública (`/i/[slug]`), con `clamp` en vez de escalones: el título
 * crece con la ventana y no salta de golpe al cruzar un punto de corte.
 */
const TITULO_SECCION =
  'text-[clamp(1.875rem,4.4vw,2.75rem)] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance';
const ENTRADILLA =
  'max-w-[540px] text-subtitle leading-relaxed text-pretty text-muted-foreground';

/**
 * El botón de alta. El ÚNICO relleno de color de cada pantalla.
 *
 * Con `cn` y no juntando cadenas: la variante por defecto trae `bg-primary` y
 * hay que QUITARLO, no añadir `bg-dorado` al lado. Con las dos clases, cuál
 * gana lo decide el orden de la hoja de estilos, no el del código.
 */
const BOTON_ALTA = cn(
  buttonVariants({ size: 'lg' }),
  'bg-dorado text-dorado-foreground hover:bg-dorado-hover hover:text-dorado-foreground active:bg-dorado-active',
);

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
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-3.5 md:px-8">
          <Logo variante="logotipo" tamano={22} />
          <span className="flex-1" />
          <Link
            href="/iglesias"
            className="text-label font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            Buscar mi iglesia
          </Link>
          {/* Un enlace pintado de botón, no `<Button render={<Link/>}>`: ver
              «Botones» en `docs/diseno/guia-visual.md`. */}
          <Link href="/acceso" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Entrar
          </Link>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/*
       * LA ESCENA SE APOYA EN EL BORDE DE ABAJO
       *
       * El teléfono no cabe entero ni hace falta: sube desde la línea que cierra
       * la sección y la línea lo corta. Así la portada no crece medio metro en
       * el móvil y se ve lo que importa, el versículo y el muro. Por eso la
       * sección no tiene relleno inferior en la columna de la escena.
       */}
      <section className="overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 pt-12 md:px-8 md:pt-20 lg:grid-cols-[minmax(0,1fr)_600px] lg:gap-10">
          <div className="flex flex-col items-start gap-6 lg:pb-24">
            <span className="t-micro">Para iglesias de España y Colombia</span>

            <h1 className="text-[clamp(2.75rem,6.6vw,4.375rem)] leading-[0.98] font-extrabold tracking-[-0.042em] text-balance">
              La iglesia no se acaba el domingo.
            </h1>

            <p className={ENTRADILLA}>
              Hatril es donde tu congregación sigue unida entre semana. Tu
              equipo lleva a la gente y los ministerios desde el panel, y cada
              miembro tiene a su iglesia en el móvil.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/registro" className={BOTON_ALTA}>
                Crea la de tu iglesia
              </Link>
              <Link
                href="/iglesias"
                className={buttonVariants({ variant: 'ghost', size: 'lg' })}
              >
                Busca la tuya
              </Link>
            </div>

            <p className="text-label text-muted-foreground">
              Se empieza con un periodo de prueba. No hace falta tarjeta para
              registrarse.
            </p>
          </div>

          <EscenaPortada />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-5 py-16 md:px-8 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col items-start gap-5">
              <span className="t-micro">Para el pastor y su equipo</span>
              <h2 className={TITULO_SECCION}>
                Más tiempo con las personas, menos con el desorden.
              </h2>
              <p className={ENTRADILLA}>
                El fichero de la congregación, sus ministerios y quién sirve en
                cada uno, en un solo sitio. Cada líder lleva su equipo sin ver más
                de lo que le toca.
              </p>
            </div>

            <figure className="flex min-w-0 flex-col gap-3">
              <Maqueta etiqueta="Los turnos de Alabanza para el domingo en el panel: dirección y guitarra confirmados, voces sin contestar, el teclado no puede y el bajo sin cubrir.">
                <MarcoNavegador direccion="hatril.com/panel/ministerios">
                  <PantallaTurnos />
                </MarcoNavegador>
              </Maqueta>
              <figcaption className="px-1 text-label text-muted-foreground">
                Se acabó preguntar por el grupo quién queda en el equipo de
                alabanza.
              </figcaption>
            </figure>
          </div>

          {/* En fila de cuatro debajo y no en la columna del título: en dos
              columnas de 250 px cada texto se partía en cinco renglones. */}
          <ul className="grid gap-x-8 gap-y-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <Punto apilado Icono={Users} titulo="El fichero, al día">
              Cada persona con su ficha, su situación y cómo localizarla. Con
              buscador y filtros.
            </Punto>
            <Punto apilado Icono={HandHeart} titulo="Ministerios con su gente">
              Responsable, colíderes, puestos y turnos. Cada cual contesta desde
              su móvil si puede.
            </Punto>
            <Punto apilado Icono={Inbox} titulo="Quien quiere entrar">
              Lo pide desde la página de tu iglesia, lo apruebas y entra en el
              fichero.
            </Punto>
            <Punto apilado Icono={ShieldCheck} titulo="Tú repartes el acceso">
              Secretaría, líderes, tesorería: cada uno ve lo suyo, y lo decides
              persona a persona.
            </Punto>
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-start gap-5 lg:order-2">
            <span className="t-micro">Para cada miembro</span>
            <h2 className={TITULO_SECCION}>
              Y tu gente, con su iglesia en el móvil toda la semana.
            </h2>
            <p className={ENTRADILLA}>
              No es otro grupo de mensajes: es el sitio de su congregación, y
              solo de la suya. Entra con su cuenta desde el navegador del móvil.
            </p>

            <ul className="flex w-full flex-col gap-5 pt-3">
              <Punto Icono={MessagesSquare} titulo="Comunidad">
                El muro de la iglesia: avisos, fotos del domingo y lo que cada
                uno quiera compartir, con moderación.
              </Punto>
              <Punto Icono={BookOpen} titulo="Devocional">
                El del día, escrito por el equipo de la iglesia, con vídeo si lo
                tiene.
              </Punto>
              <Punto Icono={CalendarDays} titulo="Agenda">
                Horarios, eventos y sus turnos en el ministerio. Dice si puede
                con un toque.
              </Punto>
              <Punto Icono={BookMarked} titulo="Biblia">
                La Reina-Valera 1909 entera, para leer y compartir un versículo
                con su cita.
              </Punto>
              <Punto Icono={Radio} titulo="La radio de su iglesia">
                Si la iglesia tiene emisora, suena en directo mientras navega.
              </Punto>
            </ul>
          </div>

          <div className="flex justify-center lg:order-1">
            <Maqueta etiqueta="La agenda de un miembro en el móvil: le toca servir el domingo en Alabanza, con los botones «Ahí estaré» y «No puedo», y lo que tiene el resto de la semana.">
              <MarcoMovil
                barra="agenda"
                className="[zoom:0.74] sm:[zoom:0.8] lg:[zoom:0.82]"
              >
                <PantallaAgenda />
              </MarcoMovil>
            </Maqueta>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 md:px-8 md:py-24">
          <div className="flex max-w-[680px] flex-col items-start gap-5">
            <span className="t-micro">Así llega alguien nuevo</span>
            <h2 className={TITULO_SECCION}>
              De la puerta de la iglesia a su comunidad.
            </h2>
            <p className={ENTRADILLA}>
              La página pública de tu iglesia va incluida, y es la puerta para
              quien todavía no la conoce.
            </p>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            <Paso
              numero={1}
              titulo="Encuentra la iglesia"
              texto="En su página, con los horarios y cómo llegar, o buscándola en el directorio."
            >
              <Maqueta etiqueta="La página pública de Iglesia Betania, con sus horarios y el botón «Quiero ser parte».">
                <PiezaWebPublica />
              </Maqueta>
            </Paso>
            <Paso
              numero={2}
              titulo="Pide entrar, y la iglesia lo aprueba"
              texto="La solicitud llega al panel. Se acabó apuntar nombres en el móvil a la salida del culto."
            >
              <Maqueta etiqueta="Una solicitud en el panel: Nuria Cabrera quiere unirse, con el botón «Aprobar».">
                <PiezaSolicitud />
              </Maqueta>
            </Paso>
            <Paso
              numero={3}
              titulo="Ya es de la casa"
              texto="Entra en el fichero y en el área de miembros: el muro, el devocional y su agenda."
            >
              <Maqueta etiqueta="Una publicación del pastor en el muro dando la bienvenida a Nuria.">
                <PiezaYaDentro />
              </Maqueta>
            </Paso>
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*
       * LA FRANJA CARBÓN
       *
       * El único bloque oscuro de la portada, y va aquí porque es lo que más
       * pesa. El blanco es `secondary-foreground` y el gris, el token
       * `support-muted-foreground`: nada de `text-white/70`.
       *
       * El atril de fondo es la marca, tono sobre tono (`support-hover` sobre
       * `support`): se nota si se mira y no compite con el texto. Es la única
       * vez que la portada usa la marca fuera del logotipo.
       */}
      <section className="relative isolate overflow-hidden bg-support text-secondary-foreground">
        <Logo
          variante="atril"
          tamano={500}
          className="absolute -right-20 -bottom-44 -z-10 text-support-hover md:-right-6 lg:right-[3%]"
        />
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-start gap-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-support-hover bg-support-hover px-3 py-1.5 text-label font-semibold">
              <Lock className="size-3.5" strokeWidth={2} />
              Lo que más nos ha costado
            </span>
            <h2 className={TITULO_SECCION}>
              Los datos de tu iglesia no pueden alcanzar a otra.
            </h2>
            <p className="text-subtitle leading-relaxed font-semibold text-pretty">
              Y lo impide la base de datos, no nuestra buena intención.
            </p>
          </div>

          <div className="flex max-w-[560px] flex-col gap-4 text-body leading-relaxed text-pretty text-support-muted-foreground lg:pt-12">
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
      <section>
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-5 py-16 md:items-center md:px-8 md:py-24 md:text-center">
          <h2 className={TITULO_SECCION}>Empieza por tu iglesia.</h2>
          <p className={`${ENTRADILLA} md:mx-auto`}>
            Créala en unos minutos e invita a tu equipo. Tu gente llegará
            después.
          </p>
          <Link href="/registro" className={BOTON_ALTA}>
            Crea la de tu iglesia
          </Link>
          <p className="max-w-[520px] text-label leading-relaxed text-pretty text-muted-foreground">
            ¿Buscas tu propia iglesia?{' '}
            {iglesias === null
              ? 'Búscala en el directorio, mira sus horarios y pide unirte.'
              : iglesias === 0
                ? 'Todavía no hay ninguna publicada en el directorio. Si la tuya usa Hatril, pídele su enlace.'
                : iglesias === 1
                  ? 'Hay una congregación publicada en el directorio.'
                  : `Hay ${iglesias} congregaciones publicadas en el directorio.`}{' '}
            {iglesias !== 0 && (
              <Link href="/iglesias" className="font-semibold whitespace-nowrap">
                Ir al directorio
              </Link>
            )}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-label text-muted-foreground md:px-8">
          <Logo variante="logotipo" tamano={18} />
          {/* En el móvil los enlaces bajan a su línea y «Hecho en Tenerife» se
              queda arriba, frente al logotipo. A 375 px no caben los cinco en
              una fila, y lo que caía solo a la segunda era justo esa frase. */}
          <div className="order-last flex basis-full flex-wrap gap-x-6 gap-y-2 md:order-none md:basis-auto">
            <Link href="/iglesias" className="no-underline hover:underline">
              Directorio
            </Link>
            <Link href="/privacidad" className="no-underline hover:underline">
              Privacidad
            </Link>
            <Link href="/terminos" className="no-underline hover:underline">
              Términos
            </Link>
          </div>
          <span className="ml-auto">Hecho en Tenerife</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * El panel y el teléfono, juntos: las dos caras de Hatril en el primer vistazo.
 *
 * Las dos maquetas están dibujadas a tamaño real y se encogen con `zoom`, que a
 * diferencia de `transform: scale` también encoge el hueco que ocupan: no hay
 * que adivinar alturas para que lo de abajo no se monte.
 *
 * En el móvil solo va el teléfono. La ventana del panel encogida a 335 px se
 * queda en letra de 7 px, que ya no es una pantalla sino una textura; el panel
 * se ve entero en la sección siguiente.
 */
function EscenaPortada() {
  return (
    <div className="relative mx-auto h-[440px] w-full max-w-[600px] overflow-hidden sm:h-[500px] lg:h-[580px] lg:self-end">
      <Maqueta
        etiqueta="El inicio del panel de una iglesia: dos personas quieren unirse, un ministerio sin responsable y tres recién llegados que aún no sirven en ningún equipo."
        className="absolute top-0 left-0 hidden sm:block"
      >
        <MarcoNavegador
          direccion="hatril.com/panel"
          className="[zoom:0.72] lg:[zoom:0.75]"
        >
          <PantallaInicioPanel />
        </MarcoNavegador>
      </Maqueta>

      <Maqueta
        etiqueta="La app de un miembro: el versículo del día, el devocional y el muro de su iglesia."
        className="absolute top-0 left-1/2 -translate-x-1/2 sm:top-[104px] sm:right-0 sm:left-auto sm:translate-x-0"
      >
        <MarcoMovil className="[zoom:0.8] sm:[zoom:0.72]">
          <PantallaMuro />
        </MarcoMovil>
      </Maqueta>
    </div>
  );
}

function Punto({
  Icono,
  titulo,
  apilado = false,
  children,
}: {
  Icono: LucideIcon;
  titulo: string;
  /** El icono encima del texto en la fila de cuatro. Solo en escritorio: en
   *  el móvil, apilado, cada punto gastaba media pantalla. */
  apilado?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={apilado ? 'flex gap-3.5 lg:flex-col lg:gap-3' : 'flex gap-3.5'}>
      <span className="flex size-10 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-support">
        <Icono className="size-5" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="text-body font-semibold">{titulo}</span>
        <span className="text-body leading-relaxed text-pretty text-muted-foreground">
          {children}
        </span>
      </span>
    </li>
  );
}

function Paso({
  numero,
  titulo,
  texto,
  children,
}: {
  numero: number;
  titulo: string;
  texto: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 md:p-5">
      <span className="flex items-center gap-3">
        <span className="flex size-7 flex-none items-center justify-center rounded-full border border-border bg-surface text-label font-bold tabular-nums">
          {numero}
        </span>
        <span className="t-subtitulo">{titulo}</span>
      </span>
      <p className="text-body leading-relaxed text-pretty text-muted-foreground">
        {texto}
      </p>
      <div className="mt-auto pt-1">{children}</div>
    </li>
  );
}
