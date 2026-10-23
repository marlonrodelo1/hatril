import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DoorClosed, RefreshCw, Smartphone, TriangleAlert, UserMinus, UserPlus } from 'lucide-react';

import { esPastor } from '@/lib/auth/permisos';
import { getOrigin } from '@/lib/auth/get-origin';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { candidatosParaGrupo, obtenerGrupo, semanasDelGrupo } from '@/lib/grupos/consultas';
import { etiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { cuandoSeReune, semanasAnteriores } from '@/lib/grupos/semanas';
import { exigirUuid } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { AvatarPersona } from '@/components/avatar-persona';
import { Aviso } from '@/components/aviso';
import { Bloque, Campo, CamposDelGrupo, SELECT } from '@/components/grupos/formulario';
import { Invitar, urlDeInvitacion } from '@/components/grupos/invitar';
import { SemanasAnteriores } from '@/components/grupos/semanas';
import { Button, buttonVariants } from '@/components/ui/button';
import { Insignia } from '@/app/mi/equipo/_components/insignia';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { DialogoAsignar } from '../../../_components/dialogo-asignar';
import {
  anadirAuxiliar,
  anadirIntegrantes,
  cambiarLider,
  cerrarGrupo,
  editarGrupo,
  quitarDeAuxiliar,
  quitarIntegrante,
  regenerarCodigo,
} from '../actions';
import { CONFIRMACIONES } from '../constantes';
import { requireGrupos } from '../guarda';

export const metadata: Metadata = { title: 'Ficha del grupo' };

const PAPEL = { lider: 'Líder', auxiliar: 'Auxiliar', participante: null } as const;

/**
 * La ficha de un grupo para quien lleva la red: quién lo lleva, su gente, su
 * enlace, sus últimas semanas y sus datos.
 *
 * De arriba abajo en el orden en que se viene a algo: lo que pide atención
 * (sin líder, o un líder que ya no está en el equipo), quién lo lleva, su
 * gente, invitar, cómo le fue, y al final los datos y cerrarlo.
 *
 * El naranja es «Guardar cambios» de los datos. Cambiar líder, sumar y quitar
 * van de contorno o de icono: salen varias veces en la pantalla.
 *
 * Los teléfonos no salen. Ni aquí ni en la app: con cuarenta líderes de célula,
 * enseñarlos sería repartir los teléfonos de la congregación.
 */
export default async function GrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; grupoId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string; sumar?: string }>;
}) {
  const { id, grupoId } = await params;
  // La puerta en la página y no solo en el layout: ver `guarda.ts`.
  const { ctx, ministerio } = await requireGrupos(id);
  exigirUuid(grupoId);
  const { error, guardado, sumar } = await searchParams;

  const grupo = await obtenerGrupo(ctx, id, grupoId);
  if (!grupo) notFound();

  const e = etiquetasDeGrupos(ministerio.tipo);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const base = `/panel/ministerios/${id}/grupos`;
  const aqui = `${base}/${grupoId}`;
  const anteriores = semanasAnteriores(grupo.diaSemana, hoy, 6);

  const [semanas, candidatos, origen] = await Promise.all([
    semanasDelGrupo(ctx, grupoId, anteriores[anteriores.length - 1]!, anteriores[0]!),
    sumar ? candidatosParaGrupo(ctx, id, grupoId) : Promise.resolve([]),
    getOrigin(),
  ]);

  const lider = grupo.integrantes.find((p) => p.rol === 'lider') ?? null;
  const auxiliares = grupo.integrantes.filter((p) => p.rol === 'auxiliar');
  const dentro = new Set(grupo.integrantes.map((p) => p.miembroId));
  // HT134: quien no es pastor no se elige a sí mismo.
  const elegible = (miembroId: string) => esPastor(ctx) || miembroId !== ctx.miembroId;
  const paraLider = ministerio.equipo.filter(
    (p) => p.miembroId !== lider?.miembroId && elegible(p.miembroId),
  );
  // De auxiliar: del equipo, y que no lo lleve ya. Puede estar dentro como
  // participante: entonces sube.
  const paraAuxiliar = ministerio.equipo.filter(
    (p) =>
      elegible(p.miembroId) &&
      !grupo.integrantes.some((g) => g.miembroId === p.miembroId && g.rol !== 'participante'),
  );

  return (
    <>
      <CabeceraPanel
        titulo={grupo.nombre}
        subtitulo={[cuandoSeReune(grupo.diaSemana, grupo.hora), grupo.zona].filter(Boolean).join(' · ')}
        volver={{ href: base, texto: ministerio.nombre }}
      >
        <Link href={rutaApp(id, 'grupos', grupoId)} className={buttonVariants({ variant: 'outline' })}>
          <Smartphone strokeWidth={1.8} />
          Abrir en la app
        </Link>
      </CabeceraPanel>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            {/* ---------- Quién lo lleva ---------- */}
            <Bloque
              titulo="Su líder"
              nota="El líder y sus auxiliares, del equipo de la red. Desde la app ven a su gente y reportan cada semana."
            >
              {!lider ? (
                <p className="flex items-start gap-2 text-body font-semibold text-badge-warning-fg">
                  <TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={1.8} aria-hidden />
                  Sin líder: nadie puede reportar sus semanas.
                </p>
              ) : !lider.enEquipo ? (
                <p className="flex items-start gap-2 text-body font-semibold text-badge-warning-fg">
                  <TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={1.8} aria-hidden />
                  {lider.nombre} ya no está en el equipo de la red, y sin eso no puede
                  llevarlo. Elige a otra persona o vuelve a sumarle al equipo.
                </p>
              ) : null}

              <ul className="flex flex-col overflow-hidden rounded-lg border border-border">
                {[lider, ...auxiliares].filter((p) => p !== null).map((p) => (
                  <li key={p.filaId} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
                    <AvatarPersona nombre={p.nombre} tamano="sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body font-semibold">{p.nombre}</span>
                      {!p.enEquipo && (
                        <span className="text-label text-muted-foreground">Ya no está en el equipo</span>
                      )}
                    </span>
                    <Insignia tono="marca">{PAPEL[p.rol]}</Insignia>
                    {p.rol === 'auxiliar' && (
                      <form action={quitarDeAuxiliar.bind(null, id, grupoId, p.filaId)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar a ${p.nombre} de auxiliar`}
                          title="Quitar de auxiliar"
                        >
                          <UserMinus strokeWidth={1.8} />
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>

              {paraLider.length > 0 && (
                <form action={cambiarLider.bind(null, id, grupoId)} className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Campo etiqueta={lider ? 'Cambiar de líder' : 'Elegir líder'} nombre="lider" requerido>
                      <select id="lider" name="lider" required defaultValue="" className={SELECT}>
                        <option value="" disabled>
                          Alguien del equipo
                        </option>
                        {paraLider.map((p) => (
                          <option key={p.miembroId} value={p.miembroId}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <Button type="submit" variant="outline" className="w-fit">
                    {lider ? 'Cambiar' : 'Elegir'}
                  </Button>
                </form>
              )}

              {paraAuxiliar.length > 0 && (
                <form action={anadirAuxiliar.bind(null, id, grupoId)} className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Campo etiqueta="Añadir un auxiliar" nombre="auxiliar" requerido>
                      <select id="auxiliar" name="auxiliar" required defaultValue="" className={SELECT}>
                        <option value="" disabled>
                          Alguien del equipo
                        </option>
                        {paraAuxiliar.map((p) => (
                          <option key={p.miembroId} value={p.miembroId}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <Button type="submit" variant="outline" className="w-fit">
                    Añadir
                  </Button>
                </form>
              )}
            </Bloque>

            {/* ---------- Su gente ---------- */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="t-micro">
                  {grupo.integrantes.length === 1 ? '1 persona' : `${grupo.integrantes.length} personas`}
                </h2>
                <Link href="?sumar=1" scroll={false} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <UserPlus strokeWidth={1.8} />
                  Sumar personas
                </Link>
              </div>
              <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                {grupo.integrantes.map((p) => (
                  <li key={p.filaId} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 md:px-5">
                    <AvatarPersona nombre={p.nombre} tamano="sm" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">{p.nombre}</span>
                    {PAPEL[p.rol] && <Insignia tono="marca">{PAPEL[p.rol]}</Insignia>}
                    {p.rol !== 'lider' && (
                      <form action={quitarIntegrante.bind(null, id, grupoId, p.filaId)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar a ${p.nombre}`}
                          title="Quitar"
                        >
                          <UserMinus strokeWidth={1.8} />
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <p className="px-1 text-pretty text-label text-muted-foreground">
                Quien llega nuevo entra solo con el enlace de invitación, al aprobarse su
                solicitud. Suma aquí a quien ya es de la iglesia o no tiene la app.
              </p>
            </section>

            <Invitar
              url={urlDeInvitacion({ slug: ctx.iglesia.slug }, origen, grupo.codigo)}
              grupo={grupo.nombre}
              iglesia={ctx.iglesia.nombre}
            >
              <form action={regenerarCodigo.bind(null, id, grupoId)}>
                <Button type="submit" variant="ghost">
                  <RefreshCw strokeWidth={1.8} />
                  Cambiar el enlace
                </Button>
              </form>
            </Invitar>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-2.5">
              <h2 className="t-micro px-1">Últimas semanas</h2>
              <SemanasAnteriores
                diaSemana={grupo.diaSemana}
                alta={grupo.alta}
                hoy={hoy}
                guardadas={semanas}
              />
            </section>

            <form action={editarGrupo.bind(null, id, grupoId)}>
              <Bloque titulo="Cuándo y dónde se reúne">
                <CamposDelGrupo valores={grupo} />
                <Button type="submit" className="w-fit">
                  Guardar cambios
                </Button>
              </Bloque>
            </form>

            <section className="flex flex-col items-start gap-3 rounded-xl border border-danger-border bg-danger-soft p-5">
              <div className="flex flex-col gap-1">
                <h2 className="t-subtitulo">Cerrar</h2>
                <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">
                  Para cuando ya no se reúne. Sale de la lista, su enlace deja de valer y
                  su gente queda fuera. Lo que reportó se queda en la historia de{' '}
                  {e.laRed}. No se puede volver a abrir: si vuelve a reunirse, se crea de
                  nuevo.
                </p>
              </div>
              <form action={cerrarGrupo.bind(null, id, grupoId)} className="flex flex-col items-start gap-3">
                <label className="flex cursor-pointer items-start gap-2.5 text-body leading-relaxed">
                  <input type="checkbox" name="confirmar" required className="mt-1 flex-none" />
                  <span>Entiendo que no se puede deshacer.</span>
                </label>
                <Button type="submit" variant="destructive">
                  <DoorClosed strokeWidth={1.8} />
                  Cerrar «{grupo.nombre}»
                </Button>
              </form>
            </section>
          </div>
        </div>
      </Contenedor>

      {sumar && (
        <DialogoAsignar
          ministerioNombre={grupo.nombre}
          candidatos={candidatos.filter((c) => !dentro.has(c.id))}
          accion={anadirIntegrantes.bind(null, id, grupoId)}
          cerrar={aqui}
          textos={{
            titulo: `Sumar personas a ${grupo.nombre}`,
            ayuda: `Personas de la iglesia que todavía no van a ${e.ninguno} de ${e.laRed}.`,
            vacio: 'No queda nadie de la iglesia que se pueda sumar.',
            vacioBusqueda: 'Nadie con ese nombre se puede sumar.',
            sinMarcar: 'Sumar',
          }}
        />
      )}
    </>
  );
}
