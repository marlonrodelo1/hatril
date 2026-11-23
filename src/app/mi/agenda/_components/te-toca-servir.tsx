'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

import type { RespuestaTurno } from '@/lib/db/schema/turnos';
import { ETIQUETA_RESPUESTA } from '@/lib/turnos/respuestas';
import { Button } from '@/components/ui/button';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Insignia } from '@/components/ui/insignia';
import { responderTurno } from '../actions';

/**
 * «Te toca servir», lo primero de la agenda.
 *
 * Los turnos salen también en el calendario, pero ahí son una línea entre
 * cultos y eventos; lo que aquí importa es que la persona conteste, y eso pide
 * los botones a la vista, no una fila más que hay que abrir.
 *
 * UNA TARJETA CON LA RAYA, Y NO UNA POR TURNO
 * -------------------------------------------
 * La raya naranja de la izquierda dice «esto es tuyo» (zona 2 del rediseño,
 * 17-nov). Con tres turnos en tres tarjetas serían tres rayas y tres «Te toca
 * servir»; en una sola, el rótulo va una vez y los turnos se separan con una
 * línea, como las filas de cualquier lista.
 *
 * ES DE CLIENTE POR UNA SOLA COSA
 * -------------------------------
 * Contestar va por la server action de siempre, en un `<form>` que funciona sin
 * JavaScript. Lo único que vive aquí es el «Cambiar»: volver a enseñar los
 * botones sin escribir nada en la base, que es lo que no se puede hacer con un
 * enlace.
 */
export type TurnoQueTeToca = {
  id: string;
  /** «Domingo 22», ya compuesto en el servidor, que sabe qué día es hoy allí. */
  cuando: string;
  hora: string | null;
  titulo: string;
  ministerio: string;
  puestos: string[];
  respuesta: RespuestaTurno;
};

