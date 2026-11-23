'use client';

import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  BookOpen,
  CalendarDays,
  Clock,
  HeartHandshake,
  LogIn,
  MapPin,
  Menu,
  MessagesSquare,
  Radio,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Hoja } from '@/components/hoja';

export type Seccion = { href: string; texto: string };

/** Cómo se dona a esta iglesia. `null` si todavía no lo ha configurado. */
export type Donativos = { cuenta: string; titular: string | null };

/** El icono de cada sección en la hoja del móvil. Una sección que no esté aquí
 *  sale sin icono pero alineada con las demás, no se rompe. */
const ICONOS: Record<string, LucideIcon> = {
  '#horarios': Clock,
  '#eventos': CalendarDays,
  '#devocional': BookOpen,
  '#radio': Radio,
  '#grupos': Users,
  '#comunidad': MessagesSquare,
  '#contacto': MapPin,
};

/** Lo que hay que bajar para que la cabecera deje la foto y se vuelva sólida.
 *  El del prototipo aprobado: lo justo para que no cambie con el temblor del
 *  dedo al empezar a leer, y mucho antes de que el texto pase por debajo. */
const UMBRAL_RECOGIDA = 60;

/**
 * La cabecera de la web pública.
 *
 * DE PÍLDORA FLOTANTE A BANDA QUE SE RECOGE (zona 3, 17-nov)
 * ----------------------------------------------------------
 * Era una píldora con borde flotando sobre una portada en tarjeta. Marlon
 * aprobó la portada a sangre y, con ella, esta cabecera: transparente y con
 * letra blanca sobre la foto, y al bajar sólida (superficie con borde de 1px,
 * sin sombra), más baja y sin la ciudad. Sobre la foto la píldora era una
 * pastilla más puesta encima; y sobre el crema, al bajar, seguía pareciendo
 * pegada encima de una foto que ya no estaba.
 *
 * NO OCUPA SITIO, Y POR ESO NO SALTA
 * ----------------------------------
 * El `<header>` mide cero de alto y la banda cuelga de él. Así la foto empieza
 * arriba del todo, por debajo de la banda, y al recogerse (64 → 56px) no se
 * mueve nada de la página: si la cabecera ocupara su alto, encoger doce
 * píxeles subiría todo lo de debajo doce píxeles mientras se lee. El hueco lo
 * deja la portada, que es la que sabe si hay foto debajo o no.
 *
 * Sin fotos no hay nada sobre lo que ser transparente: es sólida desde el
 * principio, y solo se recoge.
 *
 * EL MENÚ EXISTE EN MÓVIL
 * -----------------------
 * Esto es lo que faltaba de verdad en su día. Las secciones estaban en
 * `hidden lg:flex`: por debajo de 1024px la web no tenía navegación ninguna, y
 * más de la mitad de las visitas llegan por un enlace de WhatsApp abierto en un
 * móvil. Ahora sale en una hoja desde abajo, con «Donar» y «Entrar» al final:
 * es donde llega el pulgar, y la misma hoja del muro y de la agenda.
 *
 * Y EL CORTE ES `xl` DESDE QUE LLEGARON LOS EVENTOS
 * -------------------------------------------------
 * Con cinco secciones, el menú ya ocupaba 589px a 1024 de ancho. «Eventos»
 * añade otros noventa y pico, y lo que se come es el nombre de la iglesia, que
 * es lo último que debe encogerse en su propia web. Así que entre 1024 y
 * 1279px manda el botón del menú, que no pierde nada: el menú completo está en
 * la hoja. Si algún día se quita una sección, esto se puede devolver a `lg`,
 * pero hay que MIRARLO a 1024 exactos con un nombre largo, no razonarlo.
 *
 * SIN LIBRERÍA DE ANIMACIÓN
 * -------------------------
 * Recogerse es cambiar un alto y un fondo con `transition`. Traer
 * `framer-motion` para esto son decenas de kilobytes en la página que más
 * visitas sueltas recibe, muchas desde un móvil con mala cobertura.
 */
