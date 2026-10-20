import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
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

export const metadata: Metadata = { title: 'Persona del padrón' };

/**
 * Una persona del padrón: corregir sus datos, darla de baja o borrarla.
 *
 * Borrar está aquí desde el primer día, y no en un correo a Hatril: es el
 * derecho de supresión de alguien que probablemente no tiene cuenta, ni correo
 * con el que escribir, y que se lo va a pedir de palabra a quien está en la
 * puerta. Una promesa legal necesita el botón que la cumple.
 *
 * Enseña CUÁNDO y con qué texto se le pidió permiso. Es lo que hay que poder
 * contestar si la persona pregunta qué se le dijo, y la prueba del art. 7.1.
 */
export default async function PersonaPadronPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; beneficiarioId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, beneficiarioId } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  // Un id que no es uuid haría fallar el cast en Postgres con un 500.
  if (!z.string().uuid().safeParse(beneficiarioId).success) notFound();

  const [ministerio, persona] = await Promise.all([
    obtenerMinisterio(ctx, id),
    obtenerBeneficiario(ctx, id, beneficiarioId),
  ]);
  if (!ministerio || !persona) notFound();

  const deBaja = persona.bajaAt !== null;
  const apuntado = persona.consentimientoAt.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ctx.iglesia.timezone,
  });

  return (
    <>
      <CabeceraPanel
        titulo={`${persona.numero} · ${persona.nombre}`}
        subtitulo={deBaja ? 'De baja en el padrón del reparto' : 'Padrón del reparto'}
        volver={{ href: `/panel/ministerios/${id}/reparto/padron`, texto: 'Padrón' }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="t-micro">Ha venido</span>
            <span className="text-[24px] font-bold leading-none tabular-nums">
              {persona.veces === 1 ? '1 vez' : `${persona.veces} veces`}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="t-micro">Última vez</span>
            <span className="text-[15px] font-semibold leading-snug first-letter:uppercase">
              {persona.ultimaVez ? formatearFechaLarga(persona.ultimaVez) : 'Todavía no'}
            </span>
          </div>
        </section>

        <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
          Se le leyó el aviso y dio su permiso el {apuntado} (texto{' '}
          <span className="font-mono">{persona.consentimientoVersion}</span>).
        </p>

        <form
          action={editarPersona.bind(null, id, persona.id)}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6"
        >
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
          <Button type="submit" className="self-start">
            Guardar cambios
          </Button>
        </form>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15.5px] font-semibold">
              {deBaja ? 'Está de baja' : 'Dar de baja'}
            </h2>
            <p className="text-[13.5px] leading-snug text-muted-foreground">
              {deBaja
                ? 'No cuenta en el padrón, pero sigue apuntada. Si vuelve, al marcar que ha llegado se reactiva sola.'
                : 'Para quien se ha mudado o ya no lo necesita. Sigue apuntada y conserva su número; si vuelve, se reactiva.'}
            </p>
          </div>
          <form action={cambiarBaja.bind(null, id, persona.id)}>
            <input type="hidden" name="baja" value={deBaja ? '0' : '1'} />
            <Button type="submit" variant="outline">
              {deBaja ? 'Reactivar' : 'Dar de baja'}
            </Button>
          </form>
        </section>

        <section
          id="borrar"
          className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-danger-border bg-surface p-4 md:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-[15.5px] font-semibold">Borrar sus datos</h2>
            <p className="text-[13.5px] leading-snug text-muted-foreground">
              Si lo pide, se hace en el momento. Se borran su nombre, su
              teléfono, su número y el registro de su permiso. Lo que se le
              entregó se queda contado en el historial, sin nombre, y las
              entregas de cada día no cambian. Solo deja de contar como hogar
              distinto del mes: sin nombre, ya no se sabe si era el mismo.
            </p>
          </div>
          <form action={borrarPersona.bind(null, id, persona.id)} className="flex flex-col gap-3">
            <label className="flex items-start gap-2.5 text-[14px] leading-relaxed">
              <input type="checkbox" name="confirmar" required className="mt-1 flex-none" />
              <span>Entiendo que no se puede deshacer.</span>
            </label>
            <Button type="submit" variant="destructive" className="self-start">
              <Trash2 strokeWidth={1.9} />
              Borrar a esta persona
            </Button>
          </form>
        </section>
      </Contenedor>
    </>
  );
}
