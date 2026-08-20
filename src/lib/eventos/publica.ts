import 'server-only';

import { and, asc, eq, gte, sql } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { eventos, iglesias } from '@/lib/db/schema';

/**
 * Los eventos que salen en la web pública de una iglesia.
 *
 * POR QUÉ `dbAdmin`, Y POR QUÉ EN UN FICHERO APARTE
 * -------------------------------------------------
 * Por lo mismo que `src/lib/iglesias/publica.ts`, que ya lo razona entero: la
 * página `/i/[slug]` se sirve desde el servidor, por slug exacto, porque tener
 * web y salir en el directorio son decisiones distintas y aflojar la policy de
 * `anon` permitiría enumerar por PostgREST todas las congregaciones.
 *
 * Y en un módulo separado de `consultas.ts` a propósito. En `devocionales` la
 * función de `dbAdmin` convive con las de `withUser` en el mismo fichero y hay
 * que leer cada una para saber con qué llave entra. Aquí la frontera es física:
 * si un import dice `eventos/publica`, salta la RLS; si dice
 * `eventos/consultas`, no.
 *
 * LO QUE ESTE FICHERO NO HACE, Y ES LA MITAD DE SU DISEÑO
 * -------------------------------------------------------
 * NO toca `evento_inscripciones`. Ni una fila, ni un recuento, ni «quedan 3
 * plazas». Es deliberado y está razonado en la migración `0024`: cualquier señal
 * pública de ocupación permite averiguar si una persona concreta está apuntada
 * a un acto religioso —se ocupan todas las plazas menos una, se prueba con su
 * correo y se mira si el número se mueve—, y eso es dato del art. 9 por
 * inferencia.
 *
 * Si una iglesia quiere anunciar que quedan pocas plazas, que lo escriba en la
 * descripción. Un texto suyo no se puede sondear.
 */

export type EventoPublico = {
  id: string;
  titulo: string;
  descripcion: string | null;
  inicioEn: Date;
  finEn: Date | null;
  lugar: string | null;
  imagenUrl: string | null;
  precio: string | null;
  inscripcionesAbiertas: boolean;
  enlacePago: string | null;
  enlacePagoHost: string | null;
  pagoInstrucciones: string | null;
};

/**
 * Los próximos, en orden. Columnas enumeradas a mano: nada de `select *` con
 * una llave que salta la RLS.
 */
export async function eventosPublicos(
  iglesiaId: string,
  limite = 6,
): Promise<EventoPublico[]> {
  return dbAdmin
    .select({
      id: eventos.id,
      titulo: eventos.titulo,
      descripcion: eventos.descripcion,
      inicioEn: eventos.inicioEn,
      finEn: eventos.finEn,
      lugar: eventos.lugar,
      imagenUrl: eventos.imagenUrl,
      precio: eventos.precio,
      inscripcionesAbiertas: eventos.inscripcionesAbiertas,
      enlacePago: eventos.enlacePago,
      enlacePagoHost: eventos.enlacePagoHost,
      pagoInstrucciones: eventos.pagoInstrucciones,
    })
    .from(eventos)
    .where(
      and(
        eq(eventos.iglesiaId, iglesiaId),
        eq(eventos.publicado, true),
        // `coalesce(fin_en, inicio_en)`: el retiro de tres días no desaparece de
        // la web la primera mañana, cuando la gente todavía está allí.
        gte(sql`coalesce(${eventos.finEn}, ${eventos.inicioEn})`, sql`now()`),
      ),
    )
    .orderBy(asc(eventos.inicioEn), asc(eventos.id))
    .limit(limite);
}

/**
 * Un evento suelto, para su página de inscripción.
 *
 * Comprueba `activa` y `web_publica` de la iglesia con un join, igual que
 * `devocionalPublico`: sin eso, el enlace directo a un evento seguiría abierto
 * después de que la congregación despublicara su web.
 */
export async function eventoPublico(
  slug: string,
  eventoId: string,
): Promise<(EventoPublico & { iglesiaId: string; moneda: string }) | null> {
  const filas = await dbAdmin
    .select({
      id: eventos.id,
      titulo: eventos.titulo,
      descripcion: eventos.descripcion,
      inicioEn: eventos.inicioEn,
      finEn: eventos.finEn,
      lugar: eventos.lugar,
      imagenUrl: eventos.imagenUrl,
      precio: eventos.precio,
      inscripcionesAbiertas: eventos.inscripcionesAbiertas,
      enlacePago: eventos.enlacePago,
      enlacePagoHost: eventos.enlacePagoHost,
      pagoInstrucciones: eventos.pagoInstrucciones,
      iglesiaId: eventos.iglesiaId,
      moneda: iglesias.moneda,
    })
    .from(eventos)
    .innerJoin(iglesias, eq(iglesias.id, eventos.iglesiaId))
    .where(
      and(
        eq(eventos.id, eventoId),
        eq(eventos.publicado, true),
        eq(iglesias.slug, slug),
        eq(iglesias.activa, true),
        eq(iglesias.webPublica, true),
      ),
    )
    .limit(1);

  return (filas[0] ?? null) as never;
}
