import Link from 'next/link';
import { CalendarRange, CircleCheck, MessageCircle, Phone, TriangleAlert } from 'lucide-react';

import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { fechaDeLaReunion, horaCorta } from '@/lib/grupos/semanas';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { AvatarPersona } from '@/components/avatar-persona';
import { Invitar } from '@/components/grupos/invitar';
import { SemanasAnteriores } from '@/components/grupos/semanas';
import { Button, buttonVariants } from '@/components/ui/button';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Input } from '@/components/ui/input';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/grupos/constantes';
import { Fila, Lista, MarcoEquipo, Seccion } from '../../../_components/marco';
import { Insignia } from '../../../_components/insignia';
import { Contador } from './_components/contador';
import { EscribirALaCelula } from './_components/escribir';
import { reportarSemana } from './actions';
import type { cargar } from './datos';

const PAPEL = { lider: 'Líder', auxiliar: 'Auxiliar', participante: null } as const;

/**
 * La célula de quien la lleva, en el móvil: el reporte de la semana en un
 * toque, escribir a la célula, los próximos temas, invitar y su gente. Lo
 * pintan igual la web (`./page.tsx`) y la app empaquetada (`movil/`).
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
 * SU GENTE, CON SU TELÉFONO Y SIN ALTAS
 * -------------------------------------
 * Nombre, papel y, desde el 23-nov, el teléfono con Llamar y WhatsApp: lo
 * decidió Marlon, para que el líder pueda llamar a los suyos. Solo los de esta
 * célula (`telefonosDeLaCelula`, detrás de la guarda). Quien la lleva no suma ni
 * quita a nadie: la gente nueva entra con el enlace de invitación, con su
 * propio consentimiento, y a quien ya es de la iglesia lo suma la red.
 */
export type DatosGrupo = Awaited<ReturnType<typeof cargar>>;

export function VistaGrupo({
  id,
  grupoId,
  error,
  guardado,
  ctx,
  ministerio,
  modo,
  grupo,
  hoy,
  cuando,
  proximas,
  semana,
  fecha,
  guardada,
  reportada,
  editando,
  anteriorAlAlta,
  asistentesInicial,
  temaInicial,
  temaProximo,
  fechaProxima,
  semanas,
  guias,
  contactos,
  invitacion,
}: DatosGrupo) {
  const e = etiquetasDeGrupos(ministerio.tipo);
  const aqui = rutaApp(id, 'grupos', grupoId);
  const guardadas = new Map(Object.entries(semanas));
  const guiasPorSemana = new Map(Object.entries(guias));

  // El mensaje de partida para la célula: cuándo es la próxima y de qué va.
  const hora = horaCorta(grupo.hora);
  const mensaje = [
    'Hola a todos.',
    `Nos vemos el ${diaCorto(fechaProxima, hoy).toLocaleLowerCase('es')}${hora ? ` a las ${hora}` : ''}.`,
    temaProximo ? `Tema: ${temaProximo}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={grupo.nombre}
      subtitulo={[cuando, grupo.zona].filter(Boolean).join(' · ')}
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
                {guardada.tema && <span className="text-muted-foreground"> Tema: {guardada.tema}</span>}
              </span>
            </p>
            <BotonEnlace href={`${aqui}?semana=${semana}&cambiar=1#reporte`} variant="outline" size="sm">
              Cambiar el reporte
            </BotonEnlace>
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
              {!guardada?.tema && guiasPorSemana.get(semana) && (
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

      {/* ---------- Escribir a todos ---------- */}
      <EscribirALaCelula inicial={mensaje} grupo={grupo.nombre} />

      {/* ---------- Próximos temas ---------- */}
      <Seccion rotulo="Próximas semanas">
        <Lista>
          {proximas.map((s) => {
            const propio = guardadas.get(s)?.tema;
            const guia = guiasPorSemana.get(s);
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

      <Invitar url={invitacion} grupo={grupo.nombre} iglesia={ctx.iglesia.nombre} />

      {/* ---------- Su gente ---------- */}
      <Seccion rotulo={grupo.integrantes.length === 1 ? '1 persona' : `${grupo.integrantes.length} personas`}>
        <Lista>
          {grupo.integrantes.map((p) => {
            const yo = p.miembroId === ctx.miembroId;
            const contacto = yo ? undefined : contactos[p.miembroId];
            return (
              <Fila key={p.filaId}>
                <div className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <AvatarPersona nombre={p.nombre} tamano="sm" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body font-semibold">{p.nombre}</span>
                    {yo ? (
                      <span className="text-label text-muted-foreground">Tú</span>
                    ) : contacto ? (
                      <span className="truncate text-label text-muted-foreground tabular-nums">
                        {contacto.numero}
                      </span>
                    ) : null}
                  </span>
                  {PAPEL[p.rol] && <Insignia tono="marca">{PAPEL[p.rol]}</Insignia>}
                  {contacto && (
                    <span className="flex flex-none items-center gap-0.5">
                      {/* `<a>` y no `Link`: un `tel:` y un chat de fuera no se
                          precargan, y la app los entrega al sistema. */}
                      <a
                        href={contacto.llamar}
                        aria-label={`Llamar a ${p.nombre}`}
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      >
                        <Phone strokeWidth={1.8} aria-hidden />
                      </a>
                      {contacto.whatsapp && (
                        <a
                          href={contacto.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Escribir a ${p.nombre} por WhatsApp`}
                          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                        >
                          <MessageCircle strokeWidth={1.8} aria-hidden />
                        </a>
                      )}
                    </span>
                  )}
                </div>
              </Fila>
            );
          })}
        </Lista>
        <p className="px-1 text-pretty text-label text-muted-foreground">
          Quien llega nuevo entra con el enlace de invitación. A quien ya es de la
          iglesia, tenga la app o no, lo suma quien lleva {e.laRed}: pídeselo.
        </p>
      </Seccion>

      {/* ---------- Anteriores ---------- */}
      <Seccion rotulo="Anteriores">
        <SemanasAnteriores
          diaSemana={grupo.diaSemana}
          alta={grupo.alta}
          hoy={hoy}
          guardadas={guardadas}
          hrefReportar={(s) =>
            `${aqui}?semana=${s}${guardadas.get(s) && guardadas.get(s)!.estado !== 'prevista' ? '&cambiar=1' : ''}#reporte`
          }
        />
      </Seccion>
    </MarcoEquipo>
  );
}
