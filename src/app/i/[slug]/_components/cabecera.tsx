'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HandHeart, MapPin, Menu, UserRound, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type Seccion = { href: string; texto: string };

/** Cómo se dona a esta iglesia. `null` si todavía no lo ha configurado. */
export type Donativos = { cuenta: string; titular: string | null };

/**
 * La cabecera de la web pública: una píldora que flota sobre el contenido.
 *
 * POR QUÉ UNA SOLA PÍLDORA Y NO UNA BANDA
 * ---------------------------------------
 * Antes eran dos cosas encajadas: una banda de cristal a todo lo ancho y, dentro,
 * otra cápsula con borde para el menú. Dos bordes de 1px a cuatro píxeles de
 * distancia, que es justo lo que el sistema de diseño evita. Ahora el borde es
 * uno: el de la píldora. El menú de dentro solo aporta la marca verde que se
 * mueve.
 *
 * Y flotando se ve que hay página debajo sin necesidad de tapar nada, que es lo
 * que el desenfoque intentaba conseguir a costa de una banda opaca.
 *
 * EL MENÚ EXISTE EN MÓVIL
 * -----------------------
 * Esto es lo que faltaba de verdad. Las secciones estaban en `hidden lg:flex`:
 * por debajo de 1024px la web no tenía navegación ninguna, y más de la mitad de
 * las visitas llegan por un enlace de WhatsApp abierto en un móvil. Quien entra
 * buscando a qué hora es el culto tenía que desplazarse a ciegas.
 *
 * Y EL CORTE SUBIÓ DE `lg` A `xl` CUANDO LLEGARON LOS EVENTOS
 * -----------------------------------------------------------
 * Con cinco secciones, el menú ya ocupaba 589 de los 929px de la píldora a
 * 1024px — está medido más abajo, donde se explica por qué solo cabe un botón
 * de acción. «Eventos» añade otros noventa y pico, y lo que se come es el
 * nombre de la iglesia, que es lo último que debe encogerse en su propia web.
 *
 * Así que entre 1024 y 1279px manda la hamburguesa, que no pierde nada: el menú
 * completo está dentro. Si algún día se quita una sección, esto se puede
 * devolver a `lg`, pero hay que MIRARLO a 1024 exactos con un nombre largo, no
 * razonarlo.
 *
 * LA MARCA SIGUE AL RATÓN, PERO TAMBIÉN A LA LECTURA
 * --------------------------------------------------
 * La versión anterior movía la píldora solo con `onMouseEnter`. En un móvil no
 * hay ratón, así que era decoración que nadie veía nunca. Ahora un
 * `IntersectionObserver` marca la sección que se está leyendo, y el ratón —si lo
 * hay— manda por encima mientras esté encima.
 *
 * SIN LIBRERÍA DE ANIMACIÓN
 * -------------------------
 * Mover `left` y `width` con `transition` es una línea de CSS. Traer
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
}: {
  nombre: string;
  ciudad: string | null;
  logoUrl: string | null;
  iniciales: string;
  secciones: Seccion[];
  tieneContacto: boolean;
  donativos: Donativos | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [donarAbierto, setDonarAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cerrar el menú al pulsar fuera, al escapar y al llegar a un ancho donde el
  // menú de escritorio ya está visible. Sin esto último, quien gira el móvil se
  // queda con el panel abierto encima de una cabecera que ya no lo necesita.
  useEffect(() => {
    if (!abierto) return;

    function fuera(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    const ancho = window.matchMedia('(min-width: 1024px)');
    function cambioAncho() {
      if (ancho.matches) setAbierto(false);
    }

    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    ancho.addEventListener('change', cambioAncho);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
      ancho.removeEventListener('change', cambioAncho);
    };
  }, [abierto]);

  const activa = useSeccionActiva(secciones);

  return (
    // El mismo sangrado lateral que las secciones: así los bordes de la píldora
    // caen justo encima de los de la foto del hero. Con 12px contra los 16 de la
    // página, la píldora sobresalía cuatro píxeles y parecía descuadrada.
    <header className="sticky top-0 z-30 px-4 pt-3 sm:px-5 md:px-10 md:pt-4">
      <div ref={contenedor} className="relative mx-auto max-w-[1180px]">
        {/*
         * `p-1.5` y no más: dentro va un botón de 40px de alto, así que la
         * píldora mide 52 y sigue siendo una barra, no un bloque. El cristal es
         * el único sitio de la página donde el efecto significa algo, porque
         * aquí el contenido pasa de verdad por debajo.
         */}
        {/*
         * En escritorio son tres columnas: identidad, menú y acción. La del
         * medio es la que se estira, no las de los lados.
         *
         * Con `1fr auto 1fr` el menú quedaba matemáticamente centrado, pero a
         * 1024px la columna de la izquierda se quedaba en 120px y «Iglesia
         * Betania» salía cortado con puntos suspensivos. El nombre de la iglesia
         * es lo último que puede recortarse en su propia web; que el menú quede
         * unos píxeles a un lado no lo nota nadie.
         */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-alt p-1.5 supports-[backdrop-filter]:bg-surface-alt/80 supports-[backdrop-filter]:backdrop-blur-xl md:gap-4 xl:grid xl:grid-cols-[auto_1fr_auto] xl:gap-3 2xl:gap-4">
          {/* Identidad. `min-w-0` para que el nombre pueda encogerse: sin él, un
              nombre largo empuja al botón fuera de la píldora en un móvil de
              320px. */}
          <a
            href="#"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full pl-1 no-underline hover:no-underline xl:flex-none"
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={nombre}
                width={36}
                height={36}
                className="size-9 flex-none rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-primary text-[13.5px] font-bold tracking-[-0.02em] text-primary-foreground">
                {iniciales}
              </span>
            )}
            <span className="flex min-w-0 flex-col xl:max-w-[260px]">
              <span className="truncate text-[15px] font-bold leading-tight tracking-[-0.018em] text-foreground">
                {nombre}
              </span>
              {ciudad && (
                <span className="truncate text-[12px] leading-tight text-muted-foreground">
                  {ciudad}
                </span>
              )}
            </span>
          </a>

          {/* El menú solo lista las secciones que existen. Un ancla a una sección
              que no se ha pintado deja al visitante donde estaba sin que pase
              nada, y parece que la web está rota. */}
          {secciones.length > 0 && (
            <nav className="hidden xl:flex xl:justify-center">
              <MenuEscritorio secciones={secciones} activa={activa} />
            </nav>
          )}

          <div className="flex flex-none items-center gap-2 xl:justify-end">
            {/*
             * UN SOLO BOTÓN AQUÍ, Y VERDE.
             *
             * Verde y no naranja porque en la primera pantalla ya hay un «Cómo
             * llegar» naranja dentro del hero, y el sistema de diseño admite un
             * solo naranja por pantalla: dos iguales compitiendo y ninguno
             * destaca.
             *
             * Y uno solo porque los dos juntos no caben: a 1024px el menú ya
             * ocupa 589 de los 929 de la píldora. Donar manda cuando la iglesia
             * tiene por dónde recibir; si no, el sitio es para «Cómo llegar». En
             * escritorio no se pierde nada: «Contacto» está en el menú.
             */}
            {donativos ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="hidden h-10 px-4 sm:inline-flex"
                onClick={() => setDonarAbierto(true)}
              >
                <HandHeart strokeWidth={1.8} />
                Donar
              </Button>
            ) : (
              tieneContacto && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="hidden h-10 px-4 sm:inline-flex"
                  render={<a href="#contacto" />}
                >
                  <MapPin strokeWidth={1.8} />
                  Cómo llegar
                </Button>
              )
            )}

            {/* En escritorio no hay menú donde meterla, así que la cuenta va
                aquí como icono. Solo el icono: a 1024px el menú ya se come 589
                de los 929 de la píldora y con texto no cabría. */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mi cuenta"
              className="hidden size-10 rounded-full xl:inline-flex"
              render={<Link href="/mi" />}
            >
              <UserRound strokeWidth={1.8} className="size-[19px]" />
            </Button>

            {secciones.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={abierto}
                aria-controls="menu-movil"
                aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
                // 44px, que es el mínimo de un objetivo táctil. El `size="icon"`
                // del sistema son 40 y aquí es el único control de la cabecera
                // en un móvil: si falla, no hay otra forma de navegar.
                className="size-11 rounded-full xl:hidden"
                onClick={() => setAbierto((v) => !v)}
              >
                {abierto ? (
                  <X strokeWidth={2} className="size-[22px]" />
                ) : (
                  <Menu strokeWidth={2} className="size-[22px]" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* El panel del menú, colgando de la píldora. Sin sombra: el borde de 1px
            y el cristal ya lo separan del contenido. */}
        {abierto && (
          <div
            id="menu-movil"
            className="absolute inset-x-0 top-[calc(100%+8px)] flex flex-col gap-1 rounded-3xl border border-border bg-surface-alt p-2 supports-[backdrop-filter]:bg-surface-alt/95 supports-[backdrop-filter]:backdrop-blur-xl xl:hidden"
          >
            {secciones.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={() => setAbierto(false)}
                aria-current={activa === s.href ? 'true' : undefined}
                className={
                  'flex min-h-[48px] items-center rounded-2xl px-4 text-[15px] font-bold no-underline transition-colors hover:no-underline active:bg-background ' +
                  (activa === s.href
                    ? 'bg-support text-white'
                    : 'text-foreground hover:bg-background')
                }
              >
                {s.texto}
              </a>
            ))}

            {/* Donar vive aquí y no en una franja de la página. Es el sitio
                donde alguien lo busca a propósito, no algo con lo que se tropieza
                al bajar. */}
            {donativos && (
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="mt-1 w-full rounded-2xl"
                onClick={() => {
                  setAbierto(false);
                  setDonarAbierto(true);
                }}
              >
                <HandHeart strokeWidth={1.8} />
                Donar
              </Button>
            )}

            {tieneContacto && (
              <Button
                size="lg"
                variant={donativos ? 'outline' : 'secondary'}
                className="w-full rounded-2xl"
                render={<a href="#contacto" onClick={() => setAbierto(false)} />}
              >
                <MapPin strokeWidth={1.8} />
                Cómo llegar
              </Button>
            )}

            {/*
             * UN SOLO ENLACE PARA LOS TRES CASOS
             *
             * No dice «Entrar» o «Mi cuenta» según haya sesión, y es a propósito:
             * esta página es estática con revalidación de 60 segundos, así que
             * para saber quién mira habría que hacerla dinámica —una consulta a
             * Irlanda por visita— o resolverlo en el navegador, que enseña un
             * botón y lo cambia medio segundo después.
             *
             * `/mi` ya reparte sola: sin sesión manda a entrar y vuelve aquí,
             * con iglesia va al panel, y con cuenta sin iglesia enseña en qué
             * punto está su solicitud.
             */}
            <Link
              href="/mi"
              onClick={() => setAbierto(false)}
              className="mt-1 flex min-h-[48px] items-center gap-3 rounded-2xl border-t border-border px-4 pt-3 text-[15px] font-bold text-foreground no-underline transition-colors hover:bg-background hover:text-foreground hover:no-underline active:bg-background"
            >
              <UserRound strokeWidth={1.8} className="size-[19px]" />
              Mi cuenta
            </Link>
          </div>
        )}

        {donativos && (
          <VentanaDonar
            abierta={donarAbierto}
            alCerrar={setDonarAbierto}
            nombre={nombre}
            donativos={donativos}
          />
        )}
      </div>
    </header>
  );
}

