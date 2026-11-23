import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Clock, Search } from 'lucide-react';

import type { RespuestaYo } from '@/lib/app-api/yo';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { pedir, ErrorApi } from '@movil/lib/api';
import { CabeceraApp } from '@movil/componentes/cabecera-app';

/**
 * Donde está quien tiene cuenta y todavía no iglesia. Es la pantalla de
 * `src/app/mi/page.tsx` sin el desvío, que en la app hace el arranque.
 *
 * Tres situaciones, tres mensajes: solicitud en revisión, rechazada, o
 * ninguna. A quien le rechazan se le dice, con el motivo si lo hay: no se le
 * deja esperando para siempre.
 */
export function SalaDeEspera({ yo }: { yo: RespuestaYo }) {
  const solicitud = yo.solicitud;
  const cliente = useQueryClient();
  const [cancelada, setCancelada] = useState(false);
  const enviada = useSearchParams()[0].get('enviada') === '1';

  const cancelar = useMutation({
    mutationFn: () => pedir<null>('/solicitud', { method: 'DELETE' }),
    onSuccess: async () => {
      setCancelada(true);
      await cliente.invalidateQueries({ queryKey: ['yo'] });
    },
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraApp titulo="Hatril" marca />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-6 px-4 py-12">
        {enviada && solicitud?.estado === 'pendiente' && (
          <Aviso tipo="ok">Solicitud enviada. Te avisamos en cuanto la revisen.</Aviso>
        )}

        {cancelada && !solicitud && (
          <Aviso tipo="ok">Solicitud cancelada. Puedes pedir entrar en otra iglesia.</Aviso>
        )}
        {cancelar.error && (
          <Aviso>{cancelar.error instanceof ErrorApi ? cancelar.error.message : 'No se ha podido cancelar.'}</Aviso>
        )}

        {solicitud?.estado === 'pendiente' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-balance text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
                Tu solicitud está con el pastor de {solicitud.iglesia.nombre}
              </h1>
              <p className="text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
                Te avisaremos en cuanto te acepte. No tienes que hacer nada más.
              </p>
            </div>

            <ol className="flex flex-col rounded-xl border border-border bg-surface px-4 py-2">
              <Paso hecho titulo="Solicitud enviada" detalle={formatearFecha(solicitud.enviadaEl)} />
              <Paso actual titulo="El pastor la revisa" detalle="Ahora" />
              <Paso titulo="Entras en la comunidad" detalle="Cuando te acepte" ultimo />
            </ol>

            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Si tienes prisa, lo más rápido es decírselo en persona el domingo.
            </p>

            <Link
              to={`/iglesia/${solicitud.iglesia.slug}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-foreground no-underline hover:bg-surface-active"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Clock className="size-5" strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">
                  Mientras esperas, conoce {solicitud.iglesia.nombre}
                </span>
                <span className="text-[13px] text-muted-foreground">Horarios y dónde está</span>
              </span>
              <ChevronRight className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
            </Link>

            <Button
              type="button"
              variant="ghost"
              className="self-center text-muted-foreground hover:text-foreground"
              disabled={cancelar.isPending}
              onClick={() => cancelar.mutate()}
            >
              {cancelar.isPending ? 'Cancelando…' : 'Cancelar solicitud'}
            </Button>
          </div>
        )}

        {solicitud?.estado === 'rechazada' && (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-col gap-2">
              <h1 className="t-titulo">Tu solicitud no salió adelante</h1>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                {solicitud.iglesia.nombre} no aprobó tu solicitud.
                {solicitud.motivoRechazo
                  ? ` Te dejaron este mensaje: «${solicitud.motivoRechazo}»`
                  : ' No dejaron ningún motivo.'}
              </p>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Suele ser un malentendido más que otra cosa. Habla con ellos y, si quieres, vuelve a
                solicitarlo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <BotonEnlace href={`/solicitar/${solicitud.iglesia.slug}`}>Volver a solicitarlo</BotonEnlace>
              <BotonEnlace href="/buscar" variant="outline">
                Buscar otra iglesia
              </BotonEnlace>
            </div>
          </div>
        )}

        {!solicitud && (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Search className="size-5" strokeWidth={1.7} />
            </span>

            <div className="flex flex-col gap-2">
              <h1 className="t-titulo">Todavía no estás en ninguna iglesia</h1>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                Busca tu congregación y pide unirte. Cuando alguien del equipo lo apruebe, verás aquí
                lo que publican.
              </p>
            </div>

            <BotonEnlace href="/empezar">Buscar mi iglesia</BotonEnlace>
          </div>
        )}

        {/* Apple y Google piden poder borrar toda cuenta que se pueda crear,
            y aquí hay cuentas que nunca llegan a entrar en ninguna iglesia. */}
        <Link
          to="/mi/cuenta/borrar"
          className="self-center text-[13.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Borrar mi cuenta
        </Link>
      </main>
    </div>
  );
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

function Paso({
  titulo,
  detalle,
  hecho = false,
  actual = false,
  ultimo = false,
}: {
  titulo: string;
  detalle: string;
  hecho?: boolean;
  actual?: boolean;
  ultimo?: boolean;
}) {
  return (
    <li className="flex gap-3 py-2">
      <span className="flex flex-col items-center">
        <span
          className={
            'flex size-6 flex-none items-center justify-center rounded-full border ' +
            (hecho
              ? 'border-support bg-support text-white'
              : actual
                ? 'border-primary bg-accent'
                : 'border-border bg-surface')
          }
        >
          {hecho && <Check className="size-3.5" strokeWidth={2.4} />}
          {actual && <span className="size-2 rounded-full bg-primary" />}
        </span>
        {!ultimo && <span className="mt-1 w-px flex-1 bg-border" />}
      </span>
      <span className="flex flex-col pb-1">
        <span className={'text-[15px] ' + (hecho || actual ? 'font-bold' : 'text-muted-foreground')}>
          {titulo}
        </span>
        <span className="text-[13px] text-muted-foreground">{detalle}</span>
      </span>
    </li>
  );
}
