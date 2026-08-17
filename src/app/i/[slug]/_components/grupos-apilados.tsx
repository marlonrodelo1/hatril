import Image from 'next/image';

import { colorDeMinisterio } from '@/lib/ministerios/colores';

/**
 * Los grupos de la iglesia, apilándose al bajar.
 *
 * SIN JAVASCRIPT, NI UNA LÍNEA
 * ----------------------------
 * El efecto de tarjetas que se quedan pegadas y se van montando una sobre otra
 * es `position: sticky` con un `top` que crece un poco en cada una. El navegador
 * hace todo el trabajo.
 *
 * La referencia que inspiró esto usaba `framer-motion` con `useScroll` y
 * `useTransform`, que además de la librería obliga a que el componente sea de
 * cliente y a recalcular en cada fotograma del scroll. Aquí es un componente de
 * servidor: cero JavaScript enviado al navegador para una sección que es puro
 * contenido.
 *
 * EL DESPLAZAMIENTO EN VERTICAL LO DA EL ALTO
 * -------------------------------------------
 * Cada tarjeta ocupa una pantalla; al pegarse, la siguiente sube por encima. El
 * `top` incremental deja asomando el borde superior de las anteriores, que es lo
 * que da la sensación de baraja.
 */
export function GruposApilados({
  grupos,
}: {
  grupos: {
    id: string;
    nombre: string;
    descripcion: string | null;
    colorHex: string;
    fotoUrl: string | null;
  }[];
}) {
  return (
    <div className="flex flex-col">
      {grupos.map((g, i) => {
        const color = colorDeMinisterio(g.colorHex);

        return (
          <div
            key={g.id}
            className="sticky"
            // `top` en línea y no con clases de Tailwind: es un valor calculado
            // por posición, y generar `top-[24px]`, `top-[46px]`… a mano sería
            // una clase por tarjeta que además Tailwind no puede purgar bien.
            style={{ top: `${24 + i * 22}px` }}
          >
            <article
              className="relative flex min-h-[440px] flex-col justify-end overflow-hidden rounded-2xl border border-border p-8 md:min-h-[520px] md:p-12"
              style={{ background: g.fotoUrl ? undefined : color.suave }}
            >
              {g.fotoUrl ? (
                <>
                  <Image
                    src={g.fotoUrl}
                    alt={g.nombre}
                    fill
                    sizes="(max-width: 768px) 100vw, 1180px"
                    className="object-cover"
                  />
                  {/* El mismo velo plano que el carrusel del hero, por la misma
                      razón: el texto tiene que leerse sobre cualquier foto. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[#1A1A1A]/55"
                  />
                </>
              ) : null}

              <div className="relative flex flex-col gap-3">
                <span
                  className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.06em]"
                  style={
                    g.fotoUrl
                      ? { background: 'rgb(255 255 255 / 0.15)', color: '#fff' }
                      : { background: '#fff', color: color.hex }
                  }
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: g.fotoUrl ? '#fff' : color.hex }}
                  />
                  Grupo
                </span>

                <h3
                  className="text-pretty text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[44px]"
                  style={{ color: g.fotoUrl ? '#fff' : color.hex }}
                >
                  {g.nombre}
                </h3>

                {g.descripcion && (
                  <p
                    className="max-w-[520px] text-pretty text-[15.5px] leading-relaxed md:text-[17px]"
                    style={{
                      color: g.fotoUrl ? 'rgb(255 255 255 / 0.85)' : '#1A1A1A',
                    }}
                  >
                    {g.descripcion}
                  </p>
                )}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