export function CabeceraIglesia({
  nombre,
  ciudad,
  logoUrl,
  iniciales,
  secciones,
  tieneContacto,
  donativos,
  paginaDar,
  conFoto,
}: {
  nombre: string;
  ciudad: string | null;
  logoUrl: string | null;
  iniciales: string;
  secciones: Seccion[];
  tieneContacto: boolean;
  donativos: Donativos | null;
  /**
   * `/i/<slug>/dar` si la iglesia cobra con tarjeta. Entonces «Donar» lleva
   * allí, donde además está la cuenta para transferencias, y la ventana con
   * solo la cuenta deja de hacer falta. Si solo tiene transferencia, `null`, y
   * «Donar» sigue abriendo la ventana de siempre.
   */
  paginaDar: string | null;
  /** Si la portada lleva fotos debajo. Sin ellas, la cabecera nace sólida. */
  conFoto: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [donarAbierto, setDonarAbierto] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const recogida = useRecogida();
  const activa = useSeccionActiva(secciones);
  const sobreFoto = conFoto && !recogida;

  // Cerrar la hoja al llegar a un ancho donde el menú de escritorio ya está
  // visible. Sin esto, quien gira la tableta se queda con la hoja abierta
  // encima de una cabecera que ya no la necesita.
  useEffect(() => {
    if (!abierto) return;
    const ancho = window.matchMedia('(min-width: 1280px)');
    function cambioAncho() {
      if (ancho.matches) setAbierto(false);
    }
    ancho.addEventListener('change', cambioAncho);
    return () => ancho.removeEventListener('change', cambioAncho);
  }, [abierto]);

  /*
   * LO QUE SE PULSA DENTRO DE LA HOJA SE HACE CUANDO LA HOJA YA SE HA IDO
   *
   * La hoja es un diálogo modal y bloquea el desplazamiento de la página.
   * En un navegador con barras de desplazamiento de las que ocupan sitio (un
   * Windows a 1000px, justo donde se ve el botón del menú), Base UI suelta ese
   * bloqueo devolviendo la página a la posición en que estaba: el salto a la
   * sección empezaba y se deshacía solo. Y abrir la ventana de donar mientras
   * la hoja se cierra son dos diálogos peleándose por el foco.
   *
   * Base UI suelta el bloqueo en un `setTimeout(0)` que programa al cerrarse.
   * Este efecto corre después de ese cierre, así que su `setTimeout(0)` va
   * detrás: cuando salta, la página ya es libre.
   */
  useEffect(() => {
    if (abierto || !pendiente) return;
    const id = setTimeout(() => {
      setPendiente(null);
      if (pendiente.tipo === 'donar') {
        setDonarAbierto(true);
        return;
      }
      const destino = document.getElementById(pendiente.href.slice(1));
      if (!destino) return;
      // `scrollIntoView` sin opciones respeta el `scroll-behavior` de la
      // página (suave, salvo con «reducir movimiento») y el `scroll-mt` de
      // cada sección, igual que el salto nativo de un ancla.
      destino.scrollIntoView();
      if (window.location.hash !== pendiente.href) {
        window.history.pushState(null, '', pendiente.href);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [abierto, pendiente]);

  return (
    <header className="sticky top-0 z-30 h-0">
      {/*
       * La banda. Sobre la foto no tiene fondo ni borde (el borde va
       * transparente para que no cambie el alto al aparecer).
       *
       * Sólida, al 96 % y no al 80, con el cristal detrás. Lo que pasa por
       * debajo al bajar puede ser la foto de la portada con su velo negro, y
       * una banda clara translúcida encima de algo oscuro se agrisa: al 80 la
       * ciudad y el menú, en gris secundario, se quedaban en 3.1:1. Al 96
       * aguantan 4.5 incluso sobre negro puro.
       *
       * `env(safe-area-inset-top)`: en la app nativa la página llega hasta
       * debajo de la barra de estado, y sin esto el nombre quedaría tapado.
       */}
      <div
        className={cn(
          'border-b pt-[env(safe-area-inset-top)] transition-[background-color,border-color,color] duration-240 ease-hatril motion-reduce:transition-none',
          sobreFoto
            ? 'border-transparent text-white'
            : 'border-border bg-surface text-foreground supports-backdrop-filter:bg-surface/96 supports-backdrop-filter:backdrop-blur-xl',
        )}
      >
        {/*
         * El mismo sangrado lateral y el mismo ancho que las secciones: así el
         * logo cae encima del borde izquierdo del texto de la portada.
         *
         * En escritorio son tres columnas: identidad, menú y acción. La del
         * medio es la que se estira, no las de los lados. Con `1fr auto 1fr`
         * el menú quedaba matemáticamente centrado, pero la columna de la
         * izquierda se encogía y «Iglesia Betania» salía cortado con puntos
         * suspensivos. El nombre de la iglesia es lo último que puede
         * recortarse en su propia web; que el menú quede unos píxeles a un
         * lado no lo nota nadie.
         */}
        <div
          className={clsx(
            'mx-auto flex max-w-[1180px] items-center gap-3 px-4 transition-[height] duration-360 ease-hatril motion-reduce:transition-none sm:px-5 md:px-10 xl:grid xl:grid-cols-[auto_1fr_auto] xl:gap-4',
            recogida ? 'h-14 xl:h-16' : 'h-16 xl:h-20',
          )}
        >
          {/* Identidad. `min-w-0` para que el nombre pueda encogerse: sin él,
              un nombre largo empuja al botón fuera de la banda en un móvil de
              320px. `text-inherit` porque `globals.css` pinta de naranja
              todo `<a>`. */}
          <a
            href="#"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-inherit no-underline hover:text-inherit hover:no-underline xl:flex-none"
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={nombre}
                width={40}
                height={40}
                className={clsx(
                  'flex-none rounded-lg border border-border bg-surface object-cover transition-[width,height] duration-360 ease-hatril motion-reduce:transition-none',
                  recogida ? 'size-8 xl:size-9' : 'size-9 xl:size-10',
                )}
              />
            ) : (
              <span
                className={clsx(
                  'flex flex-none items-center justify-center rounded-lg bg-primary text-label font-bold text-primary-foreground transition-[width,height] duration-360 ease-hatril motion-reduce:transition-none',
                  recogida ? 'size-8 xl:size-9' : 'size-9 xl:size-10',
                )}
              >
                {iniciales}
              </span>
            )}
            <span className="flex min-w-0 flex-col xl:max-w-[260px]">
              <span className="truncate text-body leading-tight font-bold tracking-[-0.018em]">
                {nombre}
              </span>
              {ciudad && (
                /*
                 * Al recogerse, la ciudad se va. Con `max-height` y no con
                 * `hidden` para que se pliegue con el alto de la banda en vez
                 * de desaparecer de golpe.
                 *
                 * Sobre la foto, blanco entero y no translúcido: a 11,5px, un
                 * blanco al 80 % sobre el peor punto de la foto se queda por
                 * debajo de 4:1.
                 */
                <span
                  className={clsx(
                    'truncate text-micro leading-tight font-medium transition-[max-height,opacity] duration-240 ease-hatril motion-reduce:transition-none',
                    sobreFoto ? 'text-white' : 'text-muted-foreground',
                    recogida ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100',
                  )}
                >
                  {ciudad}
                </span>
              )}
            </span>
          </a>

          {/* El menú solo lista las secciones que existen. Un ancla a una
              sección que no se ha pintado deja al visitante donde estaba sin
              que pase nada, y parece que la web está rota. */}
          {secciones.length > 0 && (
            <nav aria-label="Secciones" className="hidden xl:flex xl:justify-center">
              <MenuEscritorio
                secciones={secciones}
                activa={activa}
                sobreFoto={sobreFoto}
              />
            </nav>
          )}

          <div className="flex flex-none items-center gap-2 xl:justify-end">
            {/*
             * UN SOLO BOTÓN AQUÍ, Y CARBÓN.
             *
             * `secondary` y no naranja porque en la primera pantalla ya hay un
             * «Cómo llegar» naranja en la portada, y el sistema de diseño admite
             * un solo naranja por pantalla: dos iguales compitiendo y ninguno
             * destaca. Sobre la foto va en cristal, como el secundario de la
             * portada: el carbón sobre una foto oscurecida no se distingue.
             *
             * Y uno solo porque los dos juntos no caben al lado del menú.
             * Donar manda cuando la iglesia tiene por dónde recibir; si no, el
             * sitio es para «Cómo llegar». En escritorio no se pierde nada:
             * «Contacto» está en el menú.
             */}
            {paginaDar ? (
              <BotonEnlace
                href={paginaDar}
                variant="secondary"
                size="sm"
                className={cn(
                  'hidden h-10 px-4 sm:inline-flex',
                  sobreFoto && CRISTAL,
                )}
              >
                <HeartHandshake strokeWidth={1.8} />
                Donar
              </BotonEnlace>
            ) : donativos ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={cn(
                  'hidden h-10 px-4 sm:inline-flex',
                  sobreFoto && CRISTAL,
                )}
                onClick={() => setDonarAbierto(true)}
              >
                <HeartHandshake strokeWidth={1.8} />
                Donar
              </Button>
            ) : (
              tieneContacto && (
                <BotonEnlace
                  nativo
                  href="#contacto"
                  variant="secondary"
                  size="sm"
                  className={cn(
                    'hidden h-10 px-4 sm:inline-flex',
                    sobreFoto && CRISTAL,
                  )}
                >
                  <MapPin strokeWidth={1.8} />
                  Cómo llegar
                </BotonEnlace>
              )
            )}

            {/* En escritorio no hay hoja donde meter «Entrar», así que la
                cuenta va aquí como icono. Solo el icono: con siete secciones
                en el menú, con texto no cabría sin cortar el nombre. */}
            <BotonEnlace
              href="/mi"
              variant="ghost"
              size="icon"
              aria-label="Mi cuenta"
              className={cn(
                'hidden size-10 rounded-full xl:inline-flex',
                sobreFoto &&
                  'text-white hover:bg-white/15 hover:text-white active:bg-white/20 active:text-white',
              )}
            >
              <UserRound strokeWidth={1.8} className="size-[19px]" />
            </BotonEnlace>

            {secciones.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-haspopup="dialog"
                aria-expanded={abierto}
                aria-label="Abrir el menú"
                // 44px, que es el mínimo de un objetivo táctil. El `size="icon"`
                // del sistema son 40 y aquí es el único control de la cabecera
                // en un móvil: si falla, no hay otra forma de navegar.
                className={cn(
                  'size-11 transition-colors duration-240 ease-hatril motion-reduce:transition-none xl:hidden',
                  sobreFoto && CRISTAL,
                )}
                onClick={() => setAbierto(true)}
              >
                <Menu strokeWidth={1.8} className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {secciones.length > 0 && (
        <Hoja
          abierta={abierto}
          onCambio={setAbierto}
          titulo={nombre}
          descripcion="Las secciones de esta página, y cómo donar o entrar."
        >
          <nav aria-label="Secciones" className="flex flex-col">
            {secciones.map((s) => {
              const Icono = ICONOS[s.href];
              const esActiva = activa === s.href;
              return (
                <a
                  key={s.href}
                  href={s.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setPendiente({ tipo: 'seccion', href: s.href });
                    setAbierto(false);
                  }}
                  aria-current={esActiva ? 'true' : undefined}
                  className={clsx(
                    'flex min-h-12 items-center gap-3 border-b border-border px-1 text-body no-underline transition-colors duration-150 hover:no-underline active:bg-surface-active motion-reduce:transition-none',
                    // La sección que se está leyendo, con el par de «lo
                    // elegido» de la guía. Sin relleno: entre filas separadas
                    // por una línea, un bloque de color parece otro botón.
                    esActiva
                      ? 'font-bold text-accent-foreground hover:text-accent-foreground'
                      : 'font-semibold text-foreground hover:text-foreground',
                  )}
                >
                  {Icono ? (
                    <Icono
                      aria-hidden
                      strokeWidth={1.8}
                      className={clsx(
                        'size-[18px] flex-none',
                        esActiva ? 'text-accent-foreground' : 'text-muted-foreground',
                      )}
                    />
                  ) : (
                    <span aria-hidden className="size-[18px] flex-none" />
                  )}
                  <span className="flex-1">{s.texto}</span>
                </a>
              );
            })}
          </nav>

          {/*
           * Donar vive aquí y no en una franja de la página. Es el sitio donde
           * alguien lo busca a propósito, no algo con lo que se tropieza al
           * bajar.
           *
           * UN SOLO «ENTRAR» PARA LOS TRES CASOS
           *
           * No cambia según haya sesión, y es a propósito: esta página es
           * estática con revalidación de 60 segundos, así que para saber quién
           * mira habría que hacerla dinámica —una consulta a Irlanda por
           * visita— o resolverlo en el navegador, que enseña un botón y lo
           * cambia medio segundo después.
           *
           * `/mi` ya reparte sola: sin sesión manda a entrar y vuelve aquí, con
           * iglesia va al panel, y con cuenta sin iglesia enseña en qué punto
           * está su solicitud. «Entrar» se lee bien en los tres.
           */}
          <div
            className={clsx(
              'mt-3 grid gap-2 pb-[env(safe-area-inset-bottom)]',
              (paginaDar || donativos) && 'grid-cols-2',
            )}
          >
            {paginaDar ? (
              <BotonEnlace
                href={paginaDar}
                size="lg"
                variant="outline"
                onClick={() => setAbierto(false)}
              >
                <HeartHandshake strokeWidth={1.8} />
                Donar
              </BotonEnlace>
            ) : donativos && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  setPendiente({ tipo: 'donar' });
                  setAbierto(false);
                }}
              >
                <HeartHandshake strokeWidth={1.8} />
                Donar
              </Button>
            )}
            <BotonEnlace
              href="/mi"
              size="lg"
              variant="secondary"
              onClick={() => setAbierto(false)}
            >
              <LogIn strokeWidth={1.8} />
              Entrar
            </BotonEnlace>
          </div>
        </Hoja>
      )}

      {donativos && !paginaDar && (
        <VentanaDonar
          abierta={donarAbierto}
          alCerrar={setDonarAbierto}
          nombre={nombre}
          donativos={donativos}
        />
      )}
    </header>
  );
}

