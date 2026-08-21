'use client';

import Link from 'next/link';
import { Bell, Check } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { abrirAviso, marcarTodoLeido } from '@/app/mi/avisos/actions';

/**
 * La campana de la cabecera.
 *
 * POR QUÉ VIVE EN `src/components` Y NO EN `panel/_components`
 * -----------------------------------------------------------
 * Estaba en `src/app/panel/_components/`, que en el App Router significa
 * «privado de esta ruta». Dejó de serlo el día que el área del miembro
 * (`/mi/comunidad`) necesitó la misma campana: o se movía aquí, o se copiaba, y
 * una campana copiada son dos sitios donde arreglar el punto rojo. Se movió
 * también `menu-cuenta.tsx`, que va siempre a su lado.
 *
 * POR QUÉ UN DESPLEGABLE Y NO UNA SECCIÓN DEL MENÚ
 * -----------------------------------------------
 * Los avisos eran una entrada más del menú lateral que llevaba a `/mi/avisos`,
 * una pantalla fuera del panel: al pulsarla desaparecía el menú y no había
 * forma evidente de volver. Y un aviso se consulta de pasada —«¿tengo algo?»—,
 * no se va a visitar como quien abre Miembros.
 *
 * LA PÁGINA `/mi/avisos` SIGUE EXISTIENDO, Y NO ES REDUNDANCIA
 * -----------------------------------------------------------
 * Es la única pantalla del producto que funciona para alguien que NO pertenece
 * a ninguna congregación: al rechazar una solicitud se borra la membresía en el
 * mismo movimiento, y el aviso que le explica por qué se le quedaría fuera de
 * alcance con cualquier guard de iglesia. Esta campana se pinta solo donde hay
 * congregación detrás —el panel y el muro de la comunidad, los dos tras
 * `requireIglesia`—, así que esa persona no la vería nunca. Por eso el pie del
 * desplegable lleva a la página y la página se queda.
 *
 * LOS DATOS VIENEN COMPUESTOS DEL SERVIDOR
 * ----------------------------------------
 * Título, detalle y «hace 3 min» se calculan arriba. Aquí no se importa
 * `textoNotificacion` ni `haceCuanto` para no arrastrar al navegador el
 * catálogo entero de textos por un desplegable que la mayoría no abre.
 */

export type AvisoEnCampana = {
  id: string;
  titulo: string;
  detalle: string | null;
  cuando: string;
  leida: boolean;
};

export function Campana({
  avisos,
  sinLeer,
}: {
  avisos: AvisoEnCampana[];
  /** Ya viene cortado en 99 desde la consulta. */
  sinLeer: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className="relative flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 data-popup-open:bg-background data-popup-open:text-foreground"
        aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      >
        <Bell className="size-[19px]" strokeWidth={1.7} />
        {sinLeer > 0 && (
          // Un punto y no el número: al lado del avatar y del menú, tres cifras
          // seguidas compiten entre ellas. El recuento exacto está dentro.
          <span className="absolute right-[7px] top-[7px] size-2 rounded-full bg-primary ring-2 ring-surface" />
        )}
      </PopoverTrigger>

      <PopoverContent className="flex w-[360px] max-w-[calc(100vw-24px)] flex-col">
        <div className="flex flex-none items-center gap-3 border-b border-border px-4 py-3">
          <span className="t-micro">Avisos</span>
          <span className="flex-1" />
          {sinLeer > 0 && (
            <form action={marcarTodoLeido}>
              <button
                type="submit"
                className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Check className="size-3.5" strokeWidth={2} />
                Marcar todo
              </button>
            </form>
          )}
        </div>

        <div className="flex max-h-[min(420px,60vh)] flex-col overflow-y-auto">
          {avisos.length === 0 ? (
            <p className="text-pretty px-4 py-6 text-center text-[13.5px] leading-relaxed text-muted-foreground">
              No tienes avisos. Aquí aparecen los comentarios a lo que publicas,
              tus turnos de devocional y las solicitudes resueltas.
            </p>
          ) : (
            avisos.map((a) => (
              // Cada aviso es un formulario y no un enlace: al pulsarlo hay que
              // marcarlo leído ANTES de llevar a ninguna parte, y eso es una
              // escritura. Un `<a>` con un `fetch` al lado se queda a medias en
              // cuanto la navegación gana la carrera.
              <form key={a.id} action={abrirAviso.bind(null, a.id)}>
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-start gap-2.5 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background"
                >
                  <span className="mt-[7px] flex size-2 flex-none items-center justify-center">
                    {!a.leida && (
                      <>
                        <span className="size-2 rounded-full bg-support" />
                        <span className="sr-only">Sin leer</span>
                      </>
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={
                        'text-pretty text-[13.5px] leading-snug ' +
                        (a.leida ? 'font-medium' : 'font-bold')
                      }
                    >
                      {a.titulo}
                    </span>

                    {a.detalle && (
                      <span className="line-clamp-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                        {a.detalle}
                      </span>
                    )}

                    <span className="text-[12px] text-muted-foreground">
                      {a.cuando}
                    </span>
                  </span>
                </button>
              </form>
            ))
          )}
        </div>

        {avisos.length > 0 && (
          <Link
            href="/mi/avisos"
            className="flex-none border-t border-border px-4 py-2.5 text-center text-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-background hover:no-underline"
          >
            Verlos todos
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
