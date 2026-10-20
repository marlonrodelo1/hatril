import 'server-only';

import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  asistencias,
  miembros,
  ministerios,
  reuniones,
  seguimientoAsignaciones,
  seguimientoContactos,
} from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { esPastor, puede, puedeGestionarMinisterio } from '@/lib/auth/permisos';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia, mesEnLaIglesia } from '@/lib/fecha/hoy';
import { timestampAFechaHoraLocal } from '@/lib/fecha/zona';
import type { EstadoMiembro } from '@/lib/miembros/estados';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { miembrosSinPermisoDeAsistencia } from '@/lib/rgpd/consultas';
import type { ResultadoContacto, ViaContacto } from './catalogos';

/**
 * Consultas de seguimiento.
 *
 * NADA DE `dbAdmin` AQUÍ DENTRO. Con estos datos —por qué cada persona dejó de
 * venir— entrar por la puerta equivocada no es un bug: es una brecha del art. 9
 * que hay que notificar. Y no hay `publica.ts` gemelo ni lo va a haber.
 *
 * DOS PREGUNTAS, UNA SOLA CUENTA
 * ------------------------------
 * El seguimiento contesta dos cosas: ¿quién se fue? (los ausentes) y ¿quién
 * llegó? (los nuevos). Las dos salen de `calcular()` y de ninguna otra parte,
 * porque cada persona tiene que caer en UNA de las dos listas y solo en una. Con
 * dos consultas, una persona nueva acabaría a la vez en «nuevos» y arriba del
 * todo en «ausentes», que es justo lo que pasaba antes de separarlas.
 */

/**
 * Cuántos días dura alguien en «nuevos».
 *
 * Noventa, como las listas de los eventos y como el plazo que el análisis de
 * consolidación propone para borrar a quien vino una vez y no volvió. Pasado
 * eso, quien sigue en visitante o nuevo sale del embudo: si falta, aparece en
 * ausentes con sus reuniones contadas desde que llegó.
 */
export const DIAS_EN_NUEVOS = 90;

/**
 * «Se queda»: tantas presencias en las últimas tantas reuniones con lista.
 *
 * Tres de seis es la recomendación del análisis. En el código y no en la
 * configuración del módulo por ahora: no hay pantalla para cambiarlo, y un
 * número que nadie puede tocar no tiene por qué vivir en la base.
 */
export const SE_QUEDA = { presencias: 3, deLasUltimas: 6 } as const;

/**
 * En qué punto está alguien que acaba de llegar.
 *
 * SE CALCULA, NO SE GUARDA. Sale de las asistencias cada vez que se pinta, y
 * por eso no hay columna de etapa ni botón para moverla: una etapa guardada se
 * queda vieja el domingo siguiente y nadie se acuerda de actualizarla. «Ya es
 * miembro» tampoco es una etapa de aquí: lo decide el pastor cambiando el
 * estado de la ficha, y en ese momento la persona sale de «nuevos».
 */
export type EtapaNuevo = 'llego' | 'volvio' | 'se_queda';

