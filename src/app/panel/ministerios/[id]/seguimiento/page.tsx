import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight, Phone } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esAusente, personasPorFaltas } from '@/lib/seguimiento/consultas';
import { RESULTADOS } from '@/lib/seguimiento/catalogos';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { VistasSeguimiento } from './_components/vistas';
import { CONFIRMACIONES } from './constantes';

export const metadata: Metadata = { title: 'Seguimiento' };

export default async function SeguimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const todas = await personasPorFaltas(ctx, id);

  // Quien acaba de llegar no sale aquí aunque falte: está en «Nuevos», donde la
  // pregunta es si vuelve, no por qué se fue. Si saliera en las dos listas, el
  // visitante del domingo pasado encabezaría esta con «nunca se le ha marcado
  // presente», y a los miembros de siempre que dejan de venir —la gente por la
  // que existe esta pantalla— los empujaría hacia abajo.
  const personas = todas.filter((p) => p.nuevo === null);
  const nuevos = todas.length - personas.length;

  // Quien no se ha perdido nada no es trabajo de nadie esta semana. Se cuenta
  // pero no se pinta: una lista de 120 nombres donde 110 están bien es una lista
  // que nadie recorre, y el que necesita una llamada se pierde entre ellos.
  const pendientes = personas.filter(esAusente);
  const alDia = personas.length - pendientes.length;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Quién lleva tiempo sin aparecer, y quién le acompaña"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="seguimiento" />

        <VistasSeguimiento
          base={`/panel/ministerios/${id}/seguimiento`}
          activa="ausentes"
          nuevos={nuevos}
          ausentes={pendientes.length}
        />

        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {todas.length === 0 ? (
          <Vacio>
            <h2 className="t-subtitulo">No hay nadie en el fichero</h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Da de alta a la congregación en Miembros y vuelve aquí.
            </p>
          </Vacio>
        ) : pendientes.length === 0 ? (
          <Vacio>
            <h2 className="t-subtitulo">Nadie se ha perdido ninguna reunión</h2>
            {/* «No ha faltado», y no «vino a la última»: desde que las faltas
                se cuentan a partir de la ficha, quien se dio de alta ayer no
                se ha perdido nada sin haber venido nunca. */}
            <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-muted-foreground">
              {personas.length === 0
                ? 'Todos los que hay en el fichero acaban de llegar: están en Nuevos.'
                : (personas.length === 1
                    ? 'Esa persona no ha faltado a ningún culto con lista desde que está en el fichero.'
                    : `Ninguna de las ${personas.length} personas ha faltado a un culto con lista desde que está en el fichero.`) +
                  ' Si esto te sorprende, puede que falte apuntar algún culto en Reuniones.' +
                  (nuevos > 0 ? ' Quien acaba de llegar está en Nuevos.' : '')}
            </p>
          </Vacio>
        ) : (
          <>
            <p className="text-[14px] text-muted-foreground">
              {pendientes.length}{' '}
              {pendientes.length === 1 ? 'persona' : 'personas'} se han perdido
              alguna reunión.{' '}
              {alDia > 0 &&
                `Las otras ${alDia} no han faltado a ninguna desde que están en el fichero.`}
            </p>

            <ul className="flex flex-col gap-2.5">
              {pendientes.map((p) => (
                <li key={p.miembroId}>
                  <Link
                    href={`/panel/ministerios/${id}/seguimiento/${p.miembroId}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-foreground/20 hover:bg-surface-alt hover:no-underline md:px-5"
                  >
                    <span
                      className={`flex size-10 flex-none items-center justify-center rounded-full text-[12px] font-bold ${ESTADOS[p.estado].avatar}`}
                    >
                      {iniciales(p.nombre)}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15.5px] font-bold tracking-[-0.015em]">
                        {p.nombre}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
                        <span>
                          {p.ultimaAsistencia
                            ? `Vino el ${formatearFechaLarga(p.ultimaAsistencia)}`
                            : 'Nunca se le ha marcado presente'}
                        </span>
                        {p.telefono && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3.5" strokeWidth={1.8} />
                            {p.telefono}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="hidden flex-none flex-col items-end gap-1 sm:flex">
                      {p.acompana ? (
                        <span className="text-[13px] text-muted-foreground">
                          Le acompaña{' '}
                          <strong className="font-semibold text-foreground">
                            {p.acompana.nombre}
                          </strong>
                        </span>
                      ) : (
                        /* Sin color de alarma: que nadie la acompañe todavía es
                           lo normal el primer día, no un fallo. */
                        <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">
                          Sin asignar
                        </span>
                      )}
                      {p.ultimoContacto && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${RESULTADOS[p.ultimoContacto.resultado].badge}`}
                        >
                          {RESULTADOS[p.ultimoContacto.resultado].etiqueta}
                        </span>
                      )}
                    </div>

                    <Faltas n={p.faltasSeguidas} />

                    <ChevronRight
                      className="size-4 flex-none text-disabled-text"
                      strokeWidth={1.9}
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Contenedor>
    </>
  );
}

/**
 * Cuántas reuniones seguidas se ha perdido.
 *
 * Se dice «reuniones» y no «semanas» a propósito, y no es un matiz de redacción:
 * el número cuenta reuniones EN LAS QUE SE PASÓ LISTA. Escribir «3 semanas»
 * sobre una cifra que en realidad son tres cultos apuntados haría que el equipo
 * dedujera fechas que el dato no respalda.
 */
function Faltas({ n }: { n: number }) {
  return (
    <span className="flex flex-none flex-col items-end gap-0.5">
      <span className="text-[22px] font-bold leading-none tracking-[-0.02em]">
        {n}
      </span>
      <span className="t-micro">{n === 1 ? 'reunión' : 'reuniones'}</span>
    </span>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
      {children}
    </div>
  );
}
