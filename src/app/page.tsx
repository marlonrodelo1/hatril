import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Newsreader } from 'next/font/google';
import { ArrowRight, Church, CreditCard, Globe, Lock, Scale, ShieldCheck, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

import { cn } from '@/lib/utils';
import { totalEnDirectorio } from '@/lib/iglesias/directorio';
import { Logo } from '@/components/marca/logo';
import { buttonVariants } from '@/components/ui/button';
import {
  AvisoFlotante,
  Maqueta,
  MarcoMovil,
  MarcoNavegador,
  PantallaAgenda,
  PantallaInicioPanel,
  PantallaMuro,
  PantallaTurnos,
  PiezaAislamiento,
  PiezaBiblia,
  PiezaDevocional,
  PiezaFichero,
  PiezaMinisterios,
  PiezaPermisos,
  PiezaPublicacion,
  PiezaRadio,
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
 * congregación entre semana— y la portada ENSEÑA las dos en vez de contarlas.
 *
 * EL SEGUNDO PASE (17-NOV): MÁS PROFESIONAL SIN TOCAR LAS REGLAS
 * --------------------------------------------------------------
 * Marlon la veía «muy básica» y puso de referencia 21st.dev. Se le preguntó si
 * relajar «sin sombras» y «sin degradados» aquí, y dijo que no: se mantienen.
 * Lo que cambió, y por qué cada cosa:
 *
 *   - Titulares en serif (Newsreader) con una palabra en cursiva. Es lo que
 *     hace Claude con esta misma paleta, y lo que más separa una portada
 *     editorial de una plantilla. Se carga SOLO aquí (ver `--font-serif`).
 *   - El producto en rejillas («bento»): cada cosa que se promete lleva su
 *     trozo de pantalla al lado. Antes eran iconos con viñetas, que es
 *     justo lo que se lee como básico.
 *   - Movimiento solo donde la aplicación se mueve sola: un turno que se
 *     confirma, una publicación que entra en el muro, la radio. Con CSS y con
 *     «reducir movimiento» respetado (`globals.css`, «La portada»).
 *   - La escena de arriba sobre un escenario de color liso con dos avisos
 *     encima, como los que llegan al panel. La profundidad la dan los bordes
 *     y el solape, no una sombra.
 *   - Cabecera fija con las secciones, franja de garantías y un pie con
 *     columnas: lo que una portada de producto serio tiene y esta no tenía.
 *
 * A QUIÉN LE HABLA
 * ----------------
 * Al pastor, que es quien decide y quien paga: el botón de alta es el único de
 * color y la portada le habla de tú. Pero lo que le convence es ver lo que va
 * a tener su gente en el móvil, y por eso la app sale en el primer vistazo.
 *
 * SOLO SE PROMETE LO QUE EXISTE
 * -----------------------------
 * Todo lo que se cuenta y se dibuja se puede abrir hoy: el fichero, los
 * ministerios con sus turnos, los permisos, las solicitudes, la web pública,
 * el muro, el devocional, la agenda, la Biblia y la radio. Los nombres de los
 * permisos y de los estados son los del código. NO se anuncia la app de las
 * tiendas: no está publicada, y el área del miembro funciona hoy desde el
 * navegador del móvil, que es lo que se dice.
 *
 * Y no se pone precio. Está en variables de entorno porque todavía no está
 * validado, así que ponerlo aquí obligaría a desplegar cada vez que cambie.
 *
 * EL BOTÓN DORADO SALE DOS VECES, Y NUNCA A LA VEZ
 * ------------------------------------------------
 * La regla es un botón de color por PANTALLA: si hay dos a la vista, ninguno es
 * el importante. Arriba y en el cierre los separan cinco secciones. Es la misma
 * acción, así que lleva el mismo botón. En el dorado y no en el naranja desde
 * el 23-oct, a petición de Marlon; el porqué de la letra oscura, en
 * `--hatril-dorado`. El secundario va de contorno y no `ghost`: el `ghost`
 * escribe en naranja, y al lado del dorado eran dos colores llamando.
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
 * La serif de los titulares. Variable y con el eje de tamaño óptico: un solo
 * fichero sirve del titular de 88 px al de 34 sin que el pequeño se quede
 * flaco. La cursiva es otro fichero, y se paga por una razón: la palabra en
 * cursiva de cada titular es la mitad del carácter. Solo `latin`, como la
 * Plus Jakarta: en Colombia buena parte del tráfico llega por datos móviles.
 */
const serif = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
});

