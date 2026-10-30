'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Users } from 'lucide-react';

import { Logo } from '@/components/marca/logo';
import { Button } from '@/components/ui/button';
import { COOKIE_BIENVENIDA } from '@/lib/bienvenida';

/**
 * La presentación: tres pantallas, la primera vez que se abre la app.
 *
 * SIN LIBRERÍA DE CARRUSEL
 * ------------------------
 * Un contenedor con `scroll-snap`: el navegador ya sabe hacer que el texto siga
 * al dedo y se quede en su pantalla al soltar, y lo hace mejor que cualquier
 * cosa escrita a mano. Lo único de JavaScript es saber en qué pantalla se está,
 * para los puntos de abajo y para animar solo la que se ve.
 *
 * LO QUE SE ENSEÑA EXISTE
 * -----------------------
 * Las piezas son trozos de la propia interfaz —una publicación, la agenda, el
 * devocional— y no prometen nada que la app no haga. El diseño ponía «Orando ·
 * 24» debajo de la publicación; aquí es un me gusta, porque reacciones de
 * oración no hay.
 */
const PANTALLAS = [
  {
    titulo: 'Tu iglesia, contigo toda la semana',
    texto:
      'Lo que pasa en tu comunidad entre domingo y domingo: avisos, fotos y peticiones de oración, en un solo muro.',
    piezas: <PiezasMuro />,
  },
  {
    titulo: 'Lo que te toca, a tiempo',
    texto:
      'Tu agenda y tus turnos de servicio en un solo sitio. El ensayo del jueves ya no se pierde entre veinte grupos de chat.',
    piezas: <PiezasAgenda />,
  },
  {
    titulo: 'Una palabra cada día',
    texto:
      'El devocional de tu iglesia, escrito por tu pastor y por los tuyos. Cada mañana, listo para leer.',
    piezas: <PiezasDevocional />,
  },
];

