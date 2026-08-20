import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { Aviso } from '@/components/aviso';
import { FormularioEvento } from '../_components/formulario';
import { crearEvento } from '../actions';

export const metadata: Metadata = { title: 'Nuevo evento' };

export default async function NuevoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href="/panel/eventos"
          className="mb-1 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ArrowLeft className="size-[15px]" strokeWidth={1.8} />
          Eventos
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Nuevo evento
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Se crea sin publicar. Nadie lo ve hasta que tú lo digas.
        </p>
      </header>

      <div className="flex w-full max-w-[620px] flex-col gap-6 px-5 pb-16 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}

        <FormularioEvento
          accion={crearEvento}
          textoEnviar="Crear evento"
          moneda={ctx.iglesia.moneda}
          valores={{
            titulo: '',
            descripcion: '',
            lugar: '',
            inicio: '',
            fin: '',
            precio: '',
            cupo: '',
            enlacePago: '',
            pagoInstrucciones: '',
          }}
        />
      </div>
    </>
  );
}