export function TeTocaServir({ turnos }: { turnos: TurnoQueTeToca[] }) {
  return (
    <section
      aria-labelledby="te-toca-servir"
      className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
    >
      {/* La raya: dentro del `overflow-hidden`, así sigue la curva de la
          esquina en vez de asomar por fuera. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />

      <h2 id="te-toca-servir" className="t-micro px-4 pt-3.5">
        Te toca servir
      </h2>

      <ul className="flex flex-col">
        {turnos.map((t, i) => (
          <li key={t.id} className="border-b border-border last:border-b-0">
            <Turno turno={t} primero={i === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Turno({
  turno: t,
  primero,
}: {
  turno: TurnoQueTeToca;
  /** El primero va pegado al rótulo; los demás, separados por su línea. */
  primero: boolean;
}) {
  const href = `/mi/agenda/turno/${t.id}`;

  /*
   * «CAMBIAR» SE APAGA SOLO CUANDO LA RESPUESTA CAMBIA
   *
   * Al contestar, la action redirige a la agenda y la respuesta llega nueva por
   * las props. Si el componente sigue montado, `cambiando` seguiría en `true` y
   * los botones no se irían: por eso se compara con la respuesta que había al
   * pintar la última vez y se apaga en cuanto es otra (el patrón de React para
   * ajustar estado a una prop, sin efecto ni parpadeo).
   *
   * Que la respuesta CAMBIE siempre es lo que hace que funcione: con «Cambiar»
   * pulsado solo se ofrece la contraria, igual que en la ficha del turno. Quien
   * confirmó no ve otro «Ahí estaré»; ve «Al final no puedo» y «Cancelar».
   */
  const [cambiando, setCambiando] = useState(false);
  const [vista, setVista] = useState(t.respuesta);
  if (vista !== t.respuesta) {
    setVista(t.respuesta);
    setCambiando(false);
  }

  const contestado = t.respuesta !== 'pendiente';
  const conBotones = !contestado || (cambiando && vista === t.respuesta);

  /*
   * LA CAPA QUE SE VA NO CAMBIA DE CARA MIENTRAS SE VA
   *
   * Los botones dependen de la respuesta («Ahí estaré» si falta, «Al final no
   * puedo» si confirmó). Pintados con la respuesta nueva, al pulsar «Ahí
   * estaré» se verían cambiar a «Al final no puedo» durante el fundido de
   * salida: un parpadeo de un botón que nadie ha pedido. Así que la capa de
   * botones recuerda para qué respuesta se pintó y solo se actualiza mientras
   * se ve.
   */
  const [base, setBase] = useState(t.respuesta);
  if (conBotones && base !== t.respuesta) setBase(t.respuesta);
  const botonesPara = conBotones ? t.respuesta : base;

  /*
   * EL FOCO SIGUE AL CAMBIO
   *
   * Las dos capas se cruzan y la que se va queda `inert`: si el foco estaba en
   * «Cambiar», se quedaría en un botón que ya no existe para el teclado. Se
   * lleva al primer botón que aparece, y «Cancelar» lo devuelve a «Cambiar».
   * Solo tras un toque: al cargar la página no se mueve nada.
   */
  const primerBoton = useRef<HTMLButtonElement>(null);
  const botonCambiar = useRef<HTMLButtonElement>(null);
  const tocado = useRef(false);
  useEffect(() => {
    if (!tocado.current) return;
    (cambiando ? primerBoton : botonCambiar).current?.focus();
  }, [cambiando]);

  const responder = responderTurno.bind(null, t.id);
  const estado = ETIQUETA_RESPUESTA[t.respuesta];

  const capa =
    'col-start-1 row-start-1 flex flex-wrap items-center gap-2 transition-[opacity,translate] duration-240 ease-hatril motion-reduce:transition-none';

  return (
    <div className={clsx('flex flex-col gap-3 px-4 pb-4', primero ? 'pt-2' : 'pt-3.5')}>
      <Link
        href={href}
        className="group flex items-center gap-3 text-foreground no-underline hover:text-foreground hover:no-underline"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-bold text-pretty">
            {[t.cuando, t.hora, t.titulo].filter(Boolean).join(' · ')}
          </span>
          <span className="text-label text-muted-foreground">
            {t.ministerio} · {t.puestos.join(', ')}
          </span>
        </span>
        {/* A la ficha del turno, que es donde está con quién sirves y qué se
            toca. Aquí no: pedir el equipo de cada turno sería una consulta más
            por turno en la pantalla que más se abre. */}
        <ChevronRight
          aria-hidden
          className="size-4 flex-none text-muted-foreground transition-transform duration-240 ease-hatril group-hover:translate-x-[3px] motion-reduce:transition-none"
          strokeWidth={1.8}
        />
      </Link>

      {/* Las dos capas en la misma celda, cruzándose: los botones suben y se
          van, la insignia sube y llega. Nada empuja lo de debajo al contestar,
          porque la celda mide siempre lo que la más alta. */}
      <div className="grid">
        <div
          inert={!conBotones}
          className={clsx(capa, !conBotones && '-translate-y-1.5 opacity-0')}
        >
          {botonesPara === 'pendiente' ? (
            <>
              <form action={responder}>
                <input type="hidden" name="respuesta" value="confirmado" />
                <input type="hidden" name="desde" value="agenda" />
                {/* Carbón y no naranja: puede haber tres turnos, y el naranja
                    es uno por pantalla. «Ahí estaré» es carbón en todas partes
                    donde se contesta desde una lista. */}
                <BotonEnviar variant="secondary" size="sm" pendiente="Apuntando…">
                  <Check strokeWidth={1.8} />
                  Ahí estaré
                </BotonEnviar>
              </form>
              <form action={responder}>
                <input type="hidden" name="respuesta" value="no_puede" />
                <input type="hidden" name="desde" value="agenda" />
                <BotonEnviar variant="outline" size="sm" pendiente="Apuntando…">
                  No puedo
                </BotonEnviar>
              </form>
            </>
          ) : (
            <>
              <form action={responder}>
                <input
                  type="hidden"
                  name="respuesta"
                  value={botonesPara === 'confirmado' ? 'no_puede' : 'confirmado'}
                />
                <input type="hidden" name="desde" value="agenda" />
                {botonesPara === 'confirmado' ? (
                  <BotonEnviar
                    ref={primerBoton}
                    variant="outline"
                    size="sm"
                    pendiente="Apuntando…"
                  >
                    Al final no puedo
                  </BotonEnviar>
                ) : (
                  <BotonEnviar
                    ref={primerBoton}
                    variant="secondary"
                    size="sm"
                    pendiente="Apuntando…"
                  >
                    <Check strokeWidth={1.8} />
                    Al final sí puedo
                  </BotonEnviar>
                )}
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  tocado.current = true;
                  setCambiando(false);
                }}
              >
                Cancelar
              </Button>
            </>
          )}
        </div>

        <div
          inert={conBotones}
          className={clsx(capa, conBotones && 'translate-y-1.5 opacity-0')}
        >
          {contestado && (
            <>
              <Insignia tono={t.respuesta === 'confirmado' ? 'exito' : 'peligro'} punto>
                {estado.miembro}
              </Insignia>
              <Button
                ref={botonCambiar}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  tocado.current = true;
                  setCambiando(true);
                }}
              >
                Cambiar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
