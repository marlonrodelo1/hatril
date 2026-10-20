import Link from 'next/link';
import type { Metadata } from 'next';
import { Info } from 'lucide-react';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import { radioDeLaIglesia } from '@/lib/emisora/consultas';
import {
  DIAS_PARRILLA,
  DURACION_MAX,
  DURACION_MIN,
  MAX_LARGO_NOMBRE_EMISORA,
  MAX_LARGO_PROGRAMA,
  MAX_LARGO_TEMA,
  MAX_PROGRAMAS,
  emisoraDeModulos,
} from '@/lib/emisora/config';
import { Aviso } from '@/components/aviso';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { BotonGuardar } from './_components/boton-guardar';
import { CampoSenal } from './_components/campo-senal';
import { guardarEmisora } from './actions';
import { CONFIRMACIONES, FILAS_DE_MAS } from './constantes';

export const metadata: Metadata = { title: 'Radio en directo' };

/**
 * La radio de un ministerio: la señal, la parrilla y si sale en la web.
 *
 * QUÉ NO ESTÁ AQUÍ, Y DÓNDE ESTÁ
 * ------------------------------
 * Quién presenta cada programa este mes son los turnos del ministerio —puestos
 * Locución, Control técnico…—, con su confirmación y su aviso. Las reuniones
 * del equipo, la agenda. Y el tema de UNA emisión concreta no existe todavía:
 * necesita una columna en `turnos` y esta tanda va sin migraciones. Lo que sí
 * hay es el tema fijo de cada programa, que va con la parrilla.
 *
 * La parrilla son filas numeradas en un formulario normal, como los horarios de
 * Ajustes: sin JavaScript para añadir filas. Se ofrecen siempre tres vacías de
 * más; quien necesite otras tres guarda y vuelven a salir.
 */
