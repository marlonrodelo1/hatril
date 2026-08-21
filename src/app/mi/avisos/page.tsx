import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Bell, Check } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { listarNotificaciones } from '@/lib/notificaciones/consultas';
import { textoNotificacion } from '@/lib/notificaciones/textos';
import { haceCuanto } from '@/lib/fecha/relativo';
import { Button } from '@/components/ui/button';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { abrirAviso, marcarTodoLeido } from './actions';

export const metadata: Metadata = { title: 'Avisos' };

/**
 * Los avisos de una persona.
 *
 * SOLO PIDE SESIÓN
 * ----------------
 * Ni `requireIglesia` ni permisos. Es la única pantalla del producto que tiene
 * que funcionar para alguien que NO pertenece a ninguna congregación: a quien le
 * rechazan la solicitud se le borra la membresía en el mismo movimiento, y su
 * aviso —el que le cuenta por qué— se quedaría fuera de su alcance con cualquier
 * guard de iglesia.
 *
 * `dynamic` porque cada persona ve una cosa distinta y cambia a cada minuto.
 */
export const dynamic = 'force-dynamic';

export default async function AvisosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/acceso?next=/mi/avisos');

  const avisos = await listarNotificaciones(user.id);
  const sinLeer = avisos.filter((a) => !a.leida).length;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/*
       * Sin campana, y no por ahorrar: esta pantalla ES la bandeja. Una campana
       * aquí abriría un desplegable con los mismos avisos que hay debajo y un
       * segundo «Marcar todo» al lado del que ya está en la cabecera.
       *
       * El menú de cuenta sí, y es la razón de que exista `soloSalir`: aquí
       * puede haber alguien SIN iglesia. La cabecera lo resuelve sola.
       */}
      <CabeceraMiembro user={user} titulo="Avisos" volver="/mi/comunidad" campana={false}>
        {sinLeer > 0 && (
          <form action={marcarTodoLeido}>
            <Button type="submit" variant="ghost" size="sm">
              <Check strokeWidth={1.8} />
              Marcar todo
            </Button>
          </form>
        )}
      </CabeceraMiembro>

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-2 px-4 py-5 sm:px-5">
        {avisos.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="size-5" strokeWidth={1.7} />
            </span>
            <h1 className="text-[17px] font-bold tracking-[-0.02em]">
              No tienes avisos
            </h1>
            <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Aquí te contamos cuando alguien comenta lo que publicas, cuando te
              toca escribir el devocional o cuando se resuelve una solicitud.
            </p>
          </div>
        ) : (
          avisos.map((a) => {
            const { titulo, detalle } = textoNotificacion(a.tipo, a.datos);

            return (
              <form key={a.id} action={abrirAviso.bind(null, a.id)}>
                {/*
                 * Cada aviso es un botón de formulario y no un enlace: al pulsarlo
                 * hay que marcarlo leído ANTES de llevar a ninguna parte, y eso es
                 * una escritura. Un `<a>` con un `fetch` al lado se queda a medias
                 * en cuanto la navegación gana la carrera.
                 */}
                <button
                  type="submit"
                  className={
                    'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-surface ' +
                    (a.leida
                      ? 'border-border bg-surface'
                      : 'border-support bg-surface-alt')
                  }
                >
                  {/* El punto de sin leer, que además lleva texto para quien no
                      distingue el color. */}
                  <span className="mt-1.5 flex size-2 flex-none items-center justify-center">
                    {!a.leida && (
                      <>
                        <span className="size-2 rounded-full bg-support" />
                        <span className="sr-only">Sin leer</span>
                      </>
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className={
                        'text-pretty text-[15px] leading-snug ' +
                        (a.leida ? 'font-semibold' : 'font-bold')
                      }
                    >
                      {titulo}
                    </span>

                    {detalle && (
                      <span className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
                        {detalle}
                      </span>
                    )}

                    <span className="text-[12.5px] text-muted-foreground">
                      {haceCuanto(a.createdAt)}
                    </span>
                  </span>
                </button>
              </form>
            );
          })
        )}
      </main>
    </div>
  );
}