export type PersonaEnSeguimiento = {
  miembroId: string;
  nombre: string;
  telefono: string | null;
  estado: EstadoMiembro;
  /** `null` = nunca se le ha marcado presente en una reunión de la congregación. */
  ultimaAsistencia: string | null;
  /**
   * Cuántas reuniones DE LAS QUE SE PASÓ LISTA se ha perdido seguidas.
   *
   * No son «semanas sin venir» calculadas contra el reloj, y la diferencia es
   * todo: si la iglesia lleva tres semanas sin apuntar nada, contra el reloj
   * TODA la congregación aparecería como ausente y el equipo se pondría a llamar
   * a gente que fue el domingo pasado. A la tercera llamada así, el pastor deja
   * de fiarse de la pantalla y el módulo entero se muere.
   *
   * Contando solo reuniones con lista tomada, un domingo que nadie apuntó
   * sencillamente no cuenta para nadie.
   *
   * Y solo las POSTERIORES a que la persona llegara y tuviera ficha: ver
   * `desdeCuandoCuenta()`.
   */
  faltasSeguidas: number;
  /**
   * El día que llegó: `fecha_ingreso`, o el día que se creó su ficha si nadie
   * la apuntó. Es la fecha del embudo de nuevos.
   *
   * Nunca después de hoy. El alta de Miembros rellenaba la fecha vacía con el
   * día en UTC, que en Bogotá a partir de las 19:00 ya es mañana, y la pantalla
   * acababa diciendo «llegó hace -1 días».
   */
  llegada: string;
  /**
   * `null` si no está en el embudo de nuevos. Si está, NO sale en ausentes:
   * a quien acaba de llegar no se le llama por faltar, se le llama por haber
   * venido.
   *
   * Lo que llega con la tanda de células y la ruta de crecimiento va AL LADO
   * de `etapa`, no dentro: `celula` (a qué grupo se le asignó) y `ruta` (los
   * pasos que ha dado: encuentro, bautismo, escuela de líderes). La etapa se
   * calcula de las asistencias; esos dos son hechos que alguien apunta, con su
   * tabla y su migración, y mezclarlos haría que un dato guardado pisara uno
   * calculado. La pantalla ya tiene su sitio: `Insignias` en `nuevos/page.tsx`.
   */
  nuevo: {
    etapa: EtapaNuevo;
    /** Presencias en las últimas `SE_QUEDA.deLasUltimas` reuniones con lista. */
    presenciasRecientes: number;
    /**
     * Reuniones con lista posteriores a su llegada, haya salido en ellas o no.
     *
     * Hace falta para no mentir en «vinieron una vez»: con cero faltas puede
     * ser que no haya habido listas, o que las hubo antes de que se tecleara su
     * ficha y por eso no salía en ellas. Son dos frases distintas.
     */
    listasDesdeQueLlego: number;
  } | null;
  /** Quién la acompaña, si alguien la acompaña. */
  acompana: { miembroId: string; nombre: string } | null;
  ultimoContacto: {
    fecha: string;
    via: ViaContacto;
    resultado: ResultadoContacto;
  } | null;
};

/**
 * Desde qué fecha se le pueden contar faltas a alguien.
 *
 * EL DEFECTO QUE ESTO ARREGLA
 * ---------------------------
 * Antes, a quien nunca se había marcado presente se le contaban TODAS las
 * reuniones con lista desde que existe la iglesia en Hatril. Un visitante dado
 * de alta hoy salía arriba del todo en ausentes, con «nunca se le ha marcado
 * presente» y cinco reuniones perdidas que ocurrieron antes de que nadie
 * supiera su nombre.
 *
 * Ahora la cuenta empieza en la más tardía de tres fechas:
 *
 *   - su última asistencia, como siempre;
 *   - su fecha de ingreso: antes de llegar no faltaba, no estaba;
 *   - el día en que se creó su ficha: una lista solo puede incluir fichas que
 *     ya existen, así que la de un miembro de toda la vida que el pastor teclea
 *     hoy no se perdió los cultos de agosto: en agosto no estaba en la lista.
 *
 * Y se cuenta con `>`, no con `>=`. El día que alguien llega estaba allí, por
 * definición, aunque su tarjeta se teclease después de pasar lista. Contarle
 * ese culto como falta es exactamente el error de antes en pequeño.
 *
 * Lo que este corte NO puede borrar es una ausencia APUNTADA. Si la lista de un
 * culto se pasa días después, la ficha creada entretanto sale en ella, y si se
 * le marca «no vino», eso es un dato y cuenta aunque el culto sea anterior al
 * corte. Las recoge `ausenciasPrevias` en `calcular()`.
 */
