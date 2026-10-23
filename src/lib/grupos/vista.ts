import 'server-only';

import type { RolGrupo } from '@/lib/db/schema/grupos';
import type { UserContext } from '@/lib/auth/user-context';
import {
  guiasDeLaRed,
  misGrupos,
  quienLleva,
  semanasDelGrupo,
  type MiGrupo,
} from './consultas';
import { etiquetasDeGrupos, type EtiquetasDeGrupos } from './etiquetas';
import {
  cuandoSeReune,
  estadoDeLaReunion,
  proximaReunion,
  type EstadoDeLaReunion,
} from './semanas';

/**
 * Lo que una persona ve de los grupos en los que está: su célula.
 *
 * Una sola función para las dos puertas por las que se llega —la tarjeta de su
 * red en `/mi/equipo` y la de `/mi/cuenta`—, para que las dos digan lo mismo.
 *
 * LO QUE VE QUIEN VA, Y LO QUE NO
 * -------------------------------
 * Quién la lleva, el día y la hora, la zona y el próximo tema. La lista de los
 * demás, no: que Fulana va a la célula del martes es cosa de Fulana y de quien
 * la lleva. No lo esconde la pantalla, lo esconde la base (`0047`), y
 * `quienLleva` ya solo puede traer a los que la llevan.
 *
 * El tema propio manda sobre la guía de la red: el líder que planificó otro
 * para esa semana es quien sabe lo que se va a hablar.
 */
export type VistaDeMiGrupo = {
  grupoId: string;
  ministerioId: string;
  ministerioNombre: string;
  etiquetas: EtiquetasDeGrupos;
  nombre: string;
  zona: string | null;
  /** «Martes · 19:30». */
  cuando: string;
  rol: RolGrupo;
  /** Líder o auxiliar Y en el equipo: lo que abre la pantalla de su célula. */
  llevo: boolean;
  lideres: { nombre: string; rol: RolGrupo }[];
  /** La reunión que ya tocó: lo que se le pide reportar a quien la lleva. */
  reunion: { semana: string; fecha: string; estado: EstadoDeLaReunion };
  proxima: { semana: string; fecha: string; tema: string | null; deLaGuia: boolean };
};

async function vistaDe(
  ctx: UserContext,
  g: MiGrupo,
  hoy: string,
): Promise<VistaDeMiGrupo> {
  const proxima = proximaReunion(g.diaSemana, hoy);
  const previa = estadoDeLaReunion({ diaSemana: g.diaSemana, hoy, alta: g.alta, estado: null });
  const desde = previa.semana < proxima.semana ? previa.semana : proxima.semana;

  const [semanas, guias, lideres] = await Promise.all([
    semanasDelGrupo(ctx, g.grupoId, desde, proxima.semana),
    guiasDeLaRed(ctx, g.ministerioId, desde, proxima.semana),
    quienLleva(ctx, g.grupoId),
  ]);

  const propio = semanas.get(proxima.semana)?.tema ?? null;
  const guia = guias.get(proxima.semana) ?? null;

  return {
    grupoId: g.grupoId,
    ministerioId: g.ministerioId,
    ministerioNombre: g.ministerioNombre,
    etiquetas: etiquetasDeGrupos(g.ministerioTipo),
    nombre: g.nombre,
    zona: g.zona,
    cuando: cuandoSeReune(g.diaSemana, g.hora),
    rol: g.rol,
    llevo: g.rol !== 'participante' && ctx.ministerioIds.includes(g.ministerioId),
    lideres,
    reunion: estadoDeLaReunion({
      diaSemana: g.diaSemana,
      hoy,
      alta: g.alta,
      estado: semanas.get(previa.semana)?.estado ?? null,
    }),
    proxima: { ...proxima, tema: propio ?? guia, deLaGuia: !propio && Boolean(guia) },
  };
}

/** Los grupos de esta persona, ya resueltos. De un ministerio, si se pide. */
export async function vistaDeMisGrupos(
  ctx: UserContext,
  hoy: string,
  ministerioId?: string,
): Promise<VistaDeMiGrupo[]> {
  const mios = (await misGrupos(ctx)).filter(
    (g) => !ministerioId || g.ministerioId === ministerioId,
  );
  return Promise.all(mios.map((g) => vistaDe(ctx, g, hoy)));
}
