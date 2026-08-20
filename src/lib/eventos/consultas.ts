import 'server-only';

import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db/with-tenant';
import { eventoInscripciones, eventos } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Las consultas de eventos, puertas adentro.
 *
 * TODO PASA POR `withUser`. Nada de `dbAdmin` aquí dentro: lo que sirve la web
 * pública vive en `src/lib/eventos/publica.ts`, en un fichero aparte y no en una
 * función más de este. La frontera es física a propósito — en `devocionales`
 * conviven en el mismo módulo y hay que leer cada función para saber con qué
 * llave entra.
 *
 * Y la razón es más fuerte aquí que en ningún otro sitio: `evento_inscripciones`
 * guarda nombre y correo de personas que NO pertenecen a ninguna congregación.
 * Un `where` mal puesto con `dbAdmin` no da un listado raro, da la lista de
 * asistentes de otra iglesia.
 *
 * LOS CONTEOS VAN CON `::int`
 * ---------------------------
 * `count(*)` y `sum()` son `bigint`, y postgres-js los devuelve como CADENA para
 * no perder precisión. Sin el cast, `plazasOcupadas` volvería como `'3'` y
 * `ocupadas + 1 > cupo` compararía texto con número.
 */

export interface EventoListado {
  id: string;
  titulo: string;
  inicioEn: Date;
  finEn: Date | null;
  lugar: string | null;
  precio: string | null;
  cupo: number | null;
  publicado: boolean;
  inscripcionesAbiertas: boolean;
  imagenUrl: string | null;
  /** Personas, no filas: cada inscripción trae hasta diez acompañantes. */
  ocupadas: number;
}

export interface Inscrito {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  acompanantes: number;
  nota: string | null;
  pagado: boolean;
  origen: 'publico' | 'panel';
  createdAt: Date;
  canceladaAt: Date | null;
}

/**
 * Cuántas PERSONAS hay apuntadas a cada evento de la iglesia.
 *
 * Subconsulta correlacionada y no un `leftJoin` con `group by`: con el join, un
 * evento sin inscripciones desaparecería o habría que arrastrar todas las
 * columnas al `group by`. Va sobre `idx_inscripciones_evento_vivas`, que es
 * parcial por `cancelada_at is null`.
 *
 * LOS NOMBRES VAN ESCRITOS A MANO, Y NO ES DESCUIDO
 * -------------------------------------------------
 * La forma natural sería interpolar las tablas de Drizzle —`${eventos.id}`,
 * `${eventoInscripciones}`— y es exactamente lo que NO se puede hacer aquí.
 * Drizzle escribe una columna interpolada SIN cualificar, así que
 * `${eventos.id}` sale como `"id"` a secas… y dentro de esta subconsulta ese
 * `"id"` lo resuelve Postgres contra `ei`, que también tiene una columna `id`.
 * El resultado es `where ei.evento_id = ei.id`, que no casa nunca:
 *
 *     ocupadas → 0, siempre, sin error y sin aviso.
 *
 * Se vio en pantalla —«0 personas de 2 plazas» con un inscrito debajo— y no en
 * ninguna comprobación automática, porque para el compilador y para Postgres la
 * consulta es perfectamente válida.
 *
 * Con `eventos.id` cualificado, la correlación apunta a la tabla de fuera. Si
 * algún día se le pone un alias a `eventos` en la consulta principal, esto hay
 * que cambiarlo a la vez.
 */
const ocupadasDe = sql<number>`(
  select coalesce(sum(1 + ei.acompanantes), 0)::int
    from public.evento_inscripciones ei
   where ei.evento_id = eventos.id
     and ei.cancelada_at is null
)`;

export async function listarEventos(
  ctx: UserContext,
  filtros: { soloProximos?: boolean } = {},
): Promise<EventoListado[]> {
  const condiciones = [eq(eventos.iglesiaId, ctx.iglesia.id)];

  if (filtros.soloProximos) {
    // `coalesce(fin_en, inicio_en)`: un retiro de tres días sigue siendo
    // «próximo» durante los tres, no solo hasta la primera mañana.
    condiciones.push(
      gte(sql`coalesce(${eventos.finEn}, ${eventos.inicioEn})`, sql`now()`),
    );
  }

  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: eventos.id,
        titulo: eventos.titulo,
        inicioEn: eventos.inicioEn,
        finEn: eventos.finEn,
        lugar: eventos.lugar,
        precio: eventos.precio,
        cupo: eventos.cupo,
        publicado: eventos.publicado,
        inscripcionesAbiertas: eventos.inscripcionesAbiertas,
        imagenUrl: eventos.imagenUrl,
        ocupadas: ocupadasDe,
      })
      .from(eventos)
      // El `iglesiaId` del where es redundante con la RLS y va igual: si algún
      // día alguien llama a esto con `dbAdmin` por error, el where sigue de pie.
      .where(and(...condiciones))
      // `id` de desempate: dos eventos a la misma hora sin él salen en orden
      // arbitrario y la lista «baila» entre recargas.
      .orderBy(asc(eventos.inicioEn), asc(eventos.id)),
  ) as Promise<EventoListado[]>;
}

