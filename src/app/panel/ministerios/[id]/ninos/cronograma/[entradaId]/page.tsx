import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { entradaDelCronograma } from '@/lib/ninos/consultas';
import { Aviso } from '@/components/aviso';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../../_components/cabecera';
import { Contenedor } from '../../../../../_components/contenedor';
import { CamposClase, maestrosDe } from '../../_components/campos-clase';
import { borrarClase, editarClase } from '../../actions';
import { requireNinos } from '../../guarda';

export const metadata: Metadata = { title: 'Clase del cronograma' };

/** Editar o borrar una clase del cronograma. */
export default async function ClasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; entradaId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, entradaId } = await params;
  const { ctx, ministerio } = await requireNinos(id);
  const { error } = await searchParams;

  if (!z.string().uuid().safeParse(entradaId).success) notFound();
  const entrada = await entradaDelCronograma(ctx, id, entradaId);
  if (!entrada) notFound();

  return (
    <>
      <CabeceraPanel
        titulo={entrada.tema}
        volver={{ href: `/panel/ministerios/${id}/ninos/cronograma`, texto: `${ministerio.nombre} · Cronograma` }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <form action={editarClase.bind(null, id, entradaId)} className="flex flex-col gap-4">
            <CamposClase
              maestros={maestrosDe(ministerio.equipo)}
              hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
              entrada={entrada}
            />
            <BotonEnviar className="self-start">Guardar los cambios</BotonEnviar>
          </form>
        </section>

        <form action={borrarClase.bind(null, id, entradaId)} className="self-start">
          <Button type="submit" variant="destructive" size="sm">
            <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
            Borrar la clase
          </Button>
        </form>
      </Contenedor>
    </>
  );
}