function desdeCuandoCuenta(
  ultimaAsistencia: string | null,
  fechaIngreso: string | null,
  creadaEl: string,
): string {
  return [ultimaAsistencia, fechaIngreso, creadaEl]
    .filter((f): f is string => Boolean(f))
    .reduce((a, b) => (a > b ? a : b));
}

type Calculo = {
  /** Fechas de las reuniones de la congregación con lista, de la más reciente hacia atrás. */
  fechas: string[];
  personas: PersonaEnSeguimiento[];
  /** Los que tienen al menos un contacto apuntado en estos ministerios. */
  contactados: Set<string>;
};

/**
 * Todo el seguimiento de una iglesia, visto desde uno o varios ministerios.
 *
 * Los ministerios solo deciden de dónde salen el acompañante y los contactos,
 * que son del equipo que los apuntó. La lista de personas es la congregación
 * entera en los dos casos.
 *
 * VARIAS CONSULTAS Y EL CRUCE EN JAVASCRIPT, NO UNA SUBCONSULTA CORRELACIONADA
 * ----------------------------------------------------------------------------
 * La versión «elegante» cuenta las faltas con un `select count(*)` correlacionado
 * dentro del `select` principal. En Drizzle eso es una trampa conocida: una
 * columna interpolada dentro de una subconsulta sale SIN cualificar, y como
 * `reuniones` y `miembros` comparten `iglesia_id`, el `where` se resolvería
 * contra la tabla de dentro. Así fue como el contador de plazas de eventos acabó
 * siendo `where ei.evento_id = ei.id`: cero siempre, sin error y sin aviso.
 *
 * Las fechas de reunión con lista son como mucho unas decenas de filas, así que
 * traerlas y cruzarlas aquí no cuesta nada y no puede mentir en silencio.
 */
