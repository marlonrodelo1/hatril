import { Heart, MessageCircle, Trash2 } from 'lucide-react';

import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import type { PublicacionMuro } from '@/lib/comunidad/consultas';
import {
  alternarMeGusta,
  borrarComentario,
  borrarPublicacion,
  comentar,
} from '../actions';

/**
 * Una publicación del muro.
 *
 * COMPONENTE DE SERVIDOR, Y TODO CON `<form>`
 * -------------------------------------------
 * El corazón, el comentario y el borrar son tres formularios que llaman a una
 * server action. Ni un `use client`, ni un `useState`, ni un solo kilobyte de
 * JavaScript enviado al navegador para una pantalla que es, sobre todo, texto y
 * fotos.
 *
 * El precio es que cada acción recarga la vista. En un muro de treinta
 * publicaciones eso se nota, y cuando se note habrá que traer `useOptimistic`
 * para el corazón. Se deja apuntado a propósito en vez de adelantarlo: es la
 * única parte que lo pediría, y hoy no hay usuarios para saberlo.
 */
export function Publicacion({
  publicacion: p,
  puedeModerar,
}: {
  publicacion: PublicacionMuro;
  puedeModerar: boolean;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <header className="flex items-center gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
          {iniciales(p.autorNombre)}
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14.5px] font-bold leading-tight tracking-[-0.015em]">
            {p.autorNombre}
          </span>
          <span className="text-[12.5px] leading-tight text-muted-foreground">
            {haceCuanto(p.createdAt)}
          </span>
        </span>

        <span className="flex-1" />

        {(p.esMia || puedeModerar) && (
          <form action={borrarPublicacion.bind(null, p.id)}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Borrar la publicación"
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="size-[17px]" strokeWidth={1.7} />
            </Button>
          </form>
        )}
      </header>

      {p.texto && (
        <p className="whitespace-pre-line text-pretty text-[15.5px] leading-relaxed">
          {p.texto}
        </p>
      )}

      {p.imagenes.length > 0 && (
        /*
         * `<img>` y no `next/image`.
         *
         * Estas URLs vienen firmadas y caducan en una hora. El optimizador de
         * Next las descargaría y las guardaría en su caché con una clave que
         * incluye la firma: la misma foto se reoptimizaría entera cada vez que
         * la firma cambia, y el disco del contenedor se llenaría de copias que
         * ya no sirven.
         */
        <div
          className={
            'grid gap-2 ' + (p.imagenes.length > 1 ? 'grid-cols-2' : 'grid-cols-1')
          }
        >
          {p.imagenes.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              loading="lazy"
              className={
                'w-full rounded-lg border border-border object-cover ' +
                (p.imagenes.length > 1 ? 'aspect-square' : 'max-h-[520px]')
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-border pt-2">
        <form action={alternarMeGusta.bind(null, p.id)}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            aria-pressed={p.leHeDado}
            className={
              p.leHeDado
                ? 'text-danger hover:bg-[#F3DEDD]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          >
            <Heart
              className="size-[17px]"
              strokeWidth={1.8}
              // Relleno cuando ya le has dado: el color por sí solo no basta
              // para quien no lo distingue.
              fill={p.leHeDado ? 'currentColor' : 'none'}
            />
            {p.meGusta > 0 ? p.meGusta : 'Me gusta'}
          </Button>
        </form>

        <span className="inline-flex items-center gap-1.5 px-2 text-[13.5px] text-muted-foreground">
          <MessageCircle className="size-[16px]" strokeWidth={1.8} />
          {p.comentarios.length}
        </span>
      </div>

      {p.comentarios.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {p.comentarios.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full bg-muted text-[10.5px] font-bold text-muted-foreground">
                {iniciales(c.autorNombre)}
              </span>

              <span className="flex min-w-0 flex-1 flex-col rounded-lg bg-background px-3 py-2">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[13.5px] font-bold">
                    {c.autorNombre}
                  </span>
                  <span className="flex-none text-[12px] text-muted-foreground">
                    {haceCuanto(c.createdAt)}
                  </span>
                </span>
                <span className="whitespace-pre-line text-pretty text-[14.5px] leading-relaxed">
                  {c.texto}
                </span>
              </span>

              {(c.esMio || puedeModerar) && (
                <form action={borrarComentario.bind(null, c.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Borrar el comentario"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="size-4" strokeWidth={1.7} />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={comentar.bind(null, p.id)} className="flex gap-2">
        <input
          name="texto"
          maxLength={1000}
          placeholder="Escribe un comentario"
          aria-label="Escribe un comentario"
          className="min-w-0 flex-1 rounded-lg border border-input bg-surface-alt px-3 py-2 text-[14.5px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
        <Button type="submit" variant="outline" size="sm" className="flex-none">
          Enviar
        </Button>
      </form>
    </article>
  );
}

/**
 * «Hace diez minutos», y a partir de una semana la fecha.
 *
 * Se calcula en el servidor, que es donde se pinta. Eso significa que usa la
 * hora del servidor y no la del móvil de quien mira: para «hace un rato» da
 * igual, y a cambio no hay que hidratar el componente ni arrastrar la
 * diferencia horaria de cada país.
 */
function haceCuanto(fecha: Date): string {
  const segundos = Math.max(0, (Date.now() - fecha.getTime()) / 1000);

  if (segundos < 60) return 'ahora mismo';

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;

  return fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
}
