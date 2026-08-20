import 'server-only';

import { and, asc, eq } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { iglesias, ministerios, type HorarioSemanal } from '@/lib/db/schema';
import type { Red } from '@/lib/iglesias/redes';

/**
 * Datos de la web pública de una iglesia.
 *
 * POR QUÉ `dbAdmin` Y NO `withAnon`
 * ---------------------------------
 * Es la excepción que se anunció en la migración 0001. La policy de `anon` solo
 * deja ver iglesias con `visible_en_directorio = true`, y a propósito: si se
 * aflojara a «cualquier iglesia activa», `anon` podría enumerar por PostgREST
 * TODAS las congregaciones de la plataforma, incluidas las que decidieron no
 * aparecer en el buscador.
 *
 * Pero tener página propia y salir en el directorio son decisiones distintas, y
 * muchas iglesias querrán lo primero sin lo segundo. Así que la página se sirve
 * desde el servidor, por slug exacto, y con una lista de columnas escrita a
 * mano: nada de `select *`.
 *
 * El uso es estrecho y comprobable —una consulta, un `where` por slug, columnas
 * enumeradas— que es la única forma en que `dbAdmin` resulta defendible.
 */

export type IglesiaPublica = {
  id: string;
  slug: string;
  nombre: string;
  denominacion: string | null;
  descripcion: string | null;
  historia: string | null;
  ciudad: string | null;
  timezone: string;
  /** Para pintar el precio de un evento. La moneda es de la iglesia. */
  moneda: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  redes: Partial<Record<Red, string>>;
  logoUrl: string | null;
  bannerUrl: string | null;
  imagenes: string[];
  horarios: HorarioSemanal[];
  cuentaDonativos: string | null;
  titularDonativos: string | null;
  /** Si tiene abierta la puerta a que alguien pida unirse desde la web. */
  aceptaSolicitudes: boolean;
  grupos: {
    id: string;
    nombre: string;
    descripcion: string | null;
    colorHex: string;
    fotoUrl: string | null;
  }[];
};

export async function obtenerIglesiaPublica(
  slug: string,
): Promise<IglesiaPublica | null> {
  const filas = await dbAdmin
    .select({
      id: iglesias.id,
      slug: iglesias.slug,
      nombre: iglesias.nombre,
      denominacion: iglesias.denominacion,
      descripcion: iglesias.descripcion,
      historia: iglesias.historia,
      ciudad: iglesias.ciudad,
      timezone: iglesias.timezone,
      moneda: iglesias.moneda,
      direccion: iglesias.direccion,
      telefono: iglesias.telefono,
      email: iglesias.email,
      web: iglesias.web,
      redes: iglesias.redes,
      logoUrl: iglesias.logoUrl,
      bannerUrl: iglesias.bannerUrl,
      imagenes: iglesias.imagenes,
      horarios: iglesias.horarios,
      cuentaDonativos: iglesias.cuentaDonativos,
      titularDonativos: iglesias.titularDonativos,
      aceptaSolicitudes: iglesias.aceptaSolicitudes,
    })
    .from(iglesias)
    .where(
      and(
        eq(iglesias.slug, slug),
        eq(iglesias.activa, true),
        // Si la iglesia no ha publicado su web, esto no existe. Sin esta
        // condición, cualquiera vería la página de una congregación que todavía
        // la está preparando.
        eq(iglesias.webPublica, true),
      ),
    )
    .limit(1);

  const iglesia = filas[0];
  if (!iglesia) return null;

  const grupos = await dbAdmin
    .select({
      id: ministerios.id,
      nombre: ministerios.nombre,
      descripcion: ministerios.descripcion,
      colorHex: ministerios.colorHex,
      fotoUrl: ministerios.fotoUrl,
    })
    .from(ministerios)
    .where(
      and(
        eq(ministerios.iglesiaId, iglesia.id),
        eq(ministerios.activo, true),
      ),
    )
    .orderBy(asc(ministerios.orden), asc(ministerios.nombre));

  // Ojo con lo que NO se pide: `lider_miembro_id`. Es una persona, y una
  // persona no sale a internet sin que ella lo decida. El diseño enseña
  // fotos y nombres de los pastores; eso llegará con un campo propio que la
  // iglesia rellene a conciencia, no derivado del fichero de miembros.
  return { ...iglesia, grupos };
}