type Pendiente = { tipo: 'seccion'; href: string } | { tipo: 'donar' };

/**
 * Los botones de la cabecera mientras está sobre la foto: cristal blanco, el
 * mismo que el secundario de la portada. Va con `cn` para que sustituya el
 * relleno y el borde de su variante en vez de sumarse a ellos.
 */
const CRISTAL =
  'border-white/35 bg-white/12 text-white hover:bg-white/22 hover:text-white active:bg-white/28';

/** Si la página ya ha bajado lo bastante como para que la cabecera se recoja. */
function useRecogida() {
  const [recogida, setRecogida] = useState(false);

  useEffect(() => {
    let pendiente = 0;
    function calcular() {
      pendiente = 0;
      // React no vuelve a pintar si el valor no cambia: al desplazarse se
      // llama decenas de veces y solo pinta al cruzar el umbral.
      setRecogida(window.scrollY > UMBRAL_RECOGIDA);
    }
    function alDesplazar() {
      if (pendiente) return;
      pendiente = requestAnimationFrame(calcular);
    }
    // Al volver atrás o recargar, el navegador devuelve la página a donde
    // estaba: hay que saberlo sin esperar al primer desplazamiento.
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      cancelAnimationFrame(pendiente);
      window.removeEventListener('scroll', alDesplazar);
    };
  }, []);

  return recogida;
}

