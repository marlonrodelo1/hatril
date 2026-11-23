import { AvatarPersona } from '@/components/avatar-persona';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import type { PublicacionMuro } from '@/lib/comunidad/consultas';
import { alternarMeGusta } from '../actions';
import { BotonMeGusta } from './boton-me-gusta';
import { Comentarios, type ComentarioPintado } from './comentarios';
import { FotosPublicacion } from './fotos-publicacion';
import { MenuContenido } from './menu-contenido';

/**
 * Una publicación del muro.
 *
 * COMPONENTE DE SERVIDOR, CON TRES ISLAS DE CLIENTE
 * -------------------------------------------------
 * La tarjeta, el texto y el «hace tanto» se pintan aquí y no mandan JavaScript.
 * Las islas son lo que necesita estado en el navegador: el corazón (lo que se
 * ve mientras viaja el toque), el mosaico de fotos (la hoja que las abre) y los
 * comentarios (la suya). Las tres siguen escribiendo con server actions.
 *
 * TARJETA TAMBIÉN EN EL MÓVIL
 * ---------------------------
 * Hasta el 17-nov las publicaciones iban a sangre en el móvil —sin borde a los
 * lados, de lado a lado de la pantalla— para ganar ancho de texto. El precio
 * era que unas quedaban pegadas a otras y costaba ver dónde acababa una y
 * empezaba la siguiente: es el primer fallo que apuntó la zona 2 del rediseño,
 * y Marlon aprobó la tarjeta. Cada una lleva su borde de 1 px y su `rounded-xl`,
 * y el aire entre ellas lo pone el `gap` de la página.
 *
 * Sin `overflow-hidden` en la tarjeta: las fotos nunca tocan una esquina —la
 * cabecera va siempre encima y las acciones siempre debajo—, así que no hay
 * nada que recortar, y así no se recorta tampoco el anillo de foco de los
 * botones del borde.
 */
export function Publicacion({
  publicacion: p,
  puedeModerar,
  admiteComentarios,
}: {
  publicacion: PublicacionMuro;
  puedeModerar: boolean;
  /** Ver `admiteComentarios` en `<Comentarios>`: cerrar no es borrar. */
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
    autorId: c.autorId,
    autorNombre: c.autorNombre,
    autorFoto: c.autorFoto,
    esMio: c.esMio,
    meGusta: c.meGusta,
    leHeDado: c.leHeDado,
    respuestas: c.respuestas.map((r) => ({
      id: r.id,
      texto: r.texto,
      cuando: haceCuanto(r.createdAt),
      autorId: r.autorId,
      autorNombre: r.autorNombre,
      autorFoto: r.autorFoto,
      esMio: r.esMio,
      meGusta: r.meGusta,
      leHeDado: r.leHeDado,
      respuestas: [],
    })),
  }));

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <AvatarPersona nombre={p.autorNombre} fotoUrl={p.autorFoto} />

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-bold leading-tight tracking-[-0.015em]">
            {p.autorNombre}
          </span>
          <span className="text-label leading-tight text-muted-foreground">
            {haceCuanto(p.createdAt)}
          </span>
        </span>

        <span className="flex-1" />

        {/* Siempre: a lo de otro también se le puede hacer algo —denunciarlo o
            bloquear a quien lo escribió—, que es lo que pide Apple. */}
        <MenuContenido
          tipo="publicacion"
          id={p.id}
          autorId={p.autorId}
          autorNombre={p.autorNombre}
          autorFoto={p.autorFoto}
          esMio={p.esMia}
          puedeModerar={puedeModerar}
          queSeBorra={queSeBorra(p.imagenes.length, p.totalComentarios)}
        />
      </header>

      {p.texto && (
        <p className="whitespace-pre-line text-pretty px-4 pb-3.5 text-body leading-relaxed">
          {p.texto}
        </p>
      )}

      {/* De borde a borde de la tarjeta: la foto es lo que más se mira, y un
          marco de 16 px a cada lado se la come en un móvil. */}
      {p.imagenes.length > 0 && <FotosPublicacion urls={p.imagenes} />}

      {/*
       * Las acciones, en su fila y con su raya encima.
       *
       * El corazón es un `<form>` de servidor con la action ya atada al id, y
       * dentro el botón de cliente que sabe pintar mientras viaja. Así el
       * formulario sale entero en el HTML y funciona aunque el JavaScript no
       * haya llegado.
       *
       * Los comentarios ya no necesitan armar esta fila. Cuando se desplegaban
       * debajo, el botón y el panel tenían que ser hermanos y el corazón entraba
       * como hijo suyo; la hoja vive en un portal, así que cada pieza se
       * coloca donde le toca.
       */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <form action={alternarMeGusta.bind(null, p.id)}>
          <BotonMeGusta dado={p.leHeDado} cuenta={p.meGusta} />
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

/** «Se borran también sus 2 fotos y los 5 comentarios.», o lo que toque. */
function queSeBorra(fotos: number, comentarios: number): string | undefined {
  const partes = [
    fotos === 1 ? 'su foto' : fotos > 1 ? `sus ${fotos} fotos` : null,
    comentarios === 1
      ? 'su comentario'
      : comentarios > 1
        ? `los ${comentarios} comentarios`
        : null,
  ].filter(Boolean);
  return partes.length > 0
    ? `Se borran también ${partes.join(' y ')}.`
    : undefined;
}
