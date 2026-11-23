import Link from 'next/link';
import { MapPin, Pencil, Save, Trash2, UserPlus, Users, UserX } from 'lucide-react';
import { clsx } from 'clsx';
import { cuandoCorto } from '@/lib/ministerios/en-la-app/fechas';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Insignia } from '@/components/ui/insignia';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/agenda/constantes';
import { MarcoEquipo, ZonaDeBorrar } from '../../../_components/marco';
import { borrarReunionDeMinisterio, guardarListaDelEquipo } from '../actions';
import { PasarLista } from './_components/pasar-lista';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export type DatosReunionEquipo = Awaited<ReturnType<typeof cargar>>;

export function VistaReunionEquipo({ id, reunionId, error, guardado, ctx, ministerio, reunion, equipo, primeraVez, hoy, base }: DatosReunionEquipo) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={reunion.titulo}
      subtitulo={ministerio.nombre}
      volver={base}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5">
        <h2 className="t-subtitulo">{cuandoCorto(reunion.fecha, reunion.hora, hoy)}</h2>
        {reunion.lugar && (
          <span className="inline-flex items-center gap-1.5 text-label text-muted-foreground">
            <MapPin className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
            {reunion.lugar}
          </span>
        )}
        {reunion.notas && (
          <p className="text-pretty text-body leading-relaxed text-muted-foreground">
            {reunion.notas}
          </p>
        )}
        {/*
         * Lo GUARDADO, en una insignia: el recuento de abajo es lo que se está
         * marcando ahora, y la primera vez sale lleno —todos marcados de
         * entrada—, así que sin esto «Han venido 9 de 9» se leería como una
         * lista ya pasada.
         */}
        <Insignia
          tono={primeraVez ? 'aviso' : 'exito'}
          punto
          className="mt-1 self-start"
        >
          {primeraVez
            ? 'Todavía sin lista'
            : `Guardada: vinieron ${reunion.presentes} de ${reunion.marcados}`}
        </Insignia>
        <Link
          href={`${base}/${reunionId}/editar`}
          className="mt-1 inline-flex items-center gap-1.5 self-start text-label font-semibold text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <Pencil className="size-3.5" strokeWidth={1.8} aria-hidden />
          Cambiar el día, el lugar o las notas
        </Link>
      </section>

      <form
        action={guardarListaDelEquipo.bind(null, id, reunionId)}
        className="flex flex-col gap-4"
      >
        {equipo.length === 0 ? (
          // Lista vacía no es equipo vacío: también sale así si todos
          // negaron el permiso de asistencia. El texto no dice cuál, igual
          // que la action.
          ministerio.equipo.length === 0 ? (
            <EstadoVacio
              Icono={Users}
              titulo="El equipo está vacío"
              className="rounded-xl border border-border bg-surface"
              accion={
                <BotonEnlace variant="outline" href={`/panel/ministerios/${id}`}>
                  <UserPlus strokeWidth={1.8} />
                  Sumar gente en el panel
                </BotonEnlace>
              }
            >
              Este ministerio todavía no tiene a nadie. Suma a tu gente desde
              el panel y vuelve aquí para pasar lista.
            </EstadoVacio>
          ) : (
            <EstadoVacio
              Icono={UserX}
              titulo="Nadie a quien pasar lista"
              className="rounded-xl border border-border bg-surface"
            >
              No hay nadie en este equipo a quien se le pueda pasar lista.
            </EstadoVacio>
          )
        ) : (
          <>
            {/* Los mismos `presentes` que antes, con el mismo valor de
                entrada (`presente ?? primeraVez`): la action no se entera de
                que la pantalla ha cambiado. */}
            <PasarLista
              personas={equipo.map((p) => ({
                miembroId: p.miembroId,
                nombre: p.nombre,
                marcado: p.presente ?? primeraVez,
              }))}
            />

            {/*
             * FIJO ABAJO, ENCIMA DE LA BARRA DE `/mi`
             * ---------------------------------------
             * Al alcance del pulgar con la lista a medias, sin bajar a
             * buscarlo. Sigue DENTRO del `<form>`: `BotonEnviar` lee el
             * estado de este formulario, y sin JavaScript envía igual.
             *
             * La barra publica lo que ocupa en `--alto-barra-mi`, con la
             * zona segura del iPhone dentro. La radio, cuando la iglesia la
             * tiene, va pegada encima de la barra y no publica su alto: se la
             * reconoce por su `<audio>`, que en esta pantalla no hay otro, y
             * se suben sus 54 px (en escritorio flota 6 px más arriba). Si un
             * día la radio publica su alto, esto pasa a usar esa variable.
             *
             * Por fuera `pointer-events-none`: la franja de los lados no debe
             * tragarse los toques de la fila que pasa por debajo.
             */}
            <div
              className={clsx(
                'pointer-events-none fixed inset-x-0 z-20 px-4 sm:px-5',
                'bottom-[calc(var(--alto-barra-mi,72px)+8px)]',
                '[html:has(audio)_&]:bottom-[calc(var(--alto-barra-mi,72px)+62px)]',
                'md:[html:has(audio)_&]:bottom-[calc(var(--alto-barra-mi,72px)+68px)]',
              )}
            >
              <div className="pointer-events-auto mx-auto w-full max-w-[580px]">
                <BotonEnviar size="lg" className="w-full">
                  <Save strokeWidth={1.8} />
                  Guardar la lista
                </BotonEnviar>
              </div>
            </div>
          </>
        )}
      </form>

      <ZonaDeBorrar
        titulo="Borrar de la agenda"
        boton={
          <form action={borrarReunionDeMinisterio.bind(null, id, reunionId)}>
            <BotonEnviar variant="destructive" pendiente="Borrando…">
              <Trash2 strokeWidth={1.8} />
              Borrar
            </BotonEnviar>
          </form>
        }
      >
        Se va con su lista. No hay forma de recuperarla.
      </ZonaDeBorrar>

      {/* El hueco del botón fijo, que flota sobre lo último de la pantalla:
          sin él, al llegar abajo tapaba la zona de borrar. El de la barra y
          la radio ya lo pone `mi/layout.tsx`. */}
      {equipo.length > 0 && <div aria-hidden className="h-12" />}
    </MarcoEquipo>
  );
}