async function calcular(
  ctx: UserContext,
  ministerioIds: string[],
): Promise<Calculo> {
  // Quien no dio el permiso no sale aquí. Es la otra mitad de lo que hace
  // `listaParaPasar()`: si se le excluye de la lista de asistencia pero sigue
  // apareciendo en la de seguimiento, negarlo no habría servido de nada — es
  // esta lista, y no la otra, la que le pone a alguien al teléfono.
  const sinPermiso = await miembrosSinPermisoDeAsistencia(ctx);

  const tz = ctx.iglesia.timezone;
  const hoy = hoyEnLaIglesia(tz);
  const limiteNuevos = sumarDias(hoy, -DIAS_EN_NUEVOS);

  return withUser(ctx.user.id, async (tx) => {
    // 1. Las reuniones de la congregación en las que SÍ se pasó lista.
    const conLista = await tx
      .select({ id: reuniones.id, fecha: reuniones.fecha })
      .from(reuniones)
      .where(
        and(
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          isNull(reuniones.ministerioId),
          exists(
            tx
              .select({ x: sql`1` })
              .from(asistencias)
              .where(eq(asistencias.reunionId, reuniones.id)),
          ),
        ),
      )
      .orderBy(desc(reuniones.fecha), desc(reuniones.hora));

    const fechas = conLista.map((r) => r.fecha);
    const recientes = new Set(
      conLista.slice(0, SE_QUEDA.deLasUltimas).map((r) => r.id),
    );

    // 2. La congregación.
    const filas = await tx
      .select({
        miembroId: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        telefono: miembros.telefono,
        estado: miembros.estado,
        ultimaAsistencia: miembros.ultimaAsistencia,
        fechaIngreso: miembros.fechaIngreso,
        createdAt: miembros.createdAt,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
          ne(miembros.estado, 'baja'),
        ),
      )
      .orderBy(asc(miembros.nombre));

    const nombres = new Map(
      filas.map((f) => [
        f.miembroId,
        [f.nombre, f.apellidos].filter(Boolean).join(' '),
      ]),
    );

    // 3. Quién acompaña a quién, y el último contacto de cada persona. Sin
    //    ministerios no hay nada que pedir, y `inArray` con una lista vacía es
    //    un `false` que Drizzle sabe escribir, pero mejor no viajar a Irlanda
    //    para traer cero filas.
    const [asignaciones, contactos] =
      ministerioIds.length === 0
        ? [[], []]
        : await Promise.all([
            tx
              .select({
                miembroId: seguimientoAsignaciones.miembroId,
                responsable: seguimientoAsignaciones.responsableMiembroId,
              })
              .from(seguimientoAsignaciones)
              .where(
                and(
                  eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
                  inArray(seguimientoAsignaciones.ministerioId, ministerioIds),
                  eq(seguimientoAsignaciones.activo, true),
                ),
              ),
            tx
              .select({
                miembroId: seguimientoContactos.miembroId,
                fecha: seguimientoContactos.fecha,
                via: seguimientoContactos.via,
                resultado: seguimientoContactos.resultado,
              })
              .from(seguimientoContactos)
              .where(
                and(
                  eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
                  inArray(seguimientoContactos.ministerioId, ministerioIds),
                ),
              )
              .orderBy(
                desc(seguimientoContactos.fecha),
                desc(seguimientoContactos.createdAt),
              ),
          ]);

    const acompanante = new Map<string, string>();
    for (const a of asignaciones)
      if (!acompanante.has(a.miembroId)) acompanante.set(a.miembroId, a.responsable);

    // El primero de cada persona es el más reciente: la consulta viene ordenada.
    const ultimo = new Map<string, (typeof contactos)[number]>();
    for (const c of contactos)
      if (!ultimo.has(c.miembroId)) ultimo.set(c.miembroId, c);

    // 4. Quién está en el embudo de nuevos, y sus presencias. Solo de ellos:
    //    traer las asistencias de la congregación entera para saber si volvieron
    //    cinco personas sería leer el mapa de quién va a la iglesia para nada.
    const visibles = filas
      .filter((f) => !sinPermiso.has(f.miembroId))
      .map((f) => ({
        ...f,
        creadaEl: timestampAFechaHoraLocal(f.createdAt, tz).fecha,
      }))
      .map((f) => {
        const llegada = f.fechaIngreso ?? f.creadaEl;
        return { ...f, llegada: llegada > hoy ? hoy : llegada };
      });

    const enEmbudo = visibles
      .filter(
        (f) =>
          (f.estado === 'visitante' || f.estado === 'nuevo') &&
          f.llegada >= limiteNuevos,
      )
      .map((f) => f.miembroId);

    const presencias =
      enEmbudo.length === 0
        ? []
        : await tx
            .select({
              miembroId: asistencias.miembroId,
              reunionId: asistencias.reunionId,
              fecha: reuniones.fecha,
            })
            .from(asistencias)
            .innerJoin(reuniones, eq(reuniones.id, asistencias.reunionId))
            .where(
              and(
                eq(asistencias.iglesiaId, ctx.iglesia.id),
                isNull(reuniones.ministerioId),
                eq(asistencias.presente, true),
                inArray(asistencias.miembroId, enEmbudo),
              ),
            );

    const presenciasDe = new Map<string, { reunionId: string; fecha: string }[]>();
    for (const p of presencias) {
      const lista = presenciasDe.get(p.miembroId) ?? [];
      lista.push(p);
      presenciasDe.set(p.miembroId, lista);
    }
    const embudo = new Set(enEmbudo);

    // 5. Las ausencias APUNTADAS en cultos anteriores al corte de
    //    `desdeCuandoCuenta()`: listas pasadas con retraso, cuando la ficha ya
    //    existía. Solo las de antes del corte —las de después ya las cuenta la
    //    resta de fechas—, así que lo normal es que esto devuelva cero filas.
    //    El día de la ficha, en la zona de la iglesia, como `creadaEl`.
    //
    //    Y solo las POSTERIORES a su llegada. `guardarLista` escribe una fila
    //    por cada ficha que existe al guardar, no el día del culto: volver a
    //    guardar la lista del 11 después de apuntar el 19 a un visitante le
    //    deja un «no vino» el 11, ocho días antes de que llegara. Estricto, como
    //    el `>` de `desdeCuandoCuenta()`: el día que llega estaba allí.
    const ausenciasPrevias = await tx
      .select({ miembroId: asistencias.miembroId, fecha: reuniones.fecha })
      .from(asistencias)
      .innerJoin(reuniones, eq(reuniones.id, asistencias.reunionId))
      .innerJoin(miembros, eq(miembros.id, asistencias.miembroId))
      .where(
        and(
          eq(asistencias.iglesiaId, ctx.iglesia.id),
          isNull(reuniones.ministerioId),
          eq(asistencias.presente, false),
          sql`${reuniones.fecha} <= greatest(${miembros.fechaIngreso}, (${miembros.createdAt} at time zone ${tz})::date)`,
          sql`(${miembros.fechaIngreso} is null or ${reuniones.fecha} > ${miembros.fechaIngreso})`,
        ),
      );

    const previasDe = new Map<string, string[]>();
    for (const a of ausenciasPrevias) {
      const lista = previasDe.get(a.miembroId) ?? [];
      lista.push(a.fecha);
      previasDe.set(a.miembroId, lista);
    }

    const personas: PersonaEnSeguimiento[] = visibles.map((f) => {
      const desde = desdeCuandoCuenta(
        f.ultimaAsistencia,
        f.fechaIngreso,
        f.creadaEl,
      );
      // Las dos cuentas no se solapan: las previas son de antes del corte y
      // las otras, de después. Y las previas también se cortan en su última
      // asistencia: «seguidas» quiere decir desde la última vez que vino.
      const ultima = f.ultimaAsistencia;
      const faltasSeguidas =
        fechas.filter((d) => d > desde).length +
        (previasDe.get(f.miembroId) ?? []).filter((d) => !ultima || d > ultima)
          .length;

      const c = ultimo.get(f.miembroId);
      const acompanaId = acompanante.get(f.miembroId);

      return {
        miembroId: f.miembroId,
        nombre: nombres.get(f.miembroId)!,
        telefono: f.telefono,
        estado: f.estado,
        ultimaAsistencia: f.ultimaAsistencia,
        faltasSeguidas,
        llegada: f.llegada,
        nuevo: embudo.has(f.miembroId)
          ? etapaDe(
              f.llegada,
              presenciasDe.get(f.miembroId) ?? [],
              recientes,
              fechas,
            )
          : null,
        acompana: acompanaId
          ? {
              miembroId: acompanaId,
              // Quien acompaña es de la misma congregación, así que su nombre ya
              // está en el mapa. El respaldo cubre el caso raro de que su ficha
              // esté archivada: mejor «Alguien del equipo» que reventar la lista.
              nombre: nombres.get(acompanaId) ?? 'Alguien del equipo',
            }
          : null,
        ultimoContacto: c
          ? { fecha: c.fecha, via: c.via, resultado: c.resultado }
          : null,
      };
    });

    return {
      fechas,
      personas,
      contactados: new Set(contactos.map((c) => c.miembroId)),
    };
  });
}

