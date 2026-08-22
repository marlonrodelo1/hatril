import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  Plus,
  ShieldMinus,
  ShieldPlus,
  Star,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede, puedeGestionarMinisterio } from '@/lib/auth/permisos';
import {
  candidatosParaMinisterio,
  obtenerMinisterio,
} from '@/lib/ministerios/consultas';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { tipoDeMinisterio } from '@/lib/ministerios/tipos';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import {
  asignarAlMinisterio,
  cambiarRolEnEquipo,
  guardarFotoMinisterio,
  quitarDelMinisterio,
  quitarFotoMinisterio,
} from '../actions';
import { DialogoAsignar } from '../_components/dialogo-asignar';
import { PestanasMinisterio } from './_components/pestanas';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';

/*
 * Título fijo y no el nombre del ministerio.
 *
 * `generateMetadata` corre en su propio pase, así que sacar el nombre de la
 * base de datos significa ejecutar la consulta DOS veces por carga —una para el
 * título y otra para la página—. React `cache()` no lo deduplica aquí porque la
 * clave sería el objeto `ctx`, que es distinto en cada llamada.
 *
 * Con la base en Irlanda y el público en Colombia, ese viaje extra son ~200 ms
 * por visita. No los vale poner el nombre en la pestaña del navegador, que
 * además está en el h1 nada más entrar.
 */
export const metadata: Metadata = { title: 'Ministerio' };

