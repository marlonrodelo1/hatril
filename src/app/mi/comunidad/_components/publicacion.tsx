import { Heart, Trash2 } from 'lucide-react';

import { iniciales } from '@/lib/format/iniciales';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import { Button } from '@/components/ui/button';
import type { PublicacionMuro } from '@/lib/comunidad/consultas';
import { alternarMeGusta, borrarPublicacion } from '../actions';
import { Comentarios, type ComentarioPintado } from './comentarios';

/**
 * Una publicación del muro.
 *
 * COMPONENTE DE SERVIDOR, Y CASI TODO CON `<form>`
 * ------------------------------------------------
 * El corazón y el borrar son formularios que llaman a una server action. Ni un
 * `useState` ni un kilobyte de JavaScript para una pantalla que es, sobre todo,
 * texto y fotos.
 *
 * La única pieza de cliente es la hoja de comentarios, y es porque necesita
 * estado en el navegador: si está abierta y a quién se responde. Aun así, los
 * botones de dentro siguen siendo formularios con server action.
 *
 * A SANGRE EN EL MÓVIL, TARJETA EN ESCRITORIO
 * -------------------------------------------
 * En un móvil de 375px, una tarjeta con borde a cada lado deja el texto en 311
 * píxeles útiles y hace que todo parezca apretado contra el marco del teléfono
 * —que es exactamente lo que se veía—. Con `-mx-4` la publicación ocupa el
 * ancho entero y la foto va a sangre, mientras el texto conserva sus 16 px de
 * aire por dentro. A partir de `sm` vuelve a ser una tarjeta con su borde,
 * porque en una pantalla ancha una banda de 900 px de borde a borde no se lee.
 */
export function Publicacion({
  publicacion: p,
  puedeModerar,
  admiteComentarios,
}: {
  publicacion: PublicacionMuro;
  puedeModerar: boolean;
  /**
   * Comentarios cerrados: no se pinta el campo de escribir, pero los que ya
   * existan se siguen leyendo y su autor los sigue pudiendo borrar. Cerrar no es
   * borrar, y es lo mismo que hace la `0027`: quita el INSERT y deja el SELECT
   * donde estaba.
   */
  admiteComentarios: boolean;
}) {
  /*
   * El «hace tanto» se calcula AQUÍ, en el servidor, y viaja ya escrito hasta la
   * hoja de comentarios. Llamar a `haceCuanto()` dentro del componente de
   * cliente daría un instante distinto del que usó el servidor y React se
   * quejaría al hidratar. El porqué largo está en `lib/format/hace-cuanto.ts`.
   */
  const comentarios: ComentarioPintado[] = p.comentarios.map((c) => ({
    id: c.id,
    texto: c.texto,
    cuando: haceCuanto(c.createdAt),
    autorNombre: c.autorNombre,
    esMio: c.esMio,
    meGusta: c.meGusta,
    leHeDado: c.leHeDado,
    respuestas: c.respuestas.map((r) => ({
      id: r.id,
      texto: r.texto,
      cuando: haceCuanto(r.createdAt),
      autorNombre: r.autorNombre,
      esMio: r.esMio,
      meGusta: r.meGusta,
      leHeDado: r.leHeDado,
      respuestas: [],
    })),
  }));

  return (
    <article className="-mx-4 flex flex-col gap-3 border-y border-border bg-surface px-4 py-3.5 sm:mx-0 sm:rounded-xl sm:border sm:p-4">
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
         *
         * `-mx-4` para que en el móvil la foto llegue hasta el borde, como en
         * cualquier muro que la gente ya usa. En escritorio vuelve dentro de la
         * tarjeta y recupera su borde redondeado.
         */
        <div
          className={
            '-mx-4 grid gap-1 sm:mx-0 sm:gap-2 ' +
            (p.imagenes.length > 1 ? 'grid-cols-2' : 'grid-cols-1')
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
                'w-full object-cover sm:rounded-lg sm:border sm:border-border ' +
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
            aria-label={p.leHeDado ? 'Quitar el me gusta' : 'Me gusta'}
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

        <Comentarios
          publicacionId={p.id}
          comentarios={comentarios}
          total={p.totalComentarios}
          admiteComentarios={admiteComentarios}
          puedeModerar={puedeModerar}
        />
      </div>
    </article>
  );
}