/**
 * Llegó, volvió o se queda.
 *
 * «Volvió» es una presencia en un culto con lista DESPUÉS de la primera visita,
 * y la primera visita es la más temprana entre su fecha de llegada y su primera
 * presencia: la tarjeta de papel suele teclearse el lunes, con la fecha del
 * domingo en que vino.
 */
function etapaDe(
  llegada: string,
  presencias: { reunionId: string; fecha: string }[],
  recientes: Set<string>,
  fechas: string[],
): NonNullable<PersonaEnSeguimiento['nuevo']> {
  const primera = presencias.reduce(
    (min, p) => (p.fecha < min ? p.fecha : min),
    llegada,
  );
  const volvio = presencias.some((p) => p.fecha > primera);
  const presenciasRecientes = presencias.filter((p) =>
    recientes.has(p.reunionId),
  ).length;

  return {
    etapa:
      presenciasRecientes >= SE_QUEDA.presencias
        ? 'se_queda'
        : volvio
          ? 'volvio'
          : 'llego',
    presenciasRecientes,
    listasDesdeQueLlego: fechas.filter((d) => d > primera).length,
  };
}

/**
 * Lo que se sabe de si ha vuelto quien solo ha venido una vez.
 *
 * Aquí y no en cada pantalla porque la lista de nuevos y la ficha lo dicen las
 * dos, y si cada una lo deduce a su manera acaban contando cosas distintas de
 * la misma persona. Tres casos, y solo se afirma lo que el dato respalda:
 *
 *   - hubo listas en las que salía y no vino: «no ha vuelto en N»;
 *   - hubo listas después de que llegara, pero se pasaron antes de teclear su
 *     ficha, así que no salía en ellas: eso, y no «no ha habido listas»;
 *   - no ha habido ninguna lista desde que llegó: no se sabe.
 */
