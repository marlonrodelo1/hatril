import 'server-only';

import { and, asc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { miembros, ministerioMiembros } from '@/lib/db/schema';
import type { EstadoMiembro } from '@/lib/miembros/estados';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Lo que se pinta en `/panel/hoy`.
 *
 * POR QUÉ ESTO NO ESTÁ EN `miembros/consultas.ts`
 * -----------------------------------------------
 * Aquello resuelve el listado y la ficha, con su ámbito por ministerio y su
 * recorte de columnas sensibles. Esto son agregados para una pantalla concreta y
 * se leen de otra manera. Mezclarlos acabaría con `resumenMiembros` recibiendo
 * un parámetro por cada tarjeta nueva del panel.
 *
 * QUÉ SE ENSEÑA Y A QUIÉN
 * -----------------------
 * Los recuentos son agregados: no dicen quién es nadie y se enseñan a cualquiera
 * que tenga acceso al panel, que es lo que ya pasaba antes.
 *
 * `nuevosSinMinisterio` es otra cosa: devuelve NOMBRES. Solo debe pedirse a
 * quien pueda ver la congregación entera, y por eso la comprobación va en la
 * página. Es gente que precisamente no está en ningún equipo, así que a un líder
 * con ámbito de ministerios no le corresponde ni una de esas fichas.
 */

export type ResumenCongregacion = {
  /** Fichas vivas, sin contar las archivadas ni las dadas de baja. */
  total: number;
  porEstado: Record<EstadoMiembro, number>;
  /** Personas distintas con al menos un ministerio activo. */
  sirviendo: number;
  nuevosDelMes: number;
};

const CERO: Record<EstadoMiembro, number> = {
  visitante: 0,
  nuevo: 0,
  miembro: 0,
  inactivo: 0,
  baja: 0,
};

export async function resumenCongregacion(
  ctx: UserContext,
): Promise<ResumenCongregacion> {
  return withUser(ctx.user.id, async (tx) => {
    // Una sola pasada agrupando por estado, en vez de un `count` por situación.
    // Con cinco estados serían cinco viajes a Irlanda para pintar una fila.
    const filas = await tx
      .select({
        estado: miembros.estado,
        total: sql<number>`count(*)`,
        delMes: sql<number>`count(*) filter (
          where ${miembros.createdAt} >= date_trunc('month', now())
        )`,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
        ),
      )
      .groupBy(miembros.estado);

    const [sirven] = await tx
      .select({
        total: sql<number>`count(distinct ${ministerioMiembros.miembroId})`,
      })
      .from(ministerioMiembros)
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.activo, true),
        ),
      );

    const porEstado = { ...CERO };
    let nuevosDelMes = 0;

    for (const f of filas) {
      porEstado[f.estado] = Number(f.total);
      nuevosDelMes += Number(f.delMes);
    }

    /*
     * El total EXCLUYE las bajas, y esto es un cambio respecto a lo que había.
     *
     * Antes se contaban todas las fichas no archivadas y la tarjeta decía
     * «Personas en la iglesia». Un pastor lee eso y piensa en su congregación,
     * no en la suma de su congregación más quien se fue. Una cifra que hay que
     * matizar para que signifique algo es una cifra que engaña.
     *
     * Los visitantes SÍ cuentan: alguien que viene los domingos está en la
     * iglesia aunque todavía no sea miembro, y dejarlo fuera daría la sensación
     * contraria.
     */
    const total =
      porEstado.visitante +
      porEstado.nuevo +
      porEstado.miembro +
      porEstado.inactivo;

    return {
      total,
      porEstado,
      sirviendo: Number(sirven?.total ?? 0),
      nuevosDelMes,
    };
  });
}

export type RecienLlegado = {
  id: string;
  nombre: string;
  estado: EstadoMiembro;
  desde: Date;
};

/**
 * Quién ha llegado y todavía no sirve en ningún sitio.
 *
 * Es la pregunta pastoral que ninguna cifra contesta: no cuánta gente hay, sino
 * a quién se le está perdiendo la pista. Se limita a los estados de recién
 * llegado —un miembro veterano que no sirve en nada no es un descuido, es una
 * decisión suya— y a las diez primeras, porque esto es un aviso para actuar y no
 * un segundo listado de miembros.
 */
export async function nuevosSinMinisterio(
  ctx: UserContext,
): Promise<RecienLlegado[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        estado: miembros.estado,
        desde: miembros.createdAt,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
          inArray(miembros.estado, ['visitante', 'nuevo']),
          // `notInArray` con una subconsulta y no un `leftJoin ... is null`:
          // con el join habría que agrupar para no duplicar a quien tiene varios
          // vínculos, y aquí solo hace falta saber si tiene alguno.
          notInArray(
            miembros.id,
            tx
              .select({ id: ministerioMiembros.miembroId })
              .from(ministerioMiembros)
              .where(
                and(
                  eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
                  eq(ministerioMiembros.activo, true),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(miembros.createdAt))
      .limit(10),
  );

  return filas.map((f) => ({
    id: f.id,
    nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
    estado: f.estado,
    desde: f.desde,
  }));
}
