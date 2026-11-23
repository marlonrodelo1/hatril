import 'server-only';

import { getOrigin } from '@/lib/auth/get-origin';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { guiasDeLaRed, semanasDelGrupo, telefonosDeLaCelula } from '@/lib/grupos/consultas';
import { requireGrupoEnLaApp } from '@/lib/grupos/guarda';
import {
  cuandoSeReune,
  esSemanaReportable,
  estadoDeLaReunion,
  fechaDeLaReunion,
  proximasSemanas,
  semanasAnteriores,
  SEMANAS_ATRAS_REPORTABLES,
} from '@/lib/grupos/semanas';
import { urlDeInvitacion } from '@/components/grupos/invitar';
import { SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';

/**
 * La célula de quien la lleva (`/mi/equipo/[id]/grupos/[grupoId]`), con su
 * guarda. Lo usan la página de la web y la API de la app empaquetada.
 *
 * La puerta es `requireGrupoEnLaApp`: la red desde dentro, o llevar ESTA célula
 * y seguir en el equipo. Un participante, el líder de la de al lado o un id
 * inventado: 404.
 *
 * Todo lo que la vista necesita va ya calculado y en JSON: las semanas
 * guardadas y las guías como objetos, no como `Map`.
 */
export async function cargar({
  id,
  grupoId,
  error,
  guardado,
  semana: pedida,
  cambiar,
}: {
  id: string;
  grupoId: string;
  error?: string;
  guardado?: string;
  semana?: string;
  cambiar?: string;
}) {
  const acceso = await requireGrupoEnLaApp(id, grupoId);
  const { ctx, grupo, ministerio, modo } = acceso;

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const anteriores = semanasAnteriores(grupo.diaSemana, hoy, 6);
  const proximas = proximasSemanas(grupo.diaSemana, hoy, SEMANAS_POR_DELANTE);
  const desde = sumarDias(anteriores[0]!, -7 * SEMANAS_ATRAS_REPORTABLES);
  const hasta = proximas[proximas.length - 1]!;

  const [semanas, guias, contactos, origen] = await Promise.all([
    semanasDelGrupo(ctx, grupoId, desde, hasta),
    guiasDeLaRed(ctx, id, desde, hasta),
    telefonosDeLaCelula(acceso),
    getOrigin(),
  ]);

  // La semana del reporte: la que se pide, si se puede reportar; si no, la
  // última reunión que ya tocó.
  const toca = estadoDeLaReunion({
    diaSemana: grupo.diaSemana,
    hoy,
    alta: grupo.alta,
    estado: semanas.get(anteriores[0]!)?.estado ?? null,
  });
  const semana =
    pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) && esSemanaReportable(pedida, hoy) ? pedida : toca.semana;
  const fecha = fechaDeLaReunion(semana, grupo.diaSemana);
  const guardada = semanas.get(semana) ?? null;
  const reportada = guardada !== null && guardada.estado !== 'prevista';

  // La cifra de partida: la última semana reportada con gente, o los que son.
  const ultima = [...semanas.values()]
    .filter((s) => s.estado === 'celebrada' && s.semana < semana)
    .sort((a, b) => b.semana.localeCompare(a.semana))[0];
  const asistentesInicial =
    guardada?.estado === 'celebrada'
      ? (guardada.asistentes ?? 0)
      : (ultima?.asistentes ?? grupo.integrantes.length);

  // El tema de la próxima reunión, para el mensaje a la célula.
  const proxima = proximas[0]!;
  const temaProximo = semanas.get(proxima)?.tema ?? guias.get(proxima) ?? null;

  return {
    id,
    grupoId,
    error,
    guardado,
    ctx,
    ministerio,
    modo,
    grupo,
    hoy,
    cuando: cuandoSeReune(grupo.diaSemana, grupo.hora),
    proximas,
    semana,
    fecha,
    guardada,
    reportada,
    editando: !reportada || cambiar === '1',
    // Dada de alta en Hatril después de esa reunión: se puede reportar —la
    // célula ya existía—, pero no se le reclama. Es lo mismo que mira el aviso
    // de la red.
    anteriorAlAlta: fecha < grupo.alta,
    asistentesInicial,
    temaInicial: guardada?.tema ?? guias.get(semana) ?? '',
    temaProximo,
    fechaProxima: fechaDeLaReunion(proxima, grupo.diaSemana),
    semanas: Object.fromEntries(semanas),
    guias: Object.fromEntries(guias),
    contactos,
    invitacion: urlDeInvitacion({ slug: ctx.iglesia.slug }, origen, grupo.codigo),
  };
}