/**
 * Cómo donar, en una ventana.
 *
 * PENDIENTE: EL BOTÓN DE STRIPE
 * -----------------------------
 * Aquí es donde entra el pago con tarjeta cuando estén los datos de Stripe. Lo
 * que hoy hay —el número de cuenta— no se va a ir con él: no todas las iglesias
 * van a tener Stripe el primer día, y la que solo tiene una cuenta bancaria
 * tiene que poder seguir recibiendo. El botón de tarjeta se pondrá arriba y la
 * transferencia se quedará debajo como la otra forma.
 *
 * Falta decidir una cosa que cambia dónde se guarda: si cada iglesia pega su
 * propio enlace de pago, va una columna en `iglesias`; si el cobro pasa por la
 * cuenta de Hatril con Connect, va el identificador de la cuenta conectada y un
 * endpoint que cree la sesión. Hasta saberlo no se inventa el esquema.
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
          <DialogDescription className="text-[14px] leading-relaxed">
            Se hace por transferencia directamente a la cuenta de la iglesia.
            Hatril no cobra ni guarda datos de tarjetas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-alt p-4">
          <span className="t-micro">Número de cuenta</span>
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
 * Las secciones en escritorio, con la marca verde que se mueve.
 *
 * La marca va DETRÁS de los enlaces y el texto de encima pasa a blanco. La
 * referencia original resolvía lo mismo con `mix-blend-difference`, que invierte
 * el color contra lo que tenga debajo; aquí no hace falta y además se evita su
 * efecto secundario, que era invertir también el fondo de la cabecera al
 * desplazarse.
 *
 * Verde `support` y no el naranja de marca porque en esta misma píldora ya está
 * «Cómo llegar».
 */
function MenuEscritorio({
  secciones,
  activa,
}: {
  secciones: Seccion[];
  activa: string | null;
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
        className="pointer-events-none absolute z-0 h-9 rounded-full bg-support transition-[left,width,opacity] duration-300 ease-out"
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
            className={
              // `px-3` y no `px-4`: con cinco secciones eso son 40px de menos, y
              // 40px es justo lo que faltaba a 1024 para que el icono de cuenta
              // entrara sin cortar el nombre de la iglesia. A partir de 1280
              // sobra sitio y vuelve a respirar.
              'block whitespace-nowrap rounded-full px-3 py-2 text-[12.5px] font-bold uppercase tracking-[0.06em] no-underline transition-colors hover:no-underline xl:px-4 ' +
              (marcada === s.href
                ? 'text-white'
                : 'text-muted-foreground hover:text-white focus-visible:text-white')
            }
          >
            {s.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Justo debajo de la píldora: la línea a partir de la cual se considera que
 *  una sección ya se está leyendo y no que todavía está entrando. */
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
