import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Trash2, UserCheck, UserMinus } from 'lucide-react';
import { z } from 'zod';

import { formatearFechaLarga, mesEnLaIglesia } from '@/lib/fecha/hoy';
import { obtenerBeneficiario } from '@/lib/reparto/consultas';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../../_components/cabecera';
import { Contenedor } from '../../../../../_components/contenedor';
import { CONFIRMACIONES } from '../../constantes';
import { borrarPersona, cambiarBaja, editarPersona } from '../../actions';

import { requireReparto } from '../../guarda';

export const metadata: Metadata = { title: 'Hogar del padrón' };

/**
 * Un hogar del padrón: corregir sus datos, darlo de baja o borrarlo.
 *
 * Borrar está aquí desde el primer día, y no en un correo a Hatril: es el
 * derecho de supresión de alguien que probablemente no tiene cuenta, ni correo
 * con el que escribir, y que se lo va a pedir de palabra a quien está en la
 * puerta. Una promesa legal necesita el botón que la cumple. Va a la vista y no
 * dentro de un `<details>`, por lo mismo, y con su casilla: es irreversible y
 * son los datos de otra persona.
 *
 * Enseña CUÁNDO y con qué texto se le pidió permiso. Es lo que hay que poder
 * contestar si la persona pregunta qué se le dijo, y la prueba del art. 7.1.
 */
export default async function HogarDelPadronPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; beneficiarioId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, beneficiarioId } = await params;
  // La puerta en la página y no solo en el layout: ver `guarda.ts`.
  const { ctx, ministerio } = await requireReparto(id);
  const { error, guardado } = await searchParams;

  // Un id que no es uuid haría fallar el cast en Postgres con un 500.
  if (!z.string().uuid().safeParse(beneficiarioId).success) notFound();

  const persona = await obtenerBeneficiario(ctx, id, beneficiarioId);
  if (!persona) notFound();

  const deBaja = persona.bajaAt !== null;
  const apuntado = persona.consentimientoAt.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ctx.iglesia.timezone,
  });

  // En el subtítulo solo lo corto, que la cabecera recorta: a 375 px caben unos
  // 200 px, y con la fecha detrás se leía «la última el do…». La fecha va en el
  // cuerpo.
  const resumen = [
    deBaja && 'De baja',
    persona.veces === 0
      ? 'Todavía no ha venido'
      : persona.veces === 1
        ? 'Ha venido 1 vez'
        : `Ha venido ${persona.veces} veces`,
  ]
    .filter(Boolean)
    .join(' · ');

  // `reparto-2026-10` es la versión del aviso; en pantalla, su mes.
  const mesDelAviso = /^reparto-(\d{4}-\d{2})$/.exec(persona.consentimientoVersion)?.[1];
  const aviso = mesDelAviso
    ? `el aviso de ${mesEnLaIglesia(ctx.iglesia.timezone, mesDelAviso).etiqueta}`
    : 'el aviso del reparto';

  return (
    <>
      <CabeceraPanel
        titulo={`${persona.numero} · ${persona.nombre}`}
        subtitulo={resumen}
        volver={{
          href: `/panel/ministerios/${id}/reparto/padron`,
          texto: `Padrón de ${ministerio.nombre}`,
        }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <form action={editarPersona.bind(null, id, persona.id)} className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Cómo quiere que le llamen</Label>
              <Input
                id="nombre"
                name="nombre"
                required
                maxLength={80}
                autoComplete="off"
                defaultValue={persona.nombre}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="personas">Personas en su casa, contándole</Label>
                <Input
                  id="personas"
                  name="personas"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  required
                  defaultValue={persona.personasHogar}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="telefono">
                  Teléfono{' '}
                  <span className="font-normal text-muted-foreground">(si quiere)</span>
                </Label>
                <Input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  maxLength={32}
                  autoComplete="off"
                  defaultValue={persona.telefono ? formatearTelefono(persona.telefono) : ''}
                />
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {persona.ultimaVez
                ? `Vino por última vez el ${formatearFechaLarga(persona.ultimaVez)}. `
                : ''}
              Se le leyó {aviso} y dio su permiso el {apuntado}.
            </p>
          </section>

          <div className="flex items-center gap-3">
            <Button type="submit">Guardar los cambios</Button>
          </div>
        </form>

        <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">{deBaja ? 'Está de baja' : 'Dar de baja'}</h2>
            <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
              {deBaja
                ? 'Sale de la lista y del recuento del padrón, pero conserva su número. Si vuelve, al marcar que ha llegado se reactiva sola.'
                : 'Para quien se ha mudado o ya no lo necesita. Sale de la lista y del recuento, conserva su número, y si vuelve se reactiva.'}
            </p>
          </div>
          <form action={cambiarBaja.bind(null, id, persona.id)}>
            <input type="hidden" name="baja" value={deBaja ? '0' : '1'} />
            <Button type="submit" variant="outline">
              {deBaja ? <UserCheck strokeWidth={1.8} /> : <UserMinus strokeWidth={1.8} />}
              {deBaja ? 'Reactivar' : 'Dar de baja'}
            </Button>
          </form>
        </section>

        <section
          id="borrar"
          className="flex scroll-mt-24 flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Borrar sus datos</h2>
            <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
              Si te lo pide, bórralo en el momento. Se van su nombre, su teléfono,
              su número y su permiso. Lo que se le entregó sigue contado como
              entrega, sin nombre, pero deja de contar en hogares atendidos,
              personas alcanzadas y nuevos, también en los meses pasados.
            </p>
          </div>
          <form action={borrarPersona.bind(null, id, persona.id)} className="flex flex-col items-start gap-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-relaxed">
              <input type="checkbox" name="confirmar" required className="mt-1 flex-none" />
              <span>Entiendo que no se puede deshacer.</span>
            </label>
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.8} />
              Borrar este hogar
            </Button>
          </form>
        </section>
      </Contenedor>
    </>
  );
}