/*
 * La escala de cartel de la portada. La guía visual la deja vivir solo aquí y
 * en la web pública (`/i/[slug]`), con `clamp` en vez de escalones: el título
 * crece con la ventana y no salta de golpe al cruzar un punto de corte.
 *
 * Peso normal y no negrita: una serif de titular gana carácter con el tamaño,
 * no con el grosor, y en 400 la cursiva conserva el trazo fino que la hace
 * reconocible.
 */
const TITULO_PORTADA =
  'font-serif text-[clamp(2.875rem,7.6vw,5.5rem)] leading-[0.98] font-normal tracking-[-0.03em] text-balance';
const TITULO_SECCION =
  'font-serif text-[clamp(2.125rem,4.6vw,3.5rem)] leading-[1.02] font-normal tracking-[-0.025em] text-balance';
const ENTRADILLA =
  'max-w-[560px] text-subtitle leading-relaxed text-pretty text-muted-foreground';

/** Los enlaces de la cabecera y del pie: gris, sin el naranja de `<a>`. */
const ENLACE_DISCRETO =
  'text-label font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline';

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

const SECCIONES = [
  { id: 'pastor', nombre: 'Para el pastor' },
  { id: 'congregacion', nombre: 'Para cada miembro' },
  { id: 'datos', nombre: 'Protección de datos' },
];

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
    <div className={clsx(serif.variable, 'min-h-dvh bg-background')}>
      {/* ---------------------------------------------------------------- */}
      {/*
       * LA CABECERA SE QUEDA ARRIBA
       *
       * Fija y con el crema translúcido: al bajar se sigue viendo «Entrar», y
       * las secciones se alcanzan de un toque. El cristal va con la guarda
       * `supports-backdrop-filter:`, como la barra de `/mi`: sin desenfoque,
       * un fondo al 80 % deja leer lo de debajo a través de las letras.
       */}
      <header className="sticky top-0 z-40 border-b border-border bg-background supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-5 md:px-8">
          <Logo variante="logotipo" tamano={22} />
          <nav aria-label="Secciones" className="hidden items-center gap-7 lg:flex">
            {SECCIONES.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={ENLACE_DISCRETO}>
                {s.nombre}
              </a>
            ))}
          </nav>
          <span className="flex-1" />
          <Link href="/iglesias" className={clsx(ENLACE_DISCRETO, 'hidden sm:inline')}>
            Buscar mi iglesia
          </Link>
          {/* Un enlace pintado de botón, no `<Button render={<Link/>}>`: ver
              «Botones» en `docs/diseno/guia-visual.md`. */}
          <Link href="/acceso" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Entrar
          </Link>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-14 text-center md:px-8 md:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-label font-medium text-muted-foreground">
              <Church className="size-4" strokeWidth={1.8} />
              Para iglesias de España y Colombia
            </span>

            <h1 className={clsx(TITULO_PORTADA, 'mt-7 max-w-[940px]')}>
              La iglesia no se acaba <em className="italic">el domingo.</em>
            </h1>

            <p className={clsx(ENTRADILLA, 'mt-6')}>
              Hatril es donde tu congregación sigue unida entre semana. Tu
              equipo lleva a la gente y los ministerios desde el panel, y cada
              miembro tiene a su iglesia en el móvil.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/registro" className={BOTON_ALTA}>
                Crea la de tu iglesia
                <ArrowRight strokeWidth={2} />
              </Link>
              <Link href="/iglesias" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                Busca la tuya
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-[1200px] px-5 md:mt-20 md:px-8">
            <EscenaPortada />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*
         * LA FRANJA DE GARANTÍAS
         *
         * Lo que un pastor pregunta antes de meter a su congregación en un
         * programa, contestado antes de que lo pregunte. Cuatro cosas ciertas
         * hoy; ninguna es un sello que no tengamos.
         */}
        <section aria-label="Lo esencial" className="border-b border-border bg-surface">
          <ul className="mx-auto grid max-w-[1200px] divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <Garantia Icono={ShieldCheck} titulo="Cada iglesia, aislada">
              Lo garantiza la base de datos
            </Garantia>
            <Garantia Icono={Scale} titulo="RGPD y Ley 1581">
              La fe es un dato protegido
            </Garantia>
            <Garantia Icono={Globe} titulo="Web pública incluida">
              Con horarios y cómo llegar
            </Garantia>
            <Garantia Icono={CreditCard} titulo="Prueba sin tarjeta">
              Tu iglesia, creada en minutos
            </Garantia>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section id="pastor" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 md:px-8 md:py-28">
            <Encabezado
              rotulo="Para el pastor y su equipo"
              titulo={
                <>
                  Más tiempo con las personas,{' '}
                  <em className="italic">menos con el desorden.</em>
                </>
              }
            >
              El fichero de la congregación, sus ministerios y quién sirve en
              cada uno, en un solo sitio. Cada líder lleva su equipo sin ver más
              de lo que le toca.
            </Encabezado>

            {/* Tres quintos y dos, y no cuatro sextos y dos: con la columna de
                la derecha más ancha sus textos caben en dos renglones, y la
                celda de los turnos ya no se queda con un palmo de crema vacío
                arriba y abajo. */}
            <ul className="grid gap-4 lg:grid-cols-5">
              <Celda
                className="lg:col-span-3 lg:row-span-2"
                titulo="El equipo del domingo, sin perseguir a nadie"
                texto="Asigna puestos y turnos. Cada cual contesta desde su móvil si puede, y ves al momento qué queda sin cubrir."
                relleno={false}
              >
                <Maqueta etiqueta="Los turnos de Alabanza para el domingo: dirección y guitarra confirmados, voces sin contestar, el teclado no puede y el bajo sin cubrir.">
                  <PantallaTurnos animado />
                </Maqueta>
              </Celda>
              <Celda
                className="lg:col-span-2"
                titulo="Ministerios con su gente"
                texto="Responsable, colíderes, puestos y turnos. Y a la vista el que se ha quedado sin nadie al frente."
              >
                <Maqueta etiqueta="Cuatro ministerios con su responsable y su gente; Jóvenes aparece sin responsable.">
                  <PiezaMinisterios />
                </Maqueta>
              </Celda>
              <Celda
                className="lg:col-span-2"
                titulo="Tú repartes el acceso"
                texto="Secretaría, líderes, tesorería: cada uno ve lo suyo, y lo decides permiso a permiso."
              >
                <Maqueta etiqueta="Los permisos de Rut Mena, de secretaría: ve la congregación entera y acepta solicitudes, pero no lleva las cuentas ni ve los datos personales.">
                  <PiezaPermisos />
                </Maqueta>
              </Celda>
              <Celda
                horizontal
                className="lg:col-span-5"
                titulo="El fichero, al día"
                texto="Cada persona con su ficha y su situación, con buscador y filtros. Los recién llegados, a la vista, para que nadie se quede sin una llamada."
              >
                <Maqueta etiqueta="El fichero de la iglesia: 184 personas, con un buscador, filtros por situación y cuatro filas de ejemplo.">
                  <PiezaFichero />
                </Maqueta>
              </Celda>
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section id="congregacion" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 md:px-8 md:py-28">
            <Encabezado
              rotulo="Para cada miembro"
              titulo={
                <>
                  Y tu gente, con su iglesia{' '}
                  <em className="italic">en el móvil toda la semana.</em>
                </>
              }
            >
              No es otro grupo de mensajes: es el sitio de su congregación, y
              solo de la suya. Entra con su cuenta desde el navegador del móvil.
            </Encabezado>

            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/*
               * El teléfono no cabe entero ni hace falta: va en una caja de
               * alto fijo y su borde lo corta. Posición absoluta para que no
               * empuje la fila: en escritorio, el alto lo marcan las otras
               * cuatro celdas, y el teléfono rellena lo que haya.
               */}
              <Celda
                className="md:row-span-2"
                titulo="Su agenda, y lo que le toca"
                texto="Horarios, eventos y sus turnos en el ministerio. Dice si puede con un toque."
                relleno={false}
              >
                <Maqueta
                  etiqueta="La agenda de un miembro en el móvil: le toca servir el domingo en Alabanza, con los botones «Ahí estaré» y «No puedo», y lo que tiene el resto de la semana."
                  className="relative h-[440px] overflow-hidden md:h-auto md:min-h-[440px] md:flex-1"
                >
                  {/* El `zoom` en el teléfono y la posición en su envoltorio:
                      con los dos en el mismo elemento, `zoom` encoge también
                      el `top` y la cuenta del centrado deja de cuadrar. */}
                  <div className="absolute top-7 left-1/2 -translate-x-1/2">
                    <MarcoMovil className="[zoom:0.72]">
                      <PantallaAgenda />
                    </MarcoMovil>
                  </div>
                </Maqueta>
              </Celda>
              <Celda
                titulo="Comunidad"
                texto="El muro de la iglesia: avisos, fotos del domingo y lo que cada uno quiera compartir, con moderación."
              >
                <Maqueta etiqueta="Una publicación en el muro dando las gracias por la comida para una familia, con 41 me gusta.">
                  <PiezaPublicacion />
                </Maqueta>
              </Celda>
              <Celda
                titulo="Devocional"
                texto="El del día, escrito por el equipo de la iglesia, con vídeo si lo tiene."
              >
                <Maqueta etiqueta="El devocional de hoy, «Cuando todo tiembla», con su vídeo.">
                  <PiezaDevocional />
                </Maqueta>
              </Celda>
              <Celda
                titulo="Biblia"
                texto="La Reina-Valera 1909 entera, para leer y compartir un versículo con su cita."
              >
                <Maqueta etiqueta="Salmos 23:1 en la Reina-Valera 1909, con el botón «Compartir».">
                  <PiezaBiblia />
                </Maqueta>
              </Celda>
              <Celda
                titulo="La radio de su iglesia"
                texto="Si la iglesia tiene emisora, suena en directo mientras navega."
              >
                <Maqueta etiqueta="La radio de la iglesia sonando en directo.">
                  <PiezaRadio />
                </Maqueta>
              </Celda>
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 md:px-8 md:py-28">
            <Encabezado
              rotulo="Así llega alguien nuevo"
              titulo={
                <>
                  De la puerta de la iglesia <em className="italic">a su comunidad.</em>
                </>
              }
            >
              La página pública de tu iglesia va incluida, y es la puerta para
              quien todavía no la conoce.
            </Encabezado>

            <ol className="grid gap-4 md:grid-cols-3">
              <Celda
                paso={1}
                titulo="Encuentra la iglesia"
                texto="En su página, con los horarios y cómo llegar, o buscándola en el directorio."
              >
                <Maqueta etiqueta="La página pública de Iglesia Betania, con sus horarios y el botón «Quiero ser parte».">
                  <PiezaWebPublica />
                </Maqueta>
              </Celda>
              <Celda
                paso={2}
                titulo="Pide entrar, y la iglesia lo aprueba"
                texto="La solicitud llega al panel. Se acabó apuntar nombres en el móvil a la salida del culto."
              >
                <Maqueta etiqueta="Una solicitud en el panel: Nuria Cabrera quiere unirse, con el botón «Aprobar».">
                  <PiezaSolicitud />
                </Maqueta>
              </Celda>
              <Celda
                paso={3}
                titulo="Ya es de la casa"
                texto="Entra en el fichero y en el área de miembros: el muro, el devocional y su agenda."
              >
                <Maqueta etiqueta="Una publicación del pastor en el muro dando la bienvenida a Nuria.">
                  <PiezaYaDentro />
                </Maqueta>
              </Celda>
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
         * `support`): se nota si se mira y no compite con el texto.
         */}
        <section
          id="datos"
          className="relative isolate scroll-mt-16 overflow-hidden bg-support text-secondary-foreground"
        >
          <Logo
            variante="atril"
            tamano={520}
            className="absolute -right-24 -bottom-48 -z-10 text-support-hover md:-right-6 lg:right-[2%]"
          />
          <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-support-hover bg-support-hover px-3 py-1.5 text-label font-semibold">
                <Lock className="size-3.5" strokeWidth={2} />
                Lo que más nos ha costado
              </span>
              <h2 className={TITULO_SECCION}>
                Los datos de tu iglesia{' '}
                <em className="italic">no pueden alcanzar a otra.</em>
              </h2>
              <p className="text-subtitle leading-relaxed font-semibold text-pretty">
                Y lo impide la base de datos, no nuestra buena intención.
              </p>
              <Maqueta
                etiqueta="Desde Iglesia Betania, la aplicación pide los miembros de Iglesia Emmanuel, y la base de datos devuelve cero filas."
                className="mt-2 w-full max-w-[460px]"
              >
                <PiezaAislamiento />
              </Maqueta>
            </div>

            <div className="flex max-w-[560px] flex-col gap-4 text-body leading-relaxed text-pretty text-support-muted-foreground lg:pt-16">
              <p>
                Saber que alguien pertenece a una congregación dice algo de sus
                creencias, y la ley lo protege igual que un dato de salud. Una
                fuga entre iglesias no sería un fallo a corregir el lunes: sería
                una brecha que hay que notificar.
              </p>
              <p>
                Por eso el aislamiento no está en el código de la aplicación,
                donde un descuido lo salta, sino en la propia base de datos:
                aunque la aplicación pidiera por error los miembros de otra
                congregación, la base devuelve cero filas.
              </p>
              <p>
                Se comprueba en cada cambio con una batería de pruebas dedicada
                a eso solo.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 py-20 text-center md:px-8 md:py-32">
            <h2 className={TITULO_SECCION}>
              Empieza por <em className="italic">tu iglesia.</em>
            </h2>
            <p className={clsx(ENTRADILLA, 'mt-5')}>
              Créala en unos minutos e invita a tu equipo. Tu gente llegará
              después.
            </p>
            <Link href="/registro" className={clsx(BOTON_ALTA, 'mt-9')}>
              Crea la de tu iglesia
              <ArrowRight strokeWidth={2} />
            </Link>
            <p className="mt-6 max-w-[520px] text-label leading-relaxed text-pretty text-muted-foreground">
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
      </main>

      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:px-8">
          <div className="col-span-2 flex flex-col items-start gap-3 md:col-span-1">
            <Logo variante="logotipo" tamano={20} />
            <p className="max-w-[280px] text-label leading-relaxed text-pretty text-muted-foreground">
              El fichero de tu iglesia, ordenado, y tu congregación unida entre
              semana.
            </p>
          </div>
          <ColumnaPie
            titulo="Producto"
            enlaces={SECCIONES.map((s) => [`#${s.id}`, s.nombre])}
          />
          <ColumnaPie
            titulo="Iglesias"
            enlaces={[
              ['/iglesias', 'Buscar mi iglesia'],
              ['/registro', 'Crear la de tu iglesia'],
              ['/acceso', 'Entrar'],
            ]}
          />
          <ColumnaPie
            titulo="Legal"
            enlaces={[
              ['/privacidad', 'Privacidad'],
              ['/terminos', 'Términos'],
            ]}
          />
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-5 text-label text-muted-foreground md:px-8">
            <span>© {new Date().getFullYear()} Hatril</span>
            <span>Hecho en Tenerife</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * El panel y el teléfono sobre el escenario: las dos caras de Hatril en el
 * primer vistazo, con dos avisos encima de los que llegan de verdad.
 *
 * EL ESCENARIO
 * ------------
 * Un recuadro del naranja suave (`bg-accent`), liso, que se apoya en la línea
 * que cierra la sección: el panel y el teléfono suben desde abajo y el borde
 * los corta. Es lo que hace que la escena se lea como UNA pieza y no como dos
 * capturas sueltas sobre el crema. Con el blanco de las maquetas encima, el
 * contraste lo pone el color, no una sombra.
 *
 * Las maquetas están dibujadas a tamaño real y se encogen con `zoom`, que a
 * diferencia de `transform: scale` también encoge el hueco que ocupan.
 *
 * En el móvil solo va el teléfono. La ventana del panel encogida a 335 px se
 * queda en letra de 7 px, que ya no es una pantalla sino una textura; el panel
 * se ve por partes en las celdas de la sección siguiente.
 */
