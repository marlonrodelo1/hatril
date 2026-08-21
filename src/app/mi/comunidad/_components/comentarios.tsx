'use client';

import { useRef, useState } from 'react';
import { Heart, MessageCircle, Send, Trash2, X } from 'lucide-react';

import { iniciales } from '@/lib/format/iniciales';
import { alternarMeGustaComentario, borrarComentario, comentar } from '../actions';
import { Hoja } from './hoja';

/**
 * Un comentario tal y como llega a esta pantalla: con el «hace tanto» ya
 * escrito por el servidor. Ver `lib/format/hace-cuanto.ts` para el porqué.
 */
export type ComentarioPintado = {
  id: string;
  texto: string;
  cuando: string;
  autorNombre: string;
  esMio: boolean;
  meGusta: number;
  leHeDado: boolean;
  respuestas: ComentarioPintado[];
};

/**
 * Los comentarios, en una hoja que sube desde abajo.
 *
 * QUÉ CAMBIA RESPECTO A ANTES
 * ---------------------------
 * Estaban todos abiertos debajo de cada publicación. Con dos comentarios se
 * leía bien; con veinte, la publicación siguiente quedaba a tres pantallazos de
 * distancia y el muro dejaba de ser un muro. Ahora el icono dice cuántos hay y
 * al tocarlo se abren en su propia hoja, que es lo que hacen Instagram y
 * Facebook y lo que la gente ya sabe hacer sin que se lo expliquen.
 *
 * ESTE SÍ ES DE CLIENTE, Y ES LA EXCEPCIÓN
 * ----------------------------------------
 * El resto del muro no envía un kilobyte de JavaScript: el corazón, el borrar y
 * el publicar son formularios que llaman a una server action. Aquí hace falta
 * estado en el navegador —si la hoja está abierta, y a quién se está
 * respondiendo— y eso no se puede tener sin cliente.
 *
 * Lo que NO se ha movido al cliente es la escritura: cada botón de aquí dentro
 * sigue siendo un `<form>` con su server action. Así el me gusta de un
 * comentario funciona igual con o sin JavaScript cargado, y la seguridad sigue
 * viviendo donde vive todo en este repo, que es en las policies.
 */
