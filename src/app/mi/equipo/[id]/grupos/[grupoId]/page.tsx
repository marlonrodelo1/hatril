import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarRange, CircleCheck, TriangleAlert } from 'lucide-react';

import { getOrigin } from '@/lib/auth/get-origin';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { guiasDeLaRed, semanasDelGrupo } from '@/lib/grupos/consultas';
import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
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
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { AvatarPersona } from '@/components/avatar-persona';
import { Invitar, urlDeInvitacion } from '@/components/grupos/invitar';
import { SemanasAnteriores } from '@/components/grupos/semanas';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONFIRMACIONES, SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';
import { Fila, Lista, MarcoEquipo, Seccion } from '../../../_components/marco';
import { Insignia } from '../../../_components/insignia';
import { Contador } from './_components/contador';
import { reportarSemana } from './actions';

export const metadata: Metadata = { title: 'Tu grupo' };

const PAPEL = { lider: 'Líder', auxiliar: 'Auxiliar', participante: null } as const;

/**
 * La célula de quien la lleva, en el móvil: el reporte de la semana en un
 * toque, los próximos temas, invitar y su gente.
 *
 * EL REPORTE, ARRIBA Y YA RELLENO
 * -------------------------------
 * Se abre al acabar la reunión, de pie en el salón de una casa. Viene con la
 * cifra de la semana anterior y el tema planificado —o el de la guía de la
 * red—, así que lo normal es tocar «Enviar» y ya. «No hubo reunión» es otro
 * botón del mismo formulario: también es un reporte, y vale lo mismo.
 *
 * Es la acción de la pantalla y lleva el único naranja. Cuando ya está
 * reportada, la tarjeta lo dice y ofrece cambiarlo, sin naranja.
 *
 * SU GENTE, SIN TELÉFONOS NI ALTAS
 * --------------------------------
 * Nombres y papel, nada más. Quien la lleva no suma ni quita a nadie: la gente
 * nueva entra con el enlace de invitación, con su propio consentimiento, y a
 * quien no tiene la app la suma la red desde el panel.
 */