function EscenaPortada() {
  return (
    <div className="relative h-[440px] overflow-hidden rounded-t-xl border border-b-0 border-border bg-accent sm:h-[500px] md:h-[560px] lg:h-[620px]">
      <Maqueta
        etiqueta="El inicio del panel de una iglesia: dos personas quieren unirse, un ministerio sin responsable y tres recién llegados que aún no sirven en ningún equipo."
        className="absolute top-8 left-8 hidden sm:block lg:top-12 lg:left-12"
      >
        {/* A 1024 px el teléfono se comía media columna del panel: hasta `xl`
            va un punto más pequeño para que se lea lo que espera al pastor. */}
        <MarcoNavegador
          direccion="hatril.com/panel"
          className="[zoom:0.64] md:[zoom:0.8] lg:[zoom:0.88] xl:[zoom:1]"
        >
          <PantallaInicioPanel className="h-[720px] w-[840px]" />
        </MarcoNavegador>
      </Maqueta>

      <Maqueta
        etiqueta="La app de un miembro: el versículo del día, el devocional y el muro de su iglesia, donde entra una publicación nueva del pastor."
        className="absolute top-8 left-1/2 -translate-x-1/2 sm:top-20 sm:right-8 sm:left-auto sm:translate-x-0 lg:top-24 lg:right-14"
      >
        <MarcoMovil className="[zoom:0.78] sm:[zoom:0.62] md:[zoom:0.7] lg:[zoom:0.84]">
          <PantallaMuro animado />
        </MarcoMovil>
      </Maqueta>

      {/* Los avisos repiten lo que ya dicen las maquetas, así que no se
          anuncian: para un lector serían la misma frase dos veces. */}
      <div aria-hidden className="pointer-events-none select-none">
        <div className="absolute bottom-6 left-4 sm:bottom-8 lg:bottom-14 lg:left-5">
          <AvisoFlotante
            titulo="Valeria Ospina ha confirmado"
            detalle="Voces · domingo, 10:00"
            className="portada-aparece"
            style={{ '--retraso': '700ms' } as CSSProperties}
          />
        </div>
        <div className="absolute top-14 right-[340px] hidden lg:block">
          <AvisoFlotante
            persona="Nuria Cabrera"
            titulo="Nuria Cabrera quiere unirse"
            detalle="Desde la web de la iglesia"
            className="portada-aparece"
            style={{ '--retraso': '1400ms' } as CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}

/** El rótulo, el titular en serif y la entradilla de cada sección. */
function Encabezado({
  rotulo,
  titulo,
  children,
}: {
  rotulo: string;
  titulo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex max-w-[760px] flex-col items-start gap-5">
      <span className="t-micro">{rotulo}</span>
      <h2 className={TITULO_SECCION}>{titulo}</h2>
      <p className={ENTRADILLA}>{children}</p>
    </div>
  );
}

/**
 * Una celda de las rejillas: el texto arriba en blanco y, debajo, su trozo de
 * pantalla sobre el crema, separado por una línea. Así cada cosa que se
 * promete lleva al lado la prueba de que existe.
 *
 * `horizontal` la tumba en escritorio (texto a la izquierda) para la celda que
 * ocupa la fila entera; `relleno={false}` es para la maqueta que ya trae el
 * suyo; `paso` le pone el número cuando va en el camino de alguien nuevo.
 */
function Celda({
  titulo,
  texto,
  children,
  className,
  horizontal = false,
  relleno = true,
  paso,
}: {
  titulo: string;
  texto: string;
  children: ReactNode;
  className?: string;
  horizontal?: boolean;
  relleno?: boolean;
  paso?: number;
}) {
  return (
    <li
      className={clsx(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-surface',
        horizontal && 'lg:flex-row',
        className,
      )}
    >
      <div
        className={clsx(
          'flex flex-col gap-1.5 p-5 md:p-6',
          horizontal && 'lg:w-[38%] lg:flex-none lg:justify-center lg:p-10',
        )}
      >
        {paso !== undefined && (
          <span className="mb-2 font-serif text-[2.5rem] leading-none text-muted-foreground tabular-nums">
            {paso}
          </span>
        )}
        <h3 className="t-subtitulo text-balance">{titulo}</h3>
        <p className="text-body leading-relaxed text-pretty text-muted-foreground">
          {texto}
        </p>
      </div>
      <div
        className={clsx(
          'flex flex-1 flex-col justify-center border-t border-border bg-background',
          relleno && 'p-4 md:p-5',
          horizontal && 'lg:border-t-0 lg:border-l lg:p-8',
        )}
      >
        {children}
      </div>
    </li>
  );
}

function Garantia({
  Icono,
  titulo,
  children,
}: {
  Icono: LucideIcon;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3.5 px-5 py-5 md:px-8 lg:py-7">
      <span className="flex size-10 flex-none items-center justify-center rounded-lg border border-border bg-surface-alt text-support">
        <Icono className="size-5" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-semibold">{titulo}</span>
        <span className="text-label text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}

/**
 * Una columna del pie. Las anclas van con `<a>` y no con `<Link>`, que
 * intentaría precargarlas (guía visual, «Botones»).
 */
function ColumnaPie({
  titulo,
  enlaces,
}: {
  titulo: string;
  enlaces: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="t-micro">{titulo}</span>
      <ul className="flex flex-col gap-2.5">
        {enlaces.map(([href, texto]) => (
          <li key={href}>
            {href.startsWith('#') ? (
              <a href={href} className={ENLACE_DISCRETO}>
                {texto}
              </a>
            ) : (
              <Link href={href} className={ENLACE_DISCRETO}>
                {texto}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