export function Presentacion() {
  const router = useRouter();
  const carril = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);

  useEffect(() => {
    const el = carril.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const i = Number((e.target as HTMLElement).dataset.indice);
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.visible = 'true';
            setActual(i);
          }
        }
      },
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll('[data-indice]').forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  function terminar() {
    // Un año: «solo la primera vez» quiere decir eso. Se guarda en una cookie y
    // no en `localStorage` porque quien decide si enseñarla es el servidor, en
    // `/mi`, antes de pintar nada.
    document.cookie = `${COOKIE_BIENVENIDA}=1; max-age=31536000; path=/; samesite=lax`;
    router.replace('/empezar');
  }

  function siguiente() {
    const el = carril.current;
    if (!el) return;
    if (actual >= PANTALLAS.length - 1) return terminar();
    el.scrollTo({ left: el.clientWidth * (actual + 1), behavior: 'smooth' });
  }

  const ultima = actual === PANTALLAS.length - 1;

  return (
    <div className="flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex h-[52px] flex-none items-center justify-end px-3">
        <button
          type="button"
          onClick={terminar}
          className="flex h-11 cursor-pointer items-center rounded-lg px-3 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          Saltar
        </button>
      </div>

      <div
        ref={carril}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PANTALLAS.map((p, i) => (
          <section
            key={p.titulo}
            data-indice={i}
            aria-roledescription="pantalla"
            aria-label={`${i + 1} de ${PANTALLAS.length}`}
            className="mx-auto flex w-full max-w-[480px] flex-none snap-center snap-always flex-col"
          >
            <div aria-hidden className="flex min-h-0 flex-1 flex-col items-center justify-end gap-3 overflow-hidden px-7 pt-2">
              <span className="presentacion-pieza" style={{ '--orden': 0 } as React.CSSProperties}>
                <Logo variante="simbolo" tamano={52} />
              </span>
              {p.piezas}
            </div>

            <div className="presentacion-texto flex flex-none flex-col gap-3 px-7 pt-6">
              <h1 className="text-balance text-[30px] leading-[1.12] font-extrabold tracking-[-0.025em]">
                {p.titulo}
              </h1>
              <p className="text-pretty text-[16px] leading-relaxed text-muted-foreground">
                {p.texto}
              </p>
            </div>
          </section>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-[480px] flex-none flex-col gap-5 px-6 pt-6">
        <div
          role="img"
          aria-label={`Pantalla ${actual + 1} de ${PANTALLAS.length}`}
          className="flex justify-center gap-1.5"
        >
          {PANTALLAS.map((p, i) => (
            <span
              key={p.titulo}
              className={
                'h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ' +
                (i === actual ? 'w-[22px] bg-support' : 'w-1.5 bg-border')
              }
            />
          ))}
        </div>

        {/* Un solo naranja, y al final: «Siguiente» es el secundario. */}
        <Button
          type="button"
          size="lg"
          variant={ultima ? 'default' : 'secondary'}
          className="h-[52px] w-full text-[16px]"
          onClick={siguiente}
        >
          {ultima ? 'Empezar' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}

function Pieza({
  orden,
  className = '',
  children,
}: {
  orden: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={'presentacion-pieza rounded-xl border border-border bg-surface p-3.5 ' + className}
      style={{ '--orden': orden } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function PiezasMuro() {
  return (
    <>
      <Pieza orden={1} className="flex w-full flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-foreground">
            RP
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-bold">Ruth Pérez</span>
            <span className="text-[11px] text-muted-foreground">hace 2 h</span>
          </span>
        </div>
        <p className="text-[13px] leading-snug">
          Gracias a todos por orar. Mi madre ya está en casa. ¡Qué familia
          tenemos!
        </p>
        <div className="flex gap-3 text-[12px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-primary">
            <Heart className="size-[14px]" strokeWidth={1.8} fill="currentColor" /> 24
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-[14px]" strokeWidth={1.8} /> 6
          </span>
        </div>
      </Pieza>
      <Pieza orden={2} className="flex w-[94%] items-start gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-surface-alt text-support">
          <Users className="size-[18px]" strokeWidth={1.8} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            Jóvenes · Aviso
          </span>
          <span className="text-[13px] leading-snug">
            Sábado, limpieza de la playa. Quedamos a las 9:00 en la puerta.
          </span>
        </span>
      </Pieza>
    </>
  );
}

function PiezasAgenda() {
  const filas = [
    { dia: 'MIÉ', que: 'Oración', donde: '19:30 · Templo', tuyo: false },
    { dia: 'JUE', que: 'Ensayo de alabanza', donde: '19:30 · Sala de música', tuyo: true },
    { dia: 'DOM', que: 'Culto · Acogida en la puerta', donde: '10:30 · Con Daniel y Sara', tuyo: true },
  ];
  return (
    <>
      <Pieza orden={1} className="flex w-full flex-col gap-0.5 border-primary/40 bg-accent">
        <span className="text-[11px] font-bold tracking-[0.06em] text-accent-foreground uppercase">
          Mañana · Ensayo de alabanza
        </span>
        <span className="text-[14px] font-bold text-accent-foreground">
          Jueves 19:30 · Te toca el teclado
        </span>
      </Pieza>
      <Pieza orden={2} className="flex w-full flex-col gap-2 p-3">
        <span className="px-0.5 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          Esta semana
        </span>
        {filas.map((f) => (
          <div key={f.dia} className="flex items-center gap-3">
            <span className="w-9 flex-none text-[11px] font-bold text-muted-foreground">{f.dia}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold">{f.que}</span>
              <span className="truncate text-[11.5px] text-muted-foreground">{f.donde}</span>
            </span>
            {f.tuyo && (
              <span className="flex-none rounded-full bg-badge-accent-bg px-2 py-0.5 text-[11px] font-semibold text-badge-accent-fg">
                Te toca
              </span>
            )}
          </div>
        ))}
      </Pieza>
    </>
  );
}

function PiezasDevocional() {
  return (
    <Pieza orden={1} className="flex w-full flex-col gap-3 p-4">
      <span className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
        Devocional · Viernes 30
      </span>
      <span className="text-[19px] leading-tight font-extrabold tracking-[-0.02em]">
        Descansar sin culpa
      </span>
      {/* De la Reina-Valera 1909, que es la Biblia de la app. */}
      <blockquote className="border-l-2 border-primary pl-3 text-[14px] leading-snug">
        «Venid á mí todos los que estáis trabajados y cargados, que yo os haré
        descansar.»
        <span className="mt-1 block text-[12px] font-semibold text-muted-foreground">
          Mateo 11:28
        </span>
      </blockquote>
      <div className="flex items-center gap-2.5 border-t border-border pt-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-badge-success-bg text-[11px] font-bold text-badge-success-fg">
          AD
        </span>
        <span className="flex flex-col">
          <span className="text-[12.5px] font-semibold">Escrito por Ana Díaz</span>
          <span className="text-[11px] text-muted-foreground">3 min de lectura</span>
        </span>
      </div>
    </Pieza>
  );
}