export function queSabemosDeSiVolvio(
  faltasSeguidas: number,
  nuevo: NonNullable<PersonaEnSeguimiento['nuevo']>,
): string {
  if (faltasSeguidas > 0) {
    return faltasSeguidas === 1
      ? 'No vino a la reunión con lista que hubo después.'
      : `No ha vuelto en las ${faltasSeguidas} reuniones con lista que ha habido después.`;
  }
  return nuevo.listasDesdeQueLlego > 0
    ? 'Todavía no ha salido en ninguna lista desde que tiene ficha.'
    : 'Aún no se ha pasado lista en ningún culto desde que llegó: no sabemos si ha vuelto.';
}

/**
 * La congregación ordenada por quién lleva más tiempo sin aparecer.
 *
 * Son TODAS las personas que el seguimiento puede ver, también las que están en
 * el embudo de nuevos y las que no se han perdido nada: la ficha de
 * `[miembroId]` y `estaEnSeguimiento()` deciden con esta lista si alguien
 * existe. Quien pinta la lista de ausentes filtra con `esAusente()`.
 */
export async function personasPorFaltas(
  ctx: UserContext,
  ministerioId: string,
): Promise<PersonaEnSeguimiento[]> {
  const { personas } = await calcular(ctx, [ministerioId]);

  // Quien más se ha perdido, primero. A igualdad, quien lleva más sin venir; y
  // los que nunca vinieron al final de su grupo, no al principio: adelantarlos
  // empujaría hacia abajo a los miembros de siempre que acaban de dejar de
  // venir — que es justo la gente por la que existe esta pantalla.
  personas.sort((a, b) => {
    if (b.faltasSeguidas !== a.faltasSeguidas) {
      return b.faltasSeguidas - a.faltasSeguidas;
    }
    if (a.ultimaAsistencia && b.ultimaAsistencia) {
      return a.ultimaAsistencia.localeCompare(b.ultimaAsistencia);
    }
    if (a.ultimaAsistencia) return -1;
    if (b.ultimaAsistencia) return 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return personas;
}

/** ¿Sale en la lista de ausentes? Quien está en nuevos, no. */
export function esAusente(p: PersonaEnSeguimiento): boolean {
  return p.nuevo === null && p.faltasSeguidas > 0;
}

export type NuevosDelSeguimiento = {
  personas: (PersonaEnSeguimiento & {
    nuevo: NonNullable<PersonaEnSeguimiento['nuevo']>;
  })[];
  /**
   * ¿Se ha pasado lista en algún culto de los últimos `DIAS_EN_NUEVOS` días?
   * Sin eso no se sabe quién ha vuelto, y la pantalla tiene que decirlo en vez
   * de enseñar a todo el mundo en «llegó» como si nadie hubiera vuelto.
   */
  hayListas: boolean;
  /** Cuántos salen en ausentes, para la cifra del selector. */
  ausentes: number;
};

/**
 * Quién ha llegado en los últimos `DIAS_EN_NUEVOS` días, por etapa.
 *
 * Dentro de cada etapa, primero quien nadie ha contactado y después lo más
 * reciente: a quien acaba de llegar se le llama en los primeros días o ya no.
 */
export async function nuevosDelSeguimiento(
  ctx: UserContext,
  ministerioId: string,
): Promise<NuevosDelSeguimiento> {
  const { fechas, personas } = await calcular(ctx, [ministerioId]);
  const limite = sumarDias(
    hoyEnLaIglesia(ctx.iglesia.timezone),
    -DIAS_EN_NUEVOS,
  );

  const nuevos = personas.filter(
    (p): p is NuevosDelSeguimiento['personas'][number] => p.nuevo !== null,
  );

  nuevos.sort((a, b) => {
    if (!a.ultimoContacto !== !b.ultimoContacto) return a.ultimoContacto ? 1 : -1;
    if (a.llegada !== b.llegada) return b.llegada.localeCompare(a.llegada);
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return {
    personas: nuevos,
    hayListas: fechas.some((f) => f >= limite),
    ausentes: personas.filter(esAusente).length,
  };
}

export type CifrasSeguimiento = {
  /** Los ministerios con seguimiento que esta persona puede abrir. */
  ministerios: { id: string; nombre: string }[];
  llegaronEsteMes: number;
  /** De los que están en nuevos, cuántos han vuelto (o ya se quedan). */
  volvieron: number;
  enNuevos: number;
  /** Nuevos a los que nadie ha apuntado ningún contacto. */
  sinLlamar: number;
  /** Fuera de nuevos, con tres o más reuniones con lista perdidas seguidas. */
  ausentesTresOMas: number;
  hayListas: boolean;
};

/**
 * Las cifras del seguimiento para `/panel/hoy`. Solo números, ningún nombre.
 *
 * Se piden únicamente si quien mira puede abrir al menos un ministerio con
 * seguimiento —las mismas tres llaves que su `layout.tsx`—, y si no, devuelve
 * `null` sin consultar nada más. Así el enlace del bloque siempre abre, y la
 * cifra no le cuenta a nadie algo que no podría ver pulsando.
 *
 * «Sin llamar» cuenta los contactos de TODOS los ministerios con seguimiento
 * que puede abrir: si Evangelismo ya llamó a alguien, para Consolidación tampoco
 * está sin llamar.
 */
export async function cifrasDeSeguimiento(
  ctx: UserContext,
): Promise<CifrasSeguimiento | null> {
  if (!esPastor(ctx) && !puede(ctx, 'ver_seguimiento')) return null;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        modulos: ministerios.modulos,
      })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre)),
  );

  const abiertos = filas
    .filter(
      (m) =>
        tieneModulo(m.modulos, 'seguimiento') &&
        puedeGestionarMinisterio(ctx, m.id),
    )
    .map((m) => ({ id: m.id, nombre: m.nombre }));

  if (abiertos.length === 0) return null;

  const { fechas, personas, contactados } = await calcular(
    ctx,
    abiertos.map((m) => m.id),
  );

  const { desde: inicioDelMes } = mesEnLaIglesia(ctx.iglesia.timezone);
  const limite = sumarDias(
    hoyEnLaIglesia(ctx.iglesia.timezone),
    -DIAS_EN_NUEVOS,
  );
  const nuevos = personas.filter((p) => p.nuevo !== null);

  return {
    ministerios: abiertos,
    llegaronEsteMes: nuevos.filter((p) => p.llegada >= inicioDelMes).length,
    volvieron: nuevos.filter((p) => p.nuevo!.etapa !== 'llego').length,
    enNuevos: nuevos.length,
    sinLlamar: nuevos.filter((p) => !contactados.has(p.miembroId)).length,
    ausentesTresOMas: personas.filter(
      (p) => p.nuevo === null && p.faltasSeguidas >= 3,
    ).length,
    hayListas: fechas.some((f) => f >= limite),
  };
}