export default async function MiGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; grupoId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string; semana?: string; cambiar?: string }>;
}) {
  const { id, grupoId } = await params;
  const { ctx, grupo, ministerio, modo } = await requireGrupoEnLaApp(id, grupoId);
  const { error, guardado, semana: pedida, cambiar } = await searchParams;

  const e = etiquetasDeGrupos(ministerio.tipo);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const aqui = rutaApp(id, 'grupos', grupoId);

  const anteriores = semanasAnteriores(grupo.diaSemana, hoy, 6);
  const proximas = proximasSemanas(grupo.diaSemana, hoy, SEMANAS_POR_DELANTE);
  const desde = sumarDias(anteriores[0]!, -7 * SEMANAS_ATRAS_REPORTABLES);
  const hasta = proximas[proximas.length - 1]!;

  const [semanas, guias, origen] = await Promise.all([
    semanasDelGrupo(ctx, grupoId, desde, hasta),
    guiasDeLaRed(ctx, id, desde, hasta),
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
    pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) && esSemanaReportable(pedida, hoy)
      ? pedida
      : toca.semana;
  const fecha = fechaDeLaReunion(semana, grupo.diaSemana);
  const guardada = semanas.get(semana);
  const reportada = guardada && guardada.estado !== 'prevista';
  const editando = !reportada || cambiar === '1';
  // Dada de alta en Hatril después de esa reunión: se puede reportar —la célula
  // ya existía—, pero no se le reclama. Es lo mismo que mira el aviso de la red.
  const anteriorAlAlta = fecha < grupo.alta;

  // La cifra de partida: la última semana reportada con gente, o los que son.
  const ultima = [...semanas.values()]
    .filter((s) => s.estado === 'celebrada' && s.semana < semana)
    .sort((a, b) => b.semana.localeCompare(a.semana))[0];
  const asistentesInicial =
    guardada?.estado === 'celebrada'
      ? (guardada.asistentes ?? 0)
      : (ultima?.asistentes ?? grupo.integrantes.length);
  const temaInicial = guardada?.tema ?? guias.get(semana) ?? '';

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={grupo.nombre}
      subtitulo={[cuandoSeReune(grupo.diaSemana, grupo.hora), grupo.zona].filter(Boolean).join(' · ')}
      volver={modo === 'red' ? rutaApp(id, 'grupos') : rutaApp(id)}
      error={error}
      ok={guardado && Object.hasOwn(CONFIRMACIONES, guardado) ? CONFIRMACIONES[guardado] : undefined}
    >
      {/* ---------- El reporte ---------- */}
      <section
        id="reporte"
        className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="t-subtitulo">
            {fecha === hoy ? 'La reunión de hoy' : `La reunión del ${diaCorto(fecha, hoy).toLocaleLowerCase('es')}`}
          </h2>
          {!reportada && anteriorAlAlta ? (
            <p className="text-pretty text-label text-muted-foreground">
              Fue antes de darla de alta aquí. Si quieres que cuente, repórtala; si no,
              la primera que se pide es la del{' '}
              {diaCorto(fechaDeLaReunion(proximas[0]!, grupo.diaSemana), hoy).toLocaleLowerCase('es')}.
            </p>
          ) : !reportada && fecha < hoy ? (
            <p className="flex items-center gap-2 text-label font-semibold text-badge-warning-fg">
              <TriangleAlert className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
              Sin reportar
            </p>
          ) : null}
        </div>

        {!editando && guardada ? (
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-start gap-2 text-body">
              <CircleCheck className="mt-0.5 size-4 flex-none text-badge-success-fg" strokeWidth={1.8} aria-hidden />
              <span>
                {guardada.estado === 'no_hubo'
                  ? 'Reportada: no hubo reunión.'
                  : `Reportada: vinieron ${guardada.asistentes}${guardada.visitas ? ` y ${guardada.visitas} de visita` : ''}.`}
                {guardada.tema && (
                  <span className="text-muted-foreground"> Tema: {guardada.tema}</span>
                )}
              </span>
            </p>
            <Link
              href={`${aqui}?semana=${semana}&cambiar=1#reporte`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Cambiar el reporte
            </Link>
          </div>
        ) : (
          <form action={reportarSemana.bind(null, id, grupoId)} className="flex flex-col gap-4">
            <input type="hidden" name="semana" value={semana} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Contador
                nombre="asistentes"
                etiqueta="Vinieron"
                inicial={asistentesInicial}
                max={500}
                ayuda="De los que van, cuántos estaban. Contándote."
              />
              <Contador
                nombre="visitas"
                etiqueta="Visitas"
                inicial={guardada?.estado === 'celebrada' ? (guardada.visitas ?? 0) : 0}
                max={200}
                ayuda="Gente de fuera. Solo el número: de ellos no se apunta nada."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tema" className="text-label font-semibold">
                Tema
                <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                id="tema"
                name="tema"
                maxLength={120}
                defaultValue={temaInicial}
                placeholder="p. ej. El perdón, Mateo 18"
                autoComplete="off"
              />
              {!guardada?.tema && guias.get(semana) && (
                <p className="t-label text-muted-foreground">Es el de la guía de {e.laRed}.</p>
              )}
            </div>
            <p className="text-pretty text-label text-muted-foreground">
              Sin peticiones de oración ni nombres: lo que se cuenta en la reunión se queda
              en ella.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button type="submit" name="hubo" value="si">
                Enviar el reporte
              </Button>
              <Button type="submit" name="hubo" value="no" variant="outline" formNoValidate>
                No hubo reunión
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* ---------- Próximos temas ---------- */}
      <Seccion rotulo="Próximas semanas">
        <Lista>
          {proximas.map((s) => {
            const propio = semanas.get(s)?.tema;
            const guia = guias.get(s);
            return (
              <Fila key={s}>
                <div className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body font-semibold">
                      {diaCorto(fechaDeLaReunion(s, grupo.diaSemana), hoy)}
                    </span>
                    <span className="text-pretty text-label text-muted-foreground">
                      {propio ?? guia ?? 'Sin tema todavía'}
                    </span>
                  </span>
                  {!propio && guia && <Insignia tono="neutro">De la guía</Insignia>}
                </div>
              </Fila>
            );
          })}
        </Lista>
        <Link
          href={rutaApp(id, 'grupos', grupoId, 'temas')}
          className={buttonVariants({ variant: 'outline' }) + ' w-fit'}
        >
          <CalendarRange strokeWidth={1.8} />
          Planificar los temas
        </Link>
      </Seccion>

      <Invitar
        url={urlDeInvitacion({ slug: ctx.iglesia.slug }, origen, grupo.codigo)}
        grupo={grupo.nombre}
        iglesia={ctx.iglesia.nombre}
      />

      {/* ---------- Su gente ---------- */}
      <Seccion
        rotulo={grupo.integrantes.length === 1 ? '1 persona' : `${grupo.integrantes.length} personas`}
      >
        <Lista>
          {grupo.integrantes.map((p) => (
            <Fila key={p.filaId}>
              <div className="flex items-center gap-3 px-4 py-3 md:px-5">
                <AvatarPersona nombre={p.nombre} tamano="sm" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body font-semibold">{p.nombre}</span>
                  {p.miembroId === ctx.miembroId && (
                    <span className="text-label text-muted-foreground">Tú</span>
                  )}
                </span>
                {PAPEL[p.rol] && <Insignia tono="marca">{PAPEL[p.rol]}</Insignia>}
              </div>
            </Fila>
          ))}
        </Lista>
        <p className="px-1 text-pretty text-label text-muted-foreground">
          Para sumar a alguien que no tiene la app, pídeselo a quien lleva {e.laRed}.
          Quien llega nuevo entra solo con el enlace de invitación.
        </p>
      </Seccion>

      {/* ---------- Anteriores ---------- */}
      <Seccion rotulo="Anteriores">
        <SemanasAnteriores
          diaSemana={grupo.diaSemana}
          alta={grupo.alta}
          hoy={hoy}
          guardadas={semanas}
          hrefReportar={(s) => `${aqui}?semana=${s}${semanas.get(s) && semanas.get(s)!.estado !== 'prevista' ? '&cambiar=1' : ''}#reporte`}
        />
      </Seccion>
    </MarcoEquipo>
  );
}
