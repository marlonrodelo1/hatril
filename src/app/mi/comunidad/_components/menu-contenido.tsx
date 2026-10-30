'use client';

import { useState } from 'react';
import { Ban, Flag, MoreHorizontal, Trash2 } from 'lucide-react';

import { Hoja } from '@/components/hoja';
import { AvatarPersona } from '@/components/avatar-persona';
import { Button } from '@/components/ui/button';
import { MOTIVOS_DENUNCIA } from '@/lib/comunidad/denuncias';
import {
  bloquear,
  borrarComentario,
  borrarPublicacion,
  denunciar,
} from '../actions';

type Vista = 'menu' | 'borrar' | 'denunciar' | 'bloquear';

/**
 * El «…» de una publicación o de un comentario.
 *
 * Una sola hoja con cuatro vistas, y no cuatro hojas que se abren unas encima
 * de otras: en un móvil, una capa sobre otra capa deja de saberse cuál se
 * cierra con la X. Se entra por el menú y cada opción cambia lo que se ve
 * dentro; la X o tocar fuera cierran todo.
 *
 * QUÉ SALE, SEGÚN QUIÉN MIRA
 * --------------------------
 *   - Lo tuyo: borrarlo.
 *   - Lo de otro, si moderas: borrarlo como moderador y bloquear. Denunciar no,
 *     porque la denuncia te llegaría a ti.
 *   - Lo de otro, si no moderas: denunciar y bloquear.
 *
 * Los botones de dentro son formularios con su server action, como el resto
 * del muro. Lo único de cliente es qué vista está abierta.
 */