export default async function EmisoraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  // Las dos puertas de su layout aquí, y no solo allí: ver CLAUDE.md. La ancha,
  // sin `desdeDentro`, como el layout y `guardarEmisora`.
  const { ctx, ministerio } = await requireModuloMinisterio(id, 'emisora');
  const { error, guardado } = await searchParams;

  const emisora = emisoraDeModulos(ministerio.modulos);
  const pastor = esPastor(ctx);
  // Si la iglesia tiene otra radio con señal que va antes, es esa la que suena
  // en `/mi` y en la web: aquí hay que decirlo, o «tu congregación ya lo ve»
  // sería mentira.
  const queSuena = await radioDeLaIglesia(ctx);
  const otraRadio =
    emisora.streamUrl && queSuena && queSuena.ministerioId !== id ? queSuena : null;
  const llena = emisora.parrilla.length >= MAX_PROGRAMAS;
  // Las tres condiciones de `radioPublica()`, no solo la casilla.
  const enLaWeb = emisora.enWeb && ctx.iglesia.webPublica && !!emisora.streamUrl;
  const filas = Math.min(
    Math.max(emisora.parrilla.length + FILAS_DE_MAS, 5),
    MAX_PROGRAMAS,
  );

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="La señal en directo y su programación"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="emisora" />

        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">
            {otraRadio && guardado === 'guardado'
              ? 'Guardado.'
              : CONFIRMACIONES[guardado]}
          </Aviso>
        )}
        {otraRadio && (
          <NotaInfo>
            En la aplicación suena «{otraRadio.nombre}», de otro ministerio que va
            antes en la lista. Esta radio no se oye mientras aquella tenga señal.
          </NotaInfo>
        )}

        <form
          action={guardarEmisora.bind(null, id)}
          className="flex max-w-[760px] flex-col gap-5"
        >
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">La emisora</h2>
              <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
                Con la señal puesta, tu congregación la escucha desde la
                aplicación, en una línea encima de las pestañas. Hatril no
                retransmite nada: cada oyente se conecta directamente al servidor
                de tu emisora.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">
                Nombre de la emisora
                <span className="ml-1.5 font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="nombre"
                name="nombre"
                maxLength={MAX_LARGO_NOMBRE_EMISORA}
                defaultValue={emisora.nombre ?? ''}
                placeholder={ministerio.nombre}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stream_url">Dirección de la señal</Label>
              <CampoSenal valorInicial={emisora.streamUrl ?? ''} />
            </div>
          </section>

          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">La programación de la semana</h2>
              <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
                Qué suena cada día, a qué hora y de qué va. Con esto la
                aplicación dice qué programa va ahora y cuál viene después. Las
                filas que dejes en blanco no se guardan.
              </p>
            </div>

            {/* Aplica aunque la casilla de la web esté apagada: el pastor
                puede encenderla mañana. */}
            <NotaInfo>
              No pongas quién presenta, ni en el nombre ni en el tema: si la radio
              sale en la web, esta lista es pública. Quién presenta cada día va en
              los turnos.
            </NotaInfo>

            <input type="hidden" name="filas" value={filas} />

            {/*
             * Una lista con separadores y no una caja por fila: es como se
             * pintan los turnos, y una pila de cajas de crema dentro de una
             * tarjeta blanca se leía como cinco formularios en vez de uno.
             */}
            <ol className="-mx-5 flex flex-col border-t border-border">
              {Array.from({ length: filas }, (_, i) => {
                const p = emisora.parrilla[i];
                const n = i + 1;
                return (
                  <li
                    key={i}
                    className="grid grid-cols-2 gap-2 border-b border-border px-5 py-3.5 last:border-b-0 sm:grid-cols-[9rem_7.5rem_1fr_6.5rem]"
                  >
                    <select
                      name={`programa-${i}-dia`}
                      defaultValue={p?.dia ?? DIAS_PARRILLA[0]}
                      aria-label={`Día del programa ${n}`}
                      className="h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-2.5 text-[16px] text-foreground outline-none md:text-[15px] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16"
                    >
                      {DIAS_PARRILLA.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      name={`programa-${i}-hora`}
                      defaultValue={p?.hora ?? ''}
                      aria-label={`Hora del programa ${n}`}
                    />
                    <Input
                      name={`programa-${i}-nombre`}
                      defaultValue={p?.nombre ?? ''}
                      maxLength={MAX_LARGO_PROGRAMA}
                      placeholder="Nombre del programa"
                      aria-label={`Nombre del programa ${n}`}
                      className="col-span-2 sm:col-span-1"
                    />
                    {/* Última en el móvil, para que el tema quede pegado al nombre;
                        en escritorio, en la fila de arriba con el resto. */}
                    <label className="order-last col-span-2 flex items-center gap-2 text-[13.5px] text-muted-foreground sm:order-none sm:col-span-1">
                      <Input
                        type="number"
                        name={`programa-${i}-duracion`}
                        defaultValue={p?.duracion_min ?? 60}
                        min={DURACION_MIN}
                        max={DURACION_MAX}
                        step={5}
                        aria-label={`Minutos que dura el programa ${n}`}
                        // El color, explícito: dentro de la etiqueta heredaría el
                        // gris y el número parecería un ejemplo sin rellenar.
                        className="w-24 text-foreground sm:w-full"
                      />
                      <span className="sm:hidden">minutos</span>
                      <span className="hidden sm:inline">min</span>
                    </label>
                    <Input
                      name={`programa-${i}-tema`}
                      defaultValue={p?.tema ?? ''}
                      maxLength={MAX_LARGO_TEMA}
                      placeholder="De qué va, en una línea (opcional)"
                      aria-label={`De qué va el programa ${n}`}
                      className="col-span-2 sm:col-span-4"
                    />
                  </li>
                );
              })}
            </ol>

            {llena && (
              <NotaInfo>
                Has llegado a los {MAX_PROGRAMAS} programas, que es el máximo. Cada
                día de un programa diario ocupa una fila: si te faltan, junta los
                que puedas en uno más largo.
              </NotaInfo>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">En la web de la iglesia</h2>
              <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
                Un bloque «Radio en directo» con el reproductor y la programación,
                para cualquiera que entre en la web. Sin nombres de quien
                presenta.
              </p>
            </div>

            {pastor ? (
              <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px]">
                <input
                  type="checkbox"
                  name="en_web"
                  defaultChecked={emisora.enWeb}
                  className="mt-0.5 size-[17px] flex-none cursor-pointer accent-primary"
                />
                <span>
                  Mostrar la radio en la web de la iglesia
                  {!ctx.iglesia.webPublica ? (
                    <span className="block text-[13px] text-muted-foreground">
                      Tu web todavía no está publicada. Saldrá cuando la publiques
                      en <Link href="/panel/ajustes">Ajustes</Link>.
                    </span>
                  ) : (
                    !emisora.streamUrl && (
                      <span className="block text-[13px] text-muted-foreground">
                        Saldrá cuando la radio tenga la dirección de la señal.
                      </span>
                    )
                  )}
                </span>
              </label>
            ) : (
              <p className="text-[14px] leading-relaxed">
                {enLaWeb
                  ? 'Ahora mismo sale en la web.'
                  : !emisora.enWeb
                    ? 'Ahora mismo no sale en la web.'
                    : !ctx.iglesia.webPublica
                      ? 'El pastor la ha marcado para la web, pero la web de la iglesia todavía no está publicada.'
                      : 'El pastor la ha marcado para la web, pero no saldrá hasta que tenga señal.'}{' '}
                <span className="text-muted-foreground">
                  Lo decide el pastor. Si cambias la señal, el nombre o la
                  programación, la radio deja de salir hasta que la vuelva a
                  activar.
                </span>
              </p>
            )}
          </section>

          <div>
            <BotonGuardar />
          </div>
        </form>
      </Contenedor>
    </>
  );
}

/** El recuadro de información de esta pantalla: borde, crema e icono. */
function NotaInfo({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-alt px-3.5 py-3 text-[13.5px] leading-snug">
      <Info
        className="mt-px size-4 flex-none text-muted-foreground"
        strokeWidth={1.9}
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}