/**
 * ¿Sale esta persona en la lista de seguimiento de este ministerio?
 *
 * Es la puerta de las actions que ESCRIBEN sobre alguien, y responde con
 * `personasPorFaltas()` a propósito en vez de con una consulta propia contra
 * `miembros`: la ficha de `[miembroId]` ya decide con esa función si existe, y
 * una segunda consulta para la misma pregunta acabaría dando otra respuesta.
 *
 * Hace falta por el permiso de asistencia. `/privacidad` §4 promete que quien no
 * lo da deja de aparecer también en el seguimiento, y `/acepta` borra sus
 * contactos y su acompañante al negarlo. La lista ya no le enseñaba, pero las
 * actions aceptaban su uuid en un POST fabricado y volvían a crear justo lo que
 * se acababa de borrar.
 *
 * Cuesta lo mismo que pintar la lista, y la action redirige a una página que la
 * vuelve a pintar: no es el sitio donde ahorrar una consulta.
 */
export async function estaEnSeguimiento(
  ctx: UserContext,
  ministerioId: string,
  miembroId: string,
): Promise<boolean> {
  const personas = await personasPorFaltas(ctx, ministerioId);
  return personas.some((p) => p.miembroId === miembroId);
}

export type ContactoRegistrado = {
  id: string;
  fecha: string;
  via: ViaContacto;
  resultado: ResultadoContacto;
  proximoPaso: string | null;
  autor: string;
};