export function MenuContenido({
  tipo,
  id,
  autorId,
  autorNombre,
  autorFoto,
  esMio,
  puedeModerar,
  queSeBorra,
  pequeno = false,
}: {
  tipo: 'publicacion' | 'comentario';
  id: string;
  autorId: string;
  autorNombre: string;
  autorFoto: string | null;
  esMio: boolean;
  puedeModerar: boolean;
  /** «Se borran también sus 2 fotos y los 5 comentarios.» Solo publicaciones. */
  queSeBorra?: string;
  /** En un comentario, el botón va más pequeño. */
  pequeno?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [vista, setVista] = useState<Vista>('menu');

  const esPub = tipo === 'publicacion';
  const nombreCorto = autorNombre.split(' ')[0] ?? autorNombre;

  function cambiar(v: boolean) {
    setAbierta(v);
    // Al cerrar, la próxima vez se vuelve a empezar por el menú.
    if (!v) setVista('menu');
  }

  const titulos: Record<Vista, string> = {
    menu: esPub ? 'Publicación' : 'Comentario',
    borrar: esMio
      ? esPub
        ? '¿Borrar tu publicación?'
        : '¿Borrar tu comentario?'
      : esPub
        ? '¿Quitar esta publicación?'
        : '¿Quitar este comentario?',
    denunciar: esPub
      ? '¿Qué pasa con esta publicación?'
      : '¿Qué pasa con este comentario?',
    bloquear: `¿Bloquear a ${autorNombre}?`,
  };

  const accionBorrar = esPub
    ? borrarPublicacion.bind(null, id)
    : borrarComentario.bind(null, id);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={esPub ? 'Opciones de la publicación' : 'Opciones del comentario'}
        className={
          'flex flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 ' +
          (pequeno ? 'size-8' : 'size-[34px]')
        }
      >
        <MoreHorizontal
          className={pequeno ? 'size-[16px]' : 'size-[19px]'}
          strokeWidth={1.8}
        />
      </button>

      <Hoja
        abierta={abierta}
        onCambio={cambiar}
        titulo={titulos[vista]}
        descripcion={
          vista === 'menu' ? 'Lo que puedes hacer con esto.' : undefined
        }
      >
        {vista === 'menu' && (
          <ul className="-mx-1 flex flex-col">
            {esMio && (
              <Opcion
                icono={<Trash2 strokeWidth={1.8} />}
                peligro
                titulo={esPub ? 'Borrar publicación' : 'Borrar comentario'}
                detalle={
                  esPub
                    ? 'Se borran también sus fotos y comentarios.'
                    : 'Se borran también sus respuestas.'
                }
                onClick={() => setVista('borrar')}
              />
            )}

            {!esMio && puedeModerar && (
              <Opcion
                icono={<Trash2 strokeWidth={1.8} />}
                peligro
                titulo="Quitar como moderador"
                detalle={`Desaparece para todos. Le avisaremos a ${nombreCorto}.`}
                onClick={() => setVista('borrar')}
              />
            )}

            {!esMio && !puedeModerar && (
              <Opcion
                icono={<Flag strokeWidth={1.8} />}
                titulo="Denunciar"
                detalle="Se lo enviamos al pastor para que lo revise."
                onClick={() => setVista('denunciar')}
              />
            )}

            {!esMio && (
              <Opcion
                icono={<Ban strokeWidth={1.8} />}
                titulo={`Bloquear a ${autorNombre}`}
                detalle="Dejarás de ver lo que publica. No se entera."
                onClick={() => setVista('bloquear')}
              />
            )}
          </ul>
        )}

        {vista === 'borrar' && (
          <form action={accionBorrar} className="flex flex-col gap-4 pb-1">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {esPub && queSeBorra ? `${queSeBorra} ` : ''}
              {!esPub && 'Se borran también sus respuestas. '}
              No se puede deshacer.
              {!esMio && ` Le avisaremos a ${nombreCorto}, sin decirle quién ha sido.`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setVista('menu')}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" size="lg">
                <Trash2 strokeWidth={1.8} />
                {esMio ? 'Borrar' : 'Quitar'}
              </Button>
            </div>
          </form>
        )}

        {vista === 'denunciar' && (
          <form action={denunciar} className="flex flex-col gap-4 pb-1">
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="id" value={id} />

            <p className="text-[14.5px] leading-relaxed text-muted-foreground">
              Solo lo verán el pastor y quien él haya puesto a cuidar la
              comunidad. {nombreCorto} no sabrá quién ha sido.
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[13.5px] font-bold">Motivo</legend>
              {MOTIVOS_DENUNCIA.map((m) => (
                <label
                  key={m.valor}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[15px] has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"
                >
                  <input
                    type="radio"
                    name="motivo"
                    value={m.valor}
                    required
                    className="size-[18px] flex-none accent-primary"
                  />
                  {m.texto}
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-bold">
                Cuéntale algo más al pastor{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <textarea
                name="detalle"
                rows={3}
                maxLength={1000}
                className="min-h-[88px] w-full resize-none rounded-lg border border-input bg-surface-alt px-3.5 py-2.5 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
              />
            </label>

            <Button type="submit" size="lg" className="w-full">
              Enviar al pastor
            </Button>
          </form>
        )}

        {vista === 'bloquear' && (
          <form action={bloquear.bind(null, autorId)} className="flex flex-col gap-4 pb-1">
            <div className="flex items-center gap-3">
              <AvatarPersona nombre={autorNombre} fotoUrl={autorFoto} tamano="lg" />
              <p className="text-[15px] font-bold">{autorNombre}</p>
            </div>

            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed">
              <li>Dejarás de ver lo que publica y comenta en la comunidad.</li>
              <li>{nombreCorto} no se entera: no le avisamos.</li>
              <li>
                Fuera del muro todo sigue igual: si coincides con {nombreCorto} en
                un equipo, seguirá saliendo en tus turnos.
              </li>
              <li>Puedes desbloquear cuando quieras desde Mi cuenta.</li>
            </ul>

            {!puedeModerar && (
              <p className="rounded-lg bg-surface-alt px-3.5 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
                Si te ha hecho daño o te preocupa algo, mejor{' '}
                <button
                  type="button"
                  onClick={() => setVista('denunciar')}
                  className="cursor-pointer font-semibold text-foreground underline underline-offset-2"
                >
                  denúncialo al pastor
                </button>
                : bloquear solo lo quita de tu vista.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button type="submit" variant="secondary" size="lg" className="w-full">
                <Ban strokeWidth={1.8} />
                Bloquear a {nombreCorto}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setVista('menu')}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Hoja>
    </>
  );
}

function Opcion({
  icono,
  titulo,
  detalle,
  peligro = false,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  peligro?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 [&_svg]:mt-0.5 [&_svg]:size-[19px] [&_svg]:flex-none"
      >
        <span className={peligro ? 'text-danger' : 'text-foreground'}>{icono}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={
              'text-[15px] font-bold ' + (peligro ? 'text-danger' : 'text-foreground')
            }
          >
            {titulo}
          </span>
          <span className="text-[13.5px] leading-snug text-muted-foreground">
            {detalle}
          </span>
        </span>
      </button>
    </li>
  );
}