export default async function MinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asignar?: string }>;
}) {
  const ctx = await requireIglesia();
  const { id } = await params;
  const { asignar } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  // El responsable de este equipo también pasa, aunque no tenga el permiso
  // global de la iglesia. Es justo lo que compra `gestionar_su_ministerio`.
  const puedeGestionar = puedeGestionarMinisterio(ctx, id);

  // Nombrar responsable no. A ese lo pone quien gobierna la iglesia: un líder
  // acotado puede traer ayuda, no traspasar el mando y marcharse.
  const puedeNombrarResponsable =
    esPastor(ctx) || puede(ctx, 'gestionar_ministerios');

  const color = colorDeMinisterio(ministerio.colorHex);
  const tipo = tipoDeMinisterio(ministerio.tipo);

  // Los tres se pintan juntos o no se pinta el bloque. Un recuadro con «Misión»
  // vacío y nada más no informa de nada; el hueco lo cuenta mejor la invitación
  // a escribirlo, y solo a quien puede hacerlo.
  const rumbo = [
    { etiqueta: 'Objetivo de esta temporada', texto: ministerio.objetivo },
    { etiqueta: 'Misión', texto: ministerio.mision },
    { etiqueta: 'Visión', texto: ministerio.vision },
  ].filter((c): c is { etiqueta: string; texto: string } => Boolean(c.texto));
  const colideres = ministerio.equipo.filter((p) => p.rolEquipo === 'colider');

  // Las candidatas solo se piden si el diálogo está abierto. Cargarlas siempre
  // sería una consulta de hasta 300 filas en cada visita a la pantalla, para
  // algo que casi nunca se usa.
  const candidatos =
    asignar && puedeGestionar
      ? await candidatosParaMinisterio(ctx, ministerio.id)
      : [];

  const asignarAqui = asignarAlMinisterio.bind(null, ministerio.id);

  return (
    <>
      {/* El «volver» era doble: un botón con flecha en escritorio y un enlace de
          texto en móvil, o sea el mismo destino escrito dos veces. Ahora es una
          sola miga que la cabecera resuelve igual en los dos tamaños. */}
      <CabeceraPanel
        titulo={ministerio.nombre}
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      >
        {puedeGestionar && (
          <>
            <Button
              variant="outline"
              render={<Link href={`/panel/ministerios/${ministerio.id}/editar`} />}
            >
              Editar equipo
            </Button>
            <Button render={<Link href="?asignar=1" scroll={false} />}>
              <UserPlus strokeWidth={1.8} />
              Asignar miembros
            </Button>
          </>
        )}
      </CabeceraPanel>

      <Contenedor>
        <PestanasMinisterio ministerio={ministerio} activa="equipo" />

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:flex-row md:items-center md:gap-6 md:px-6">
          <span
            className="flex size-14 flex-none items-center justify-center rounded-xl"
            style={{ background: color.suave }}
          >
            <span
              className="size-5 rounded-md"
              style={{ background: color.hex }}
            />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-[20px] font-bold tracking-[-0.022em]">
                {ministerio.nombre}
              </span>
              {/* El tipo va aquí y no en su propia columna: contesta la misma
                  pregunta que el nombre —«qué es esto»— y de él dependen las
                  herramientas que el equipo tiene encendidas. */}
              <span className="rounded-md border border-border bg-surface-alt px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">
                {tipo.nombre}
              </span>
            </span>
            <span className="text-pretty text-[14px] leading-snug text-muted-foreground">
              {ministerio.descripcion ?? 'Sin descripción todavía'}
            </span>
          </div>

          <div className="flex items-center gap-6 md:gap-7">
            <div className="flex flex-col gap-1.5">
              <span className="t-micro">Responsable</span>
              {ministerio.lider ? (
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                    {iniciales(ministerio.lider.nombre)}
                  </span>
                  <span className="text-[14.5px] font-semibold">
                    {ministerio.lider.nombre}
                  </span>
                </div>
              ) : (
                <span className="text-[14.5px] text-muted-foreground">
                  Sin asignar
                </span>
              )}

              {/* Los colíderes van debajo del responsable y no en su propia
                  columna: son la misma pregunta —«¿a quién le pregunto?»— y
                  separarlos obliga a leer dos sitios para contestarla. */}
              {colideres.length > 0 && (
                <span className="text-[13px] text-muted-foreground">
                  con {colideres.map((p) => p.nombre).join(', ')}
                </span>
              )}
            </div>

            <span className="h-10 w-px bg-border" />

            <div className="flex flex-col gap-1.5">
              <span className="t-micro">Voluntarios</span>
              <span className="text-[24px] font-bold leading-none tracking-[-0.025em]">
                {ministerio.voluntarios}
              </span>
            </div>
          </div>
        </section>

        {/* Hacia dónde trabaja el equipo. Lo escribe quien puede gestionarlo,
            desde el formulario de editar; aquí solo se lee.

            Va justo debajo de la cabecera y encima del equipo a propósito: el
            objetivo es lo que da sentido a la lista de personas que viene
            después, y enterrado al final no lo leería nadie. */}
        {rumbo.length > 0 ? (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">Hacia dónde trabaja</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {rumbo.map((c, i) => (
                <div
                  key={c.etiqueta}
                  // El objetivo ocupa la fila entera cuando hay más de uno: es
                  // el único que se revisa, y compartir ancho con la misión lo
                  // igualaba con algo que se escribe una vez y dura años.
                  className={
                    i === 0 && rumbo.length > 1
                      ? 'flex flex-col gap-1.5 sm:col-span-2'
                      : 'flex flex-col gap-1.5'
                  }
                >
                  <span className="t-micro">{c.etiqueta}</span>
                  <p className="text-pretty text-[15px] leading-relaxed">
                    {c.texto}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          puedeGestionar && (
            <section className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface p-5">
              <h2 className="t-subtitulo">Hacia dónde trabaja</h2>
              <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
                Nadie ha escrito todavía qué persigue este equipo. Un objetivo
                concreto es lo que después permite mirar atrás y saber si se ha
                cumplido.
              </p>
              <Link
                href={`/panel/ministerios/${ministerio.id}/editar`}
                className="text-[14px] font-semibold text-accent-brand underline-offset-4 hover:underline"
              >
                Escribirlo ahora
              </Link>
            </section>
          )
        )}

        {/* La foto que sale en la web pública, si esta persona puede tocar el
            ministerio. Va aquí y no en el formulario de editar porque subir una
            imagen tarda y no tiene por qué ir atado a guardar el nombre. */}
        {puedeGestionar && (
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">Foto del grupo</h2>
              <p className="t-label text-muted-foreground">
                Sale en la web pública de la iglesia. Si aparece gente
                reconocible, asegúrate de que han dado su permiso de imagen.
              </p>
            </div>

            {ministerio.fotoUrl && (
              <div className="h-[160px] overflow-hidden rounded-lg border border-border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ministerio.fotoUrl}
                  alt={`Foto de ${ministerio.nombre}`}
                  className="size-full object-cover"
                />
              </div>
            )}

            <form
              action={guardarFotoMinisterio.bind(null, ministerio.id)}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="file"
                name="foto"
                required
                accept="image/jpeg,image/png,image/webp"
                aria-label="Elegir la foto del grupo"
                className="min-w-0 flex-1 text-[13px] text-muted-foreground file:mr-2.5 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface-alt file:px-2.5 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-background"
              />
              <Button type="submit" variant="outline" size="sm">
                <Upload strokeWidth={1.7} />
                {ministerio.fotoUrl ? 'Cambiar' : 'Subir'}
              </Button>
            </form>

            {ministerio.fotoUrl && (
              <form action={quitarFotoMinisterio.bind(null, ministerio.id)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 strokeWidth={1.7} />
                  Quitarla
                </Button>
              </form>
            )}
          </section>
        )}

        {/*
         * El diseño pone aquí una segunda columna con «Próximos turnos». Sale
         * del módulo de eventos, que es de la v2. Se deja el ancho completo al
         * equipo en lugar de reservar media pantalla a un hueco.
         */}
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="t-subtitulo">Quién forma el equipo</h2>
            <span className="text-[13px] text-muted-foreground">
              {ministerio.voluntarios}{' '}
              {ministerio.voluntarios === 1 ? 'persona' : 'personas'}
            </span>
          </div>

          {ministerio.equipo.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14.5px] text-muted-foreground">
              Todavía no hay nadie en este equipo.
            </p>
          ) : (
            ministerio.equipo.map((p) => (
              <div
                key={p.vinculoId}
                className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
              >
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12.5px] font-bold text-muted-foreground">
                  {iniciales(p.nombre)}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <Link
                    href={`/panel/miembros?ficha=${p.miembroId}`}
                    className="truncate text-[15px] font-semibold text-foreground no-underline hover:text-primary"
                  >
                    {p.nombre}
                  </Link>
                  {p.desde && (
                    <span className="text-[12.5px] text-muted-foreground">
                      Desde {formatearMesAno(p.desde)}
                    </span>
                  )}
                </div>

                {/* Quien manda lleva el color del ministerio; el resto, el gris
                    neutro. Nada de mezclar `className` con un spread condicional
                    que lo pisa: se decide arriba y se aplica una vez. */}
                <span
                  className={
                    'whitespace-nowrap rounded-full px-2.5 py-[5px] text-[12px] font-semibold ' +
                    (p.rolEquipo === 'voluntario'
                      ? 'bg-background text-muted-foreground'
                      : '')
                  }
                  style={
                    p.rolEquipo === 'voluntario'
                      ? undefined
                      : { background: color.suave, color: color.claro }
                  }
                >
                  {p.rolEquipo === 'responsable'
                    ? 'Responsable'
                    : p.rolEquipo === 'colider'
                      ? 'Colíder'
                      : (p.rolEnMinisterio ?? 'Equipo')}
                </span>

                {puedeGestionar && (
                  <div className="flex flex-none items-center gap-0.5">
                    {/* Un formulario por acción, no uno con varios botones: con
                        el `bind` de las server actions, dos submits en el mismo
                        form comparten destino y el valor de `rolEquipo` acaba
                        dependiendo de cuál pulsó el navegador. */}
                    {p.rolEquipo === 'voluntario' && (
                      <BotonRol
                        accion={cambiarRolEnEquipo.bind(
                          null,
                          ministerio.id,
                          p.miembroId,
                        )}
                        valor="colider"
                        etiqueta={`Hacer a ${p.nombre} colíder del equipo`}
                        Icono={ShieldPlus}
                      />
                    )}

                    {p.rolEquipo === 'colider' && (
                      <>
                        {puedeNombrarResponsable && (
                          <BotonRol
                            accion={cambiarRolEnEquipo.bind(
                              null,
                              ministerio.id,
                              p.miembroId,
                            )}
                            valor="responsable"
                            etiqueta={`Hacer a ${p.nombre} responsable del equipo`}
                            Icono={Star}
                          />
                        )}
                        <BotonRol
                          accion={cambiarRolEnEquipo.bind(
                            null,
                            ministerio.id,
                            p.miembroId,
                          )}
                          valor="voluntario"
                          etiqueta={`Quitar a ${p.nombre} el liderazgo del equipo`}
                          Icono={ShieldMinus}
                        />
                      </>
                    )}

                    <form
                      action={quitarDelMinisterio.bind(
                        null,
                        ministerio.id,
                        p.miembroId,
                      )}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        title={`Quitar a ${p.nombre} del equipo`}
                        aria-label={`Quitar a ${p.nombre} del equipo`}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <UserMinus strokeWidth={1.7} />
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}

          {puedeGestionar && (
            <div className="p-4">
              <Button
                variant="ghost"
                className="h-[42px] w-full border border-dashed border-border text-muted-foreground hover:bg-background hover:text-foreground"
                render={<Link href="?asignar=1" scroll={false} />}
              >
                <Plus strokeWidth={1.8} />
                Sumar a alguien al equipo
              </Button>
            </div>
          )}
        </section>
      </Contenedor>

      {asignar && puedeGestionar && (
        <DialogoAsignar
          ministerioNombre={ministerio.nombre}
          candidatos={candidatos}
          accion={asignarAqui}
          cerrar={`/panel/ministerios/${ministerio.id}`}
        />
      )}
    </>
  );
}

/**
 * Un botón que envía un `rolEquipo` concreto.
 *
 * El valor viaja en un campo oculto y no en el `value` del botón: un `<button
 * name value>` solo llega al servidor si fue ESE el que se pulsó, y con Enter
 * desde el teclado el navegador no siempre manda cuál era.
 */
function BotonRol({
  accion,
  valor,
  etiqueta,
  Icono,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  valor: 'responsable' | 'colider' | 'voluntario';
  etiqueta: string;
  Icono: typeof Star;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="rolEquipo" value={valor} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        title={etiqueta}
        aria-label={etiqueta}
        className="text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Icono strokeWidth={1.7} />
      </Button>
    </form>
  );
}

function formatearMesAno(fecha: string): string {
  return new Date(`${fecha}T00:00`).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
}