/** Todo lo que se ha hablado con una persona, de lo más reciente hacia atrás. */
export async function contactosDe(
  ctx: UserContext,
  ministerioId: string,
  miembroId: string,
): Promise<ContactoRegistrado[]> {
  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: seguimientoContactos.id,
        fecha: seguimientoContactos.fecha,
        via: seguimientoContactos.via,
        resultado: seguimientoContactos.resultado,
        proximoPaso: seguimientoContactos.proximoPaso,
        autorNombre: miembros.nombre,
        autorApellidos: miembros.apellidos,
      })
      .from(seguimientoContactos)
      .innerJoin(miembros, eq(miembros.id, seguimientoContactos.autorMiembroId))
      .where(
        and(
          eq(seguimientoContactos.iglesiaId, ctx.iglesia.id),
          eq(seguimientoContactos.ministerioId, ministerioId),
          eq(seguimientoContactos.miembroId, miembroId),
        ),
      )
      .orderBy(
        desc(seguimientoContactos.fecha),
        desc(seguimientoContactos.createdAt),
      );

    return filas.map((f) => ({
      id: f.id,
      fecha: f.fecha,
      via: f.via,
      resultado: f.resultado,
      proximoPaso: f.proximoPaso,
      autor: [f.autorNombre, f.autorApellidos].filter(Boolean).join(' '),
    }));
  });
}

/** Quién acompaña a esta persona en este ministerio, si alguien lo hace. */
export async function acompanaDe(
  ctx: UserContext,
  ministerioId: string,
  miembroId: string,
): Promise<string | null> {
  return withUser(ctx.user.id, async (tx) => {
    const [fila] = await tx
      .select({ responsable: seguimientoAsignaciones.responsableMiembroId })
      .from(seguimientoAsignaciones)
      .where(
        and(
          eq(seguimientoAsignaciones.iglesiaId, ctx.iglesia.id),
          eq(seguimientoAsignaciones.ministerioId, ministerioId),
          eq(seguimientoAsignaciones.miembroId, miembroId),
          eq(seguimientoAsignaciones.activo, true),
        ),
      )
      .limit(1);

    return fila?.responsable ?? null;
  });
}
