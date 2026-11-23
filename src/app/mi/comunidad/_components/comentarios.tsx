'use client';

import { useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

import { AvatarPersona } from '@/components/avatar-persona';
import { Hoja } from '@/components/hoja';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Input } from '@/components/ui/input';
import { alternarMeGustaComentario, comentar } from '../actions';
import { BotonMeGusta } from './boton-me-gusta';
import { MenuContenido } from './menu-contenido';

/**
 * Un comentario tal y como llega a esta pantalla: con el «hace tanto» ya
 * escrito por el servidor. Ver `lib/format/hace-cuanto.ts` para el porqué.
 */
export type ComentarioPintado = {
  id: string;
  texto: string;
  cuando: string;
  autorId: string;
  autorNombre: string;
  autorFoto: string | null;
  esMio: boolean;
  meGusta: number;
  leHeDado: boolean;
  respuestas: ComentarioPintado[];
};

/**
 * El botón de los comentarios y la hoja que abre.
 *
 * CUATRO INTENTOS, Y ESTE VUELVE AL SEGUNDO
 * -----------------------------------------
 *   1. **Siempre abiertos.** Con veinte comentarios, la publicación siguiente
 *      quedaba a tres pantallazos y el muro dejaba de ser un muro.
 *   2. **Una hoja que subía desde abajo.** Marlon pidió quitarla el 22-ago
 *      (commit 6bde8dd): tapaba la pantalla y, al cerrarla, se perdía el sitio
 *      donde se estaba leyendo. La causa técnica no quedó escrita, y la hoja
 *      era esta misma pieza.
 *   3. **Desplegados bajo la publicación.** No había capa que cerrar, pero
 *      cada conversación abierta empujaba el resto del muro hacia abajo.
 *   4. **La hoja otra vez**, en la zona 2 del rediseño que Marlon aprobó el
 *      17-nov, con una condición escrita en la propuesta: al cerrarla, sigues en
 *      el mismo sitio del muro.
 *
 * QUÉ SOSTIENE «SIGUES EN EL MISMO SITIO»
 * ---------------------------------------
 * - La hoja no navega ni toca la URL: abrir y cerrar es estado de este
 *   componente, así que la página de debajo no se vuelve a pintar.
 * - Base UI bloquea el desplazamiento de la página mientras está abierta
 *   (`overflow: hidden` en el `<html>`, que conserva el `scrollTop`), y al
 *   cerrar devuelve el foco a este botón con `preventScroll`. Chrome de
 *   Android ignora esa opción, pero el botón es el que se acaba de tocar:
 *   está a la vista y el foco no tiene adónde desplazar.
 * - Comentar no redirige: `comentar` termina en `revalidatePath`, la lista se
 *   actualiza dentro de la hoja abierta y el muro de detrás no se mueve. Solo
 *   un error redirige —es la convención de las actions del repo— y el campo
 *   lleva `required` para que el más común, enviarlo vacío, no llegue a salir.
 * - Lo que se desplaza dentro de la hoja es su propio cuerpo, con
 *   `overscroll-contain` (`components/hoja.tsx`): al llegar al final de la
 *   lista, el gesto no se escapa al muro.
 *
 * Lo que la hoja sigue sin hacer es dejar ver la publicación mientras se lee:
 * sube hasta el 90 % del alto, como el «…». Si eso vuelve a pesar, la palanca
 * es el alto de la hoja, no volver a desplegar.
 *
 * ESTE SÍ ES DE CLIENTE, Y LA ESCRITURA NO
 * ----------------------------------------
 * Aquí hace falta estado en el navegador —si la hoja está abierta y a quién se
 * responde—. Lo que NO se ha movido al cliente es la escritura: cada botón de
 * aquí dentro sigue siendo un `<form>` con su server action, así que la
 * seguridad sigue viviendo en las policies.
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
  /**
   * Comentarios cerrados: no se pinta el campo de escribir, pero los que ya
   * existan se siguen leyendo y su autor los sigue pudiendo borrar. Cerrar no es
   * borrar, y es lo mismo que hace la `0027`: quita el INSERT y deja el SELECT
   * donde estaba.
   */
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

  const titulo =
    total === 0
      ? 'Comentarios'
      : total === 1
        ? '1 comentario'
        : `${total} comentarios`;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        aria-expanded={abierta}
        aria-label={
          total === 0
            ? 'Comentar'
            : total === 1
              ? 'Ver el comentario'
              : `Ver los ${total} comentarios`
        }
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-label font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none"
      >
        <MessageCircle className="size-[18px]" strokeWidth={1.8} aria-hidden />
        <span className="tabular-nums">{total > 0 ? total : 'Comentar'}</span>
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
        titulo={titulo}
        descripcion="Los comentarios de esta publicación."
        pie={
          admiteComentarios ? (
            <form
              action={comentar.bind(null, publicacionId)}
              // Al enviar se suelta la respuesta: si no, el siguiente
              // comentario saldría colgado otra vez del mismo. React ya ha
              // leído el formulario —con su campo oculto— antes de pintar
              // esto, así que la respuesta que se envía no se pierde. El texto
              // lo vacía React solo cuando la action termina bien.
              onSubmit={() => setRespondiendo(null)}
              className="flex flex-col gap-2"
            >
              {respondiendo && (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-label text-muted-foreground">
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
                    className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-full outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
                  >
                    <X className="size-[14px]" strokeWidth={1.8} />
                  </button>
                </div>
              )}

              {/* El id del comentario padre viaja aquí. Que sea de otra
                  publicación o de otra iglesia lo rechaza HT120 en la base: esto
                  llega del navegador y no se cree nada. */}
              {respondiendo && (
                <input type="hidden" name="respuestaA" value={respondiendo.id} />
              )}

              <div className="flex items-center gap-2">
                <Input
                  ref={campo}
                  name="texto"
                  required
                  maxLength={1000}
                  autoComplete="off"
                  placeholder={
                    respondiendo
                      ? `Responde a ${respondiendo.nombre}`
                      : 'Escribe un comentario'
                  }
                  aria-label="Escribe un comentario"
                  className="flex-1"
                />
                {/* El único naranja de la hoja. Mientras envía, solo el
                    círculo: «Publicando…» no cabe sin quitarle medio campo al
                    texto, y el botón no cambia de ancho. */}
                <BotonEnviar pendiente="" className="h-[42px]">
                  Publicar
                </BotonEnviar>
              </div>
            </form>
          ) : (
            <p className="text-label text-muted-foreground">
              La iglesia tiene los comentarios cerrados ahora mismo.
            </p>
          )
        }
      >
        {comentarios.length === 0 ? (
          <EstadoVacio Icono={MessageCircle} titulo="Todavía no hay comentarios">
            {admiteComentarios
              ? 'Sé la primera persona en escribir.'
              : 'Cuando la iglesia los abra, podrás escribir aquí.'}
          </EstadoVacio>
        ) : (
          <ul className="flex flex-col gap-4 pb-1">
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
                  <ul className="ml-4 flex flex-col gap-3 border-l border-border pl-3">
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
      <AvatarPersona
        nombre={c.autorNombre}
        fotoUrl={c.autorFoto}
        tamano="sm"
        className="mt-0.5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-col rounded-xl bg-surface-alt px-3 py-2">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-label font-bold">{c.autorNombre}</span>
            <span className="flex-none text-micro text-muted-foreground">
              {c.cuando}
            </span>
          </span>
          <span className="whitespace-pre-line text-pretty text-body leading-relaxed">
            {c.texto}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* El mismo corazón que la publicación, más pequeño: con su latido y
              su cifra que rueda, y su server action de siempre. */}
          <form action={alternarMeGustaComentario.bind(null, c.id)}>
            <BotonMeGusta dado={c.leHeDado} cuenta={c.meGusta} pequeno />
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
              className="h-7 cursor-pointer rounded-lg px-2 text-label font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none"
            >
              Responder
            </button>
          )}

          <span className="flex-1" />

          {/* El «…» abre su propia hoja ENCIMA de esta. Base UI las trata como
              anidadas: la X, Escape o tocar fuera cierran solo la de arriba y
              vuelves a la conversación, no al muro. */}
          <MenuContenido
            tipo="comentario"
            id={c.id}
            autorId={c.autorId}
            autorNombre={c.autorNombre}
            autorFoto={c.autorFoto}
            esMio={c.esMio}
            puedeModerar={puedeModerar}
            pequeno
          />
        </div>
      </div>
    </div>
  );
}