export function Comentarios({
  publicacionId,
  comentarios,
  total,
  admiteComentarios,
  puedeModerar,
}: {
  publicacionId: string;
  comentarios: ComentarioPintado[];
  /** Contando respuestas. Ver `totalComentarios` en `comunidad/consultas.ts`. */
  total: number;
  admiteComentarios: boolean;
  puedeModerar: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [respondiendo, setRespondiendo] = useState<{
    id: string;
    nombre: string;
  } | null>(null);

  const campo = useRef<HTMLInputElement>(null);

  function responderA(id: string, nombre: string) {
    setRespondiendo({ id, nombre });
    // El foco va al campo del pie, que es donde se escribe. Sin esto hay que
    // pulsar «Responder» y después buscar el campo con el dedo.
    campo.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={
          total === 1 ? 'Ver el comentario' : `Ver los ${total} comentarios`
        }
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        <MessageCircle className="size-[17px]" strokeWidth={1.8} />
        {total > 0 ? total : 'Comentar'}
      </button>

      <Hoja
        abierta={abierta}
        onCambio={(v) => {
          setAbierta(v);
          // Cerrar cancela la respuesta a medias. Si no, al volver a abrir la
          // hoja el campo sigue diciendo «Respondiendo a Lucía» sobre una
          // conversación que ya no se está mirando.
          if (!v) setRespondiendo(null);
        }}
        titulo={
          total === 0
            ? 'Comentarios'
            : total === 1
              ? '1 comentario'
              : `${total} comentarios`
        }
        descripcion="Los comentarios de esta publicación."
        pie={
          admiteComentarios ? (
            <form action={comentar.bind(null, publicacionId)}>
              {respondiendo && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-[12.5px] text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">
                    Respondiendo a{' '}
                    <strong className="font-semibold text-foreground">
                      {respondiendo.nombre}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRespondiendo(null)}
                    aria-label="Cancelar la respuesta"
                    className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-full outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/20"
                  >
                    <X className="size-[14px]" strokeWidth={2} />
                  </button>
                </div>
              )}

              {/* El id del comentario padre viaja aquí. Que sea de otra
                  publicación o de otra iglesia lo rechaza HT120 en la base: esto
                  llega del navegador y no se cree nada. */}
              {respondiendo && (
                <input type="hidden" name="respuestaA" value={respondiendo.id} />
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={campo}
                  name="texto"
                  maxLength={1000}
                  autoComplete="off"
                  placeholder={
                    respondiendo
                      ? `Responde a ${respondiendo.nombre}`
                      : 'Escribe un comentario'
                  }
                  aria-label="Escribe un comentario"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-surface-alt px-3.5 py-2.5 outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                />
                <button
                  type="submit"
                  aria-label="Enviar"
                  className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl bg-accent text-accent-foreground outline-none hover:bg-accent-hover focus-visible:ring-3 focus-visible:ring-ring/20 active:translate-y-px"
                >
                  <Send className="size-[18px]" strokeWidth={1.9} />
                </button>
              </div>
            </form>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              La iglesia tiene los comentarios cerrados ahora mismo.
            </p>
          )
        }
      >
        {comentarios.length === 0 ? (
          <p className="py-8 text-center text-[14.5px] text-muted-foreground">
            Todavía no hay comentarios.
            {admiteComentarios && ' Sé la primera persona en escribir.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {comentarios.map((c) => (
              <li key={c.id} className="flex flex-col gap-2.5">
                <Comentario
                  comentario={c}
                  puedeModerar={puedeModerar}
                  puedeResponder={admiteComentarios}
                  onResponder={responderA}
                />

                {c.respuestas.length > 0 && (
                  /* Un solo nivel de sangrado, y lo garantiza la base: HT120
                     impide responder a una respuesta. Sin ese tope, aquí haría
                     falta un componente recursivo y una columna de texto de
                     cuatro caracteres al fondo. */
                  <ul className="flex flex-col gap-3 border-l border-border pl-3 sm:pl-4">
                    {c.respuestas.map((r) => (
                      <li key={r.id}>
                        <Comentario
                          comentario={r}
                          puedeModerar={puedeModerar}
                          /* Se responde SIEMPRE al comentario de primer nivel,
                             aunque se pulse dentro de una respuesta. Es lo que
                             hace Instagram, y lo que la base permite. */
                          puedeResponder={admiteComentarios}
                          respondeA={{ id: c.id, nombre: r.autorNombre }}
                          onResponder={responderA}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Hoja>
    </>
  );
}

function Comentario({
  comentario: c,
  puedeModerar,
  puedeResponder,
  respondeA,
  onResponder,
}: {
  comentario: ComentarioPintado;
  puedeModerar: boolean;
  puedeResponder: boolean;
  /**
   * A quién hay que colgar la respuesta cuando este comentario ya ES una
   * respuesta: al padre, con el nombre de quien escribió esta. Así el campo
   * dice «Responde a Marta» y la fila se cuelga del comentario de primer nivel.
   */
  respondeA?: { id: string; nombre: string };
  onResponder: (id: string, nombre: string) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
        {iniciales(c.autorNombre)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-col rounded-xl bg-background px-3 py-2">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13.5px] font-bold">
              {c.autorNombre}
            </span>
            <span className="flex-none text-[12px] text-muted-foreground">
              {c.cuando}
            </span>
          </span>
          <span className="whitespace-pre-line text-pretty text-[14.5px] leading-relaxed">
            {c.texto}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <form action={alternarMeGustaComentario.bind(null, c.id)}>
            <button
              type="submit"
              aria-pressed={c.leHeDado}
              aria-label={c.leHeDado ? 'Quitar el me gusta' : 'Me gusta'}
              className={
                'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/20 ' +
                (c.leHeDado
                  ? 'text-danger hover:bg-[#F3DEDD]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              <Heart
                className="size-[14px]"
                strokeWidth={1.9}
                // Relleno además de color: quien no distingue el rojo tiene que
                // poder ver que ya le ha dado.
                fill={c.leHeDado ? 'currentColor' : 'none'}
              />
              {c.meGusta > 0 ? c.meGusta : 'Me gusta'}
            </button>
          </form>

          {puedeResponder && (
            <button
              type="button"
              onClick={() =>
                onResponder(
                  respondeA?.id ?? c.id,
                  respondeA?.nombre ?? c.autorNombre,
                )
              }
              className="cursor-pointer rounded-lg px-2 py-1 text-[12.5px] font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
            >
              Responder
            </button>
          )}

          <span className="flex-1" />

          {(c.esMio || puedeModerar) && (
            <form action={borrarComentario.bind(null, c.id)}>
              <button
                type="submit"
                aria-label="Borrar el comentario"
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
              >
                <Trash2 className="size-[15px]" strokeWidth={1.7} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
