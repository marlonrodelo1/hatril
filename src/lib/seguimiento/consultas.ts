import 'server-only';

import { and, asc, desc, eq, exists, isNull, ne, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  asistencias,
  miembros,
  reuniones,
  seguimientoAsignaciones,
  seguimientoContactos,
} from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import type { EstadoMiembro } from '@/lib/miembros/estados';
import { miembrosSinPermisoDeAsistencia } from '@/lib/rgpd/consultas';
import type { ResultadoContacto, ViaContacto } from './catalogos';

/**
 * Consultas de seguimiento.
 *
 * NADA DE `dbAdmin` AQUÍ DENTRO. Con estos datos —por qué cada persona dejó de
 * venir— entrar por la puerta equivocada no es un bug: es una brecha del art. 9
 * que hay que notificar. Y no hay `publica.ts` gemelo ni lo va a haber.
 */

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
   */
  faltasSeguidas: number;
  /** Quién la acompaña, si alguien la acompaña. */
  acompana: { miembroId: string; nombre: string } | null;
  ultimoContacto: {
    fecha: string;
    via: ViaContacto;
    resultado: ResultadoContacto;
  } | null;
};

/**
 * La congregación ordenada por quién lleva más tiempo sin aparecer.
 *
 * TRES CONSULTAS Y EL CRUCE EN JAVASCRIPT, NO UNA SUBCONSULTA CORRELACIONADA
 * ---------------------------------------------------------------------------
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
export async function personasPorFaltas(
  ctx: UserContext,
  ministerioId: string,
): Promise<PersonaEnSeguimiento[]> {
  // Quien no dio el permiso no sale aquí. Es la otra mitad de lo que hace
  // `listaParaPasar()`: si se le excluye de la lista de asistencia pero sigue
  // apareciendo en la de seguimiento, negarlo no habría servido de nada — es
  // esta lista, y no la otra, la que le pone a alguien al teléfono.
  const sinPermiso = await miembrosSinPermisoDeAsistencia(ctx);

  return withUser(ctx.user.id, async (tx) => {
    // 1. Las reuniones de la congregación en las que SÍ se pasó lista.
    const conLista = await tx
      .select({ fecha: reuniones.fecha })
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
      .orderBy(desc(reuniones.fecha));

    const fechas = conLista.map((r) => r.fecha);

    // 2. La congregación, con quién la acompaña.
    const filas = await tx
      .select({
        miembroId: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        telefono: miembros.telefono,
        estado: miembros.estado,
        ultimaAsistencia: miembros.ultimaAsistencia,
        acompanaId: seguimientoAsignaciones.responsableMiembroId,
      })
      .from(miembros)
      .leftJoin(
        seguimientoAsignaciones,
        and(
          eq(seguimientoAsignaciones.miembroId, miembros.id),
          eq(seguimientoAsignaciones.ministerioId, ministerioId),
          eq(seguimientoAsignaciones.activo, true),
        ),
      )
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
          ne(miembros.estado, 'baja'),
        ),
      )
      .orderBy(asc(miembros.nombre));

    // 3. Los nombres de quienes acompañan, y el último contacto de cada persona.
    const nombres = new Map(
      filas.map((f) => [
        f.miembroId,
        [f.nombre, f.apellidos].filter(Boolean).join(' '),
      ]),
    );

    const contactos = await tx
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
          eq(seguimientoContactos.ministerioId, ministerioId),
        ),
      )
      .orderBy(
        desc(seguimientoContactos.fecha),
        desc(seguimientoContactos.createdAt),
      );

    // El primero de cada persona es el más reciente: la consulta viene ordenada.
    const ultimo = new Map<string, (typeof contactos)[number]>();
    for (const c of contactos)
      if (!ultimo.has(c.miembroId)) ultimo.set(c.miembroId, c);

    const personas: PersonaEnSeguimiento[] = filas
      .filter((f) => !sinPermiso.has(f.miembroId))
      .map((f) => {
        const desde = f.ultimaAsistencia;
        const faltasSeguidas = desde
          ? fechas.filter((d) => d > desde).length
          : fechas.length;

        const c = ultimo.get(f.miembroId);

        return {
          miembroId: f.miembroId,
          nombre: nombres.get(f.miembroId)!,
          telefono: f.telefono,
          estado: f.estado,
          ultimaAsistencia: desde,
          faltasSeguidas,
          acompana: f.acompanaId
            ? {
                miembroId: f.acompanaId,
                // Quien acompaña es de la misma congregación, así que su nombre ya
                // está en el mapa. El respaldo cubre el caso raro de que su ficha
                // esté archivada: mejor «Alguien del equipo» que reventar la lista.
                nombre: nombres.get(f.acompanaId) ?? 'Alguien del equipo',
              }
            : null,
          ultimoContacto: c
            ? { fecha: c.fecha, via: c.via, resultado: c.resultado }
            : null,
        };
      });

    // Quien más se ha perdido, primero. A igualdad, quien lleva más sin venir; y
    // los que nunca vinieron al final de su grupo, no al principio: son
    // visitantes recientes en su mayoría, y adelantarlos empujaría hacia abajo a
    // los miembros de siempre que acaban de dejar de venir — que es justo la
    // gente por la que existe esta pantalla.
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
  });
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
