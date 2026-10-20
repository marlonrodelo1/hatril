import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Globe, Info } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import {
  DIAS_PARRILLA,
  DURACION_MAX,
  DURACION_MIN,
  MAX_LARGO_NOMBRE_EMISORA,
  MAX_LARGO_PROGRAMA,
  MAX_PROGRAMAS,
  emisoraDeModulos,
} from '@/lib/emisora/config';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
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
 * del equipo, la agenda. Y el tema de cada emisión no existe todavía: necesita
 * una columna en `turnos` y esta tanda va sin migraciones.
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
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const emisora = emisoraDeModulos(ministerio.modulos);
  const pastor = esPastor(ctx);
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
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <form
          action={guardarEmisora.bind(null, id)}
          className="flex max-w-[760px] flex-col gap-5"
        >
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="t-subtitulo">La emisora</h2>
              <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
                Con la señal puesta, la congregación la escucha desde la
                aplicación, en una línea encima de las pestañas. Hatril no
                retransmite nada: cada oyente se conecta directamente al
                servidor de vuestra emisora.
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
                Lo que suena cada día y a qué hora. Con esto la aplicación dice
                qué programa va ahora y cuál viene después. Las filas que dejes en
                blanco no se guardan.
              </p>
            </div>

            {/* Fuera de la tarjeta de la web, porque aplica aunque la casilla
                esté apagada: el pastor puede encenderla mañana. */}
            <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-alt px-3.5 py-3 text-[13.5px] leading-snug">
              <Info
                className="mt-px size-4 flex-none text-muted-foreground"
                strokeWidth={1.9}
                aria-hidden
              />
              <span>
                Pon solo el nombre del programa, sin quién lo presenta: si la
                radio sale en la web, esta lista es pública. Quién presenta cada
                día va en los turnos.
              </span>
            </p>

            <input type="hidden" name="filas" value={filas} />

            <div className="flex flex-col gap-2">
              {/* Las etiquetas de columna, solo cuando caben en fila. */}
              <div
                aria-hidden
                className="hidden gap-2 px-3 text-[12px] font-semibold text-muted-foreground sm:flex"
              >
                <span className="w-36">Día</span>
                <span className="w-28">Hora</span>
                <span className="flex-1">Programa</span>
                <span className="w-28">Minutos</span>
              </div>

              {Array.from({ length: filas }, (_, i) => {
                const p = emisora.parrilla[i];
                const n = i + 1;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-alt p-3 sm:flex sm:items-center"
                  >
                    <select
                      name={`programa-${i}-dia`}
                      defaultValue={p?.dia ?? DIAS_PARRILLA[0]}
                      aria-label={`Día del programa ${n}`}
                      className="h-[42px] rounded-lg border border-input bg-surface px-2.5 text-[15px] text-foreground sm:w-36"
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
                      className="bg-surface sm:w-28"
                    />
                    <Input
                      name={`programa-${i}-nombre`}
                      defaultValue={p?.nombre ?? ''}
                      maxLength={MAX_LARGO_PROGRAMA}
                      placeholder="Palabra para hoy"
                      aria-label={`Nombre del programa ${n}`}
                      className="col-span-2 bg-surface sm:flex-1"
                    />
                    <label className="col-span-2 flex items-center gap-2 text-[13px] text-muted-foreground sm:col-auto sm:w-28">
                      <Input
                        type="number"
                        name={`programa-${i}-duracion`}
                        defaultValue={p?.duracion_min ?? 60}
                        min={DURACION_MIN}
                        max={DURACION_MAX}
                        step={5}
                        aria-label={`Minutos que dura el programa ${n}`}
                        className="w-24 bg-surface sm:w-full"
                      />
                      <span className="sm:hidden">minutos</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <Globe
                className="mt-0.5 size-5 flex-none text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="t-subtitulo">En la web de la iglesia</h2>
                <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
                  Un bloque «Radio en directo» con el reproductor y la
                  programación, para cualquiera que entre en la web. Sin nombres
                  de quien presenta.
                </p>
              </div>
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
                  {!ctx.iglesia.webPublica && (
                    <span className="block text-[13px] text-muted-foreground">
                      Vuestra web todavía no está publicada. Saldrá cuando la
                      publiques en <Link href="/panel/ajustes">Ajustes</Link>.
                    </span>
                  )}
                </span>
              </label>
            ) : (
              <p className="text-[14px] leading-relaxed">
                {emisora.enWeb
                  ? 'Ahora mismo sale en la web.'
                  : 'Ahora mismo no sale en la web.'}{' '}
                <span className="text-muted-foreground">
                  Lo decide el pastor. Si cambias la señal, la radio deja de
                  salir hasta que la vuelva a activar.
                </span>
              </p>
            )}
          </section>

          <div>
            <Button type="submit">Guardar la radio</Button>
          </div>
        </form>
      </Contenedor>
    </>
  );
}
