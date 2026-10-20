import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { sumarDias } from '@/lib/agenda/horarios';
import { DIAS_EN_NUEVOS } from '@/lib/seguimiento/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../../_components/cabecera';
import { Contenedor } from '../../../../../_components/contenedor';
import { apuntarVisitante } from '../../actions';

export const metadata: Metadata = { title: 'Apuntar a alguien nuevo' };

/**
 * La tarjeta de bienvenida, pasada a mano por el equipo.
 *
 * Pensada para el móvil después del culto, con la tarjeta de papel delante:
 * cinco campos y dos casillas, y nada que haya que pensar. Lo que puede hacer
 * y lo que no, en `apuntarVisitante()`.
 *
 * Sin campo de notas, a propósito. Es el sitio exacto donde acabaría escrito
 * «viene porque se está separando», y eso no lo guarda Hatril en ninguna parte.
 */
export default async function AltaVisitantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return (
    <>
      <CabeceraPanel
        titulo="Apuntar a alguien nuevo"
        subtitulo="Se crea su ficha como Visitante y sale en Nuevos"
        volver={{
          href: `/panel/ministerios/${id}/seguimiento/nuevos`,
          texto: 'Nuevos',
        }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <form
          action={apuntarVisitante.bind(null, id)}
          className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" required minLength={2} maxLength={120} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidos">
                Apellidos
                <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="apellidos" name="apellidos" maxLength={160} autoComplete="off" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                maxLength={40}
                autoComplete="off"
              />
              <p className="t-label text-muted-foreground">
                Sin él, solo se le puede saludar en persona.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                Correo
                <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="email" name="email" type="email" maxLength={200} autoComplete="off" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:max-w-[50%]">
            <Label htmlFor="fecha">Cuándo vino por primera vez</Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoy}
              min={sumarDias(hoy, -DIAS_EN_NUEVOS)}
              max={hoy}
            />
          </div>

          {/*
           * Las dos casillas sin marcar, y obligatorias. No se guardan (lo cuenta
           * la action): están para que nadie apunte a alguien sin habérselo
           * preguntado, que es lo único que de verdad depende de quien teclea.
           */}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">Antes de apuntarle</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3 has-checked:border-primary has-checked:bg-accent">
              <input type="checkbox" name="permiso" required className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">
                  Le he preguntado y quiere que la iglesia guarde estos datos y le llame
                </span>
                <span className="text-[13px] leading-snug text-muted-foreground">
                  Si te lo dio por escrito en una tarjeta, la tarjeta la guarda la
                  iglesia.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3 has-checked:border-primary has-checked:bg-accent">
              <input type="checkbox" name="adulto" required className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">Es mayor de edad</span>
                <span className="text-[13px] leading-snug text-muted-foreground">
                  Los niños y los adolescentes no se apuntan por aquí.
                </span>
              </span>
            </label>
          </fieldset>

          <div>
            <Button type="submit">Apuntarle</Button>
          </div>
        </form>
      </Contenedor>
    </>
  );
}