/**
 * Cómo donar, en una ventana.
 *
 * SOLO PARA LA IGLESIA SIN TARJETA
 * --------------------------------
 * Con la cuenta de Stripe conectada (Connect, `cuentas_stripe`), «Donar» ya no
 * abre esto: lleva a `/i/[slug]/dar`, que cobra con tarjeta y enseña la cuenta
 * del banco debajo como la otra forma. Esta ventana se queda para la iglesia
 * que solo tiene número de cuenta, que tiene que poder seguir recibiendo.
 */
function VentanaDonar({
  abierta,
  alCerrar,
  nombre,
  donativos,
}: {
  abierta: boolean;
  alCerrar: (v: boolean) => void;
  nombre: string;
  donativos: Donativos;
}) {
  return (
    <Dialog open={abierta} onOpenChange={alCerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[19px] font-extrabold tracking-[-0.02em]">
            Donar a {nombre}
          </DialogTitle>
          {/* Sin «transferencia» ni «número de cuenta»: lo que pega la iglesia
              puede ser un IBAN, un Nequi o un código de Bizum para ONG, y la
              primera iglesia real puso justo el tercero. Un texto que da por
              hecho el IBAN le decía al visitante que hiciera una transferencia
              a algo que no es una cuenta. */}
          <DialogDescription className="text-[14px] leading-relaxed">
            Directamente a la iglesia, por el medio que indica aquí. Hatril no
            cobra ni guarda datos de tarjetas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-alt p-4">
          <span className="t-micro">Cómo donar</span>
          {/* `tabular-nums` para que los dígitos midan lo mismo: un número de
              cuenta con cifras que bailan es más fácil de copiar mal. */}
          <span className="text-[17px] font-bold tabular-nums tracking-[-0.01em] break-words">
            {donativos.cuenta}
          </span>
          {donativos.titular && (
            <span className="text-[13.5px] text-muted-foreground">
              Titular: {donativos.titular}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Las secciones en escritorio, con la marca que se mueve.
 *
 * La marca va DETRÁS de los enlaces y el texto de encima es blanco. La
 * referencia original resolvía lo mismo con `mix-blend-difference`, que invierte
 * el color contra lo que tenga debajo; aquí no hace falta y además se evita su
 * efecto secundario, que era invertir también el fondo de la cabecera al
 * desplazarse.
 *
 * `support`, el carbón, y no el naranja de marca porque en la primera pantalla
 * ya está «Cómo llegar». Sobre la foto la marca es de cristal blanco: el carbón
 * sobre una foto oscurecida no se ve, y el texto ahí es blanco de todos modos.
 */
function MenuEscritorio({
  secciones,
  activa,
  sobreFoto,
}: {
  secciones: Seccion[];
  activa: string | null;
  sobreFoto: boolean;
}) {
  const nodos = useRef(new Map<string, HTMLLIElement>());
  const [encima, setEncima] = useState<string | null>(null);
  const [marca, setMarca] = useState({ left: 0, width: 0 });

  const marcada = encima ?? activa;

  // `useLayoutEffect` y no `useEffect`: midiendo después del pintado, la marca
  // aparece un fotograma en la posición vieja y da un salto visible al cargar.
  useLayoutEffect(() => {
    function medir() {
      const nodo = marcada ? nodos.current.get(marcada) : null;
      // `offsetLeft` es relativo al `<ul>`, que es el elemento posicionado. Con
      // `getBoundingClientRect` habría que restar la del padre y compensar el
      // scroll de la página, y la marca se descolocaría al desplazarse.
      if (nodo) setMarca({ left: nodo.offsetLeft, width: nodo.offsetWidth });
    }
    medir();

    // Al cambiar el ancho de la ventana los enlaces se mueven y la marca se
    // quedaría donde estaba.
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [marcada]);

  return (
    <ul
      className="relative flex w-fit items-center gap-0.5"
      onMouseLeave={() => setEncima(null)}
    >
      <li
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute z-0 h-9 rounded-full transition-[left,width,opacity,background-color] duration-240 ease-hatril motion-reduce:transition-none',
          sobreFoto ? 'bg-white/18' : 'bg-support',
        )}
        style={{
          left: marca.left,
          width: marca.width,
          opacity: marcada ? 1 : 0,
        }}
      />

      {secciones.map((s) => (
        <li
          key={s.href}
          ref={(nodo) => {
            if (nodo) nodos.current.set(s.href, nodo);
            else nodos.current.delete(s.href);
          }}
          className="relative z-10"
        >
          <a
            href={s.href}
            aria-current={activa === s.href ? 'true' : undefined}
            onMouseEnter={() => setEncima(s.href)}
            onFocus={() => setEncima(s.href)}
            className={clsx(
              // `px-3` y no `px-4`: con siete secciones eso son 56px de menos,
              // y es lo que deja entrar el botón de donar y el de cuenta sin
              // cortar el nombre de la iglesia a 1280.
              'block rounded-full px-3 py-2 text-[12.5px] font-bold tracking-[0.06em] whitespace-nowrap uppercase no-underline transition-colors duration-240 ease-hatril hover:no-underline motion-reduce:transition-none',
              // Sobre la foto, siempre blanco: translúcido, en el peor punto de
              // la foto, se quedaba por debajo de 4:1.
              sobreFoto || marcada === s.href
                ? 'text-white hover:text-white'
                : // Al pasar por encima, `encima` ya mueve la marca y cae en la
                  // rama de arriba. Esto solo cuenta antes de hidratar, cuando no
                  // hay marca debajo: en blanco sobre la banda clara daba 1.1:1.
                  'text-muted-foreground hover:text-foreground focus-visible:text-foreground',
            )}
          >
            {s.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Justo debajo de la cabecera recogida (56px en el móvil, 64 en escritorio),
 *  con margen: la línea a partir de la cual se considera que una sección ya se
 *  está leyendo y no que todavía está entrando. */
const LINEA_DE_LECTURA = 96;

/**
 * Qué sección se está leyendo: la última cuyo comienzo ya ha pasado por debajo
 * de la cabecera.
 *
 * ESTO EMPEZÓ SIENDO UN `IntersectionObserver` Y ESTABA MAL
 * ---------------------------------------------------------
 * La primera versión marcaba la primera sección que tocara una banda de la
 * pantalla. Al saltar a «Devocional» seguía marcando «Horarios», y el motivo
 * tardó en verse: la sección anterior asomaba CUATRO PÍXELES por encima del
 * borde de la banda, y con eso ya contaba como visible. Se veía perfectamente en
 * el navegador y no se habría visto nunca leyendo el código.
 *
 * Y no bastaba con ajustar los márgenes. El observador avisa cuando una sección
 * ENTRA o SALE de la banda; el dato que hace falta —cuál ha pasado ya por debajo
 * de la cabecera— cambia sin que ninguna entre ni salga, porque las secciones
 * miden más que la pantalla. Era la herramienta equivocada para la pregunta.
 *
 * Un `scroll` pasivo limitado a un fotograma cuesta cinco `getBoundingClientRect`
 * por fotograma solo mientras se desplaza. En una página de siete secciones eso
 * no se nota ni en un móvil viejo.
 */
function useSeccionActiva(secciones: Seccion[]) {
  const [activa, setActiva] = useState<string | null>(null);

  useEffect(() => {
    if (secciones.length === 0) return;

    let pendiente = 0;

    function calcular() {
      pendiente = 0;

      let encontrada: string | null = null;
      for (const s of secciones) {
        const nodo = document.getElementById(s.href.slice(1));
        if (nodo && nodo.getBoundingClientRect().top <= LINEA_DE_LECTURA) {
          encontrada = s.href;
        }
      }

      // Al final del documento manda la última sección: el pie y el contacto
      // caben juntos en pantalla, y sin esto «Contacto» no llega a marcarse
      // nunca en una pantalla alta.
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      ) {
        encontrada = secciones[secciones.length - 1].href;
      }

      setActiva(encontrada);
    }

    function alDesplazar() {
      if (pendiente) return;
      pendiente = requestAnimationFrame(calcular);
    }

    calcular();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      cancelAnimationFrame(pendiente);
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, [secciones]);

  return activa;
}
