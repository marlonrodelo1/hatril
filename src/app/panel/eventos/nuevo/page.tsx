import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
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
      <CabeceraPanel
        titulo="Nuevo evento"
        subtitulo="Se crea sin publicar. Nadie lo ve hasta que tú lo digas."
        volver={{ href: '/panel/eventos', texto: 'Eventos' }}
      />

      <Contenedor ancho="formulario">
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
      </Contenedor>
    </>
  );
}