export async function evento(
  ctx: UserContext,
  id: string,
): Promise<EventoListado & {
  descripcion: string | null;
  enlacePago: string | null;
  enlacePagoHost: string | null;
  pagoInstrucciones: string | null;
} | null> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: eventos.id,
        titulo: eventos.titulo,
        descripcion: eventos.descripcion,
        inicioEn: eventos.inicioEn,
        finEn: eventos.finEn,
        lugar: eventos.lugar,
        precio: eventos.precio,
        cupo: eventos.cupo,
        publicado: eventos.publicado,
        inscripcionesAbiertas: eventos.inscripcionesAbiertas,
        imagenUrl: eventos.imagenUrl,
        enlacePago: eventos.enlacePago,
        enlacePagoHost: eventos.enlacePagoHost,
        pagoInstrucciones: eventos.pagoInstrucciones,
        ocupadas: ocupadasDe,
      })
      .from(eventos)
      .where(and(eq(eventos.id, id), eq(eventos.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );

  return (filas[0] ?? null) as never;
}

/**
 * La lista de quién viene.
 *
 * Las canceladas salen también, al final: para el pastor «esta persona se dio de
 * baja» es información, y esconderla haría que buscara a alguien que sí se
 * apuntó y no aparece. Lo que no sale nunca es `codigo_cancelacion` — es el
 * secreto que sustituye a la cuenta de quien se inscribió, y no tiene por qué
 * pasar por una pantalla ni por un CSV.
 */
export async function inscritos(
  ctx: UserContext,
  eventoId: string,
): Promise<Inscrito[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: eventoInscripciones.id,
        nombre: eventoInscripciones.nombre,
        email: eventoInscripciones.email,
        telefono: eventoInscripciones.telefono,
        acompanantes: eventoInscripciones.acompanantes,
        nota: eventoInscripciones.nota,
        pagado: eventoInscripciones.pagado,
        origen: eventoInscripciones.origen,
        createdAt: eventoInscripciones.createdAt,
        canceladaAt: eventoInscripciones.canceladaAt,
      })
      .from(eventoInscripciones)
      .where(
        and(
          eq(eventoInscripciones.eventoId, eventoId),
          eq(eventoInscripciones.iglesiaId, ctx.iglesia.id),
        ),
      )
      .orderBy(
        // Las vivas primero. `asc` sobre un booleano pone `false` delante, y
        // aquí `cancelada_at is null` es `false` para las vivas… así que se
        // ordena por la columna directamente: nulls first.
        asc(eventoInscripciones.canceladaAt),
        asc(eventoInscripciones.createdAt),
      ),
  ) as Promise<Inscrito[]>;
}

/** Cuántas personas hay apuntadas a un evento. Para el aviso del panel. */
export async function plazasOcupadas(
  ctx: UserContext,
  eventoId: string,
): Promise<number> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        n: sql<number>`coalesce(sum(1 + ${eventoInscripciones.acompanantes}), 0)::int`,
      })
      .from(eventoInscripciones)
      .where(
        and(
          eq(eventoInscripciones.eventoId, eventoId),
          eq(eventoInscripciones.iglesiaId, ctx.iglesia.id),
          isNull(eventoInscripciones.canceladaAt),
        ),
      ),
  );

  return filas[0]?.n ?? 0;
}

/**
 * Lo próximo, para el bloque de `/panel/hoy`.
 *
 * El pastor vive en esa pantalla: un evento que nadie recuerda es un evento al
 * que no va nadie. Mismo argumento que ya justifica el bloque de la caja ahí.
 */
export async function proximosEventos(
  ctx: UserContext,
  limite = 3,
): Promise<EventoListado[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: eventos.id,
        titulo: eventos.titulo,
        inicioEn: eventos.inicioEn,
        finEn: eventos.finEn,
        lugar: eventos.lugar,
        precio: eventos.precio,
        cupo: eventos.cupo,
        publicado: eventos.publicado,
        inscripcionesAbiertas: eventos.inscripcionesAbiertas,
        imagenUrl: eventos.imagenUrl,
        ocupadas: ocupadasDe,
      })
      .from(eventos)
      .where(
        and(
          eq(eventos.iglesiaId, ctx.iglesia.id),
          gte(sql`coalesce(${eventos.finEn}, ${eventos.inicioEn})`, sql`now()`),
        ),
      )
      .orderBy(asc(eventos.inicioEn), asc(eventos.id))
      .limit(limite),
  ) as Promise<EventoListado[]>;
}

/** Para el CSV: lo mismo que `inscritos`, sin tope y ordenado por alta. */
export async function inscritosParaExportar(
  ctx: UserContext,
  eventoId: string,
): Promise<Inscrito[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: eventoInscripciones.id,
        nombre: eventoInscripciones.nombre,
        email: eventoInscripciones.email,
        telefono: eventoInscripciones.telefono,
        acompanantes: eventoInscripciones.acompanantes,
        nota: eventoInscripciones.nota,
        pagado: eventoInscripciones.pagado,
        origen: eventoInscripciones.origen,
        createdAt: eventoInscripciones.createdAt,
        canceladaAt: eventoInscripciones.canceladaAt,
      })
      .from(eventoInscripciones)
      .where(
        and(
          eq(eventoInscripciones.eventoId, eventoId),
          eq(eventoInscripciones.iglesiaId, ctx.iglesia.id),
        ),
      )
      .orderBy(desc(eventoInscripciones.createdAt)),
  ) as Promise<Inscrito[]>;
}
