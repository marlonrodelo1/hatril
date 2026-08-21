import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { evento, inscritos } from '@/lib/eventos/consultas';
import { formatearInstante } from '@/lib/fecha/zona';
import { formatearDinero } from '@/lib/format/dinero';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import type { Moneda } from '@/lib/db/schema';
import { ahoraMs } from '@/lib/fecha/ahora';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import {
  borrarEvento,
  borrarInscritos,
  cambiarInscripciones,
  cambiarPublicado,
  borrarInscripcion,
  cancelarInscripcion,
  marcarPagada,
} from '../actions';
import { CONFIRMACIONES } from '../constantes';

export const metadata: Metadata = {
  title: 'Evento',
  // La lista de inscritos lleva nombres y correos de personas que no son de la
  // congregación. Que no la indexe nadie.
  robots: { index: false, follow: false },
};

export default async function EventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  const { id } = await params;
  const { error, guardado } = await searchParams;

  const e = await evento(ctx, id);
  if (!e) notFound();

  const lista = await inscritos(ctx, id);
  const vivas = lista.filter((i) => !i.canceladaAt);
  const moneda = ctx.iglesia.moneda as Moneda;
  const tz = ctx.iglesia.timezone;
  const yaPaso = (e.finEn ?? e.inicioEn).getTime() < ahoraMs();

  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href="/panel/eventos"
          className="mb-1 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ArrowLeft className="size-[15px]" strokeWidth={1.8} />
          Eventos
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          {e.titulo}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
          <span className="first-letter:uppercase">
            {formatearInstante(e.inicioEn, tz, { conAnio: true })}
          </span>
          {e.lugar && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-[15px]" strokeWidth={1.7} />
              {e.lugar}
            </span>
          )}
          {e.precio && (
            <span className="font-semibold text-foreground">
              {formatearDinero(e.precio, moneda)}
            </span>
          )}
        </div>
      </header>

      <div className="flex w-full max-w-[1000px] flex-col gap-8 px-5 pb-16 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {/* ---------- Estado ---------- */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-1">
            <h2 className="t-subtitulo">Quién lo ve</h2>
            <p className="text-[13px] text-muted-foreground">
              Anunciarlo y admitir inscripciones son dos cosas distintas: puedes
              seguir anunciando el retiro cuando ya no queden plazas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={cambiarPublicado.bind(null, id)}>
              {/* Casilla oculta: el botón manda el estado CONTRARIO al actual,
                  así que es un interruptor de un solo clic y no un formulario
                  que haya que rellenar. */}
              {!e.publicado && (
                <input type="hidden" name="publicado" value="on" />
              )}
              <Button type="submit" variant={e.publicado ? 'outline' : 'default'}>
                {e.publicado ? 'Quitar de la web' : 'Publicar en la web'}
              </Button>
            </form>

            <form action={cambiarInscripciones.bind(null, id)}>
              {!e.inscripcionesAbiertas && (
                <input type="hidden" name="abiertas" value="on" />
              )}
              <Button type="submit" variant="outline">
                {e.inscripcionesAbiertas
                  ? 'Cerrar inscripciones'
                  : 'Abrir inscripciones'}
              </Button>
            </form>

            {e.publicado && ctx.iglesia.webPublica && (
              <Button
                variant="ghost"
                render={
                  <a
                    href={`/i/${ctx.iglesia.slug}/eventos/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink strokeWidth={1.8} />
                Ver la página
              </Button>
            )}

            <Button
              variant="ghost"
              render={<Link href={`/panel/eventos/${id}/editar`} />}
            >
              <Pencil strokeWidth={1.8} />
              Editar
            </Button>
          </div>

          {e.publicado && !ctx.iglesia.webPublica && (
            <Aviso>
              El evento está publicado, pero la web de tu iglesia no lo está, así
              que nadie puede verlo. Se activa en Ajustes.
            </Aviso>
          )}
        </section>

        {/* ---------- Inscritos ---------- */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="t-subtitulo">Quién viene</h2>
              <p className="text-[13px] text-muted-foreground">
                {e.cupo
                  ? `${e.ocupadas} ${e.ocupadas === 1 ? 'persona' : 'personas'} de ${e.cupo} ${e.cupo === 1 ? 'plaza' : 'plazas'}.`
                  : `${e.ocupadas} ${e.ocupadas === 1 ? 'persona apuntada' : 'personas apuntadas'}.`}
                {' '}Se cuentan los acompañantes.
              </p>
            </div>

            {lista.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                render={<a href={`/panel/eventos/${id}/exportar`} />}
              >
                <Download strokeWidth={1.8} />
                Descargar CSV
              </Button>
            )}
          </div>

          {lista.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-[14px] text-muted-foreground">
              Todavía no se ha apuntado nadie.
              {!e.inscripcionesAbiertas &&
                ' Las inscripciones están cerradas: ábrelas para que puedan.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((i) => (
                <li
                  key={i.id}
                  className={
                    'flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between ' +
                    (i.canceladaAt ? 'bg-background opacity-60' : 'bg-surface')
                  }
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      {i.nombre}
                      {i.acompanantes > 0 && (
                        <span className="inline-flex items-center gap-1 text-[13px] font-normal text-muted-foreground">
                          <Users className="size-[14px]" strokeWidth={1.7} />+
                          {i.acompanantes}
                        </span>
                      )}
                      {i.canceladaAt && (
                        <span className="text-[12px] font-semibold text-muted-foreground">
                          · se dio de baja
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[13.5px] text-muted-foreground">
                      {i.email}
                      {i.telefono && ` · ${formatearTelefono(i.telefono)}`}
                    </span>
                    {i.nota && (
                      <span className="text-[13px] text-muted-foreground">
                        «{i.nota}»
                      </span>
                    )}
                  </div>

                  <div className="flex flex-none items-center gap-2">
                    {/* Borrar los datos de UNA persona, y sin la condicion de
                        que el evento haya pasado: el derecho de supresion no
                        espera a que termine el retiro. Aparece tambien en las
                        canceladas, que es donde acaba quien se dio de baja y
                        despues pide que le borren. */}
                    <form action={borrarInscripcion.bind(null, i.id, id)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        title="Borra su nombre, correo, telefono y nota. No se puede deshacer."
                      >
                        Borrar sus datos
                      </Button>
                    </form>
                  </div>

                  {!i.canceladaAt && (
                    <div className="flex flex-none items-center gap-2">
                      {e.precio && (
                        <form action={marcarPagada.bind(null, i.id, id)}>
                          {!i.pagado && (
                            <input type="hidden" name="pagado" value="on" />
                          )}
                          <Button
                            type="submit"
                            size="sm"
                            variant={i.pagado ? 'outline' : 'default'}
                          >
                            {i.pagado ? 'Pagada' : 'Marcar pagada'}
                          </Button>
                        </form>
                      )}
                      {/* En su propio formulario: con el de marcar pagada al
                          lado, un Enter de más daría de baja a alguien. */}
                      <form action={cancelarInscripcion.bind(null, i.id, id)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                        >
                          Dar de baja
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {e.precio && vivas.length > 0 && (
            <p className="t-label text-muted-foreground">
              «Pagada» es una anotación tuya. Hatril no cobra ni comprueba nada:
              el dinero va directo a tu medio de pago.
            </p>
          )}
        </section>

        {/* ---------- Borrar ---------- */}
        <section className="flex flex-col gap-4 rounded-xl border border-danger-border bg-[#F7ECEB] p-5">
          <div className="flex flex-col gap-1">
            <h2 className="t-subtitulo">Borrar</h2>
            <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
              Quien se apunta a un evento sin ser de la iglesia confía sus datos
              para eso y nada más. Lo que tienes pactado en los términos es no
              guardar la lista más de{' '}
              <strong className="font-semibold">90 días</strong> desde que el
              evento termina. No hay ninguna tarea automática que lo haga por ti:
              este botón es la forma de cumplirlo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {lista.length > 0 && yaPaso && (
              <form action={borrarInscritos.bind(null, id)}>
                <Button type="submit" variant="destructive" size="sm">
                  <Trash2 strokeWidth={1.7} />
                  Borrar la lista de inscritos
                </Button>
              </form>
            )}
            <form action={borrarEvento.bind(null, id)}>
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 strokeWidth={1.7} />
                Borrar el evento entero
              </Button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
