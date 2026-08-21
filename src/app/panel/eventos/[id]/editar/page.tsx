import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { evento } from '@/lib/eventos/consultas';
import { timestampAFechaHoraLocal } from '@/lib/fecha/zona';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { FormularioEvento } from '../../_components/formulario';
import { editarEvento } from '../../actions';

export const metadata: Metadata = { title: 'Editar evento' };

/**
 * Editar.
 *
 * Lo delicado aquí es la hora: en la base es un instante y en el formulario
 * tiene que salir la hora de pared de la iglesia. Sin
 * `timestampAFechaHoraLocal`, el pastor abriría esta pantalla, vería la hora UTC
 * y la guardaría tal cual: el evento se desplazaría cinco horas cada vez que
 * alguien corrigiera una coma del título.
 */
export default async function EditarEventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { id } = await params;
  const { error } = await searchParams;

  const e = await evento(ctx, id);
  if (!e) notFound();

  const tz = ctx.iglesia.timezone;
  const inicio = timestampAFechaHoraLocal(e.inicioEn, tz);
  const fin = e.finEn ? timestampAFechaHoraLocal(e.finEn, tz) : null;

  return (
    <>
      {/* El «volver» lleva al evento, no al listado, y con su título: se llega
          aquí desde la ficha y es a la ficha adonde se quiere regresar. */}
      <CabeceraPanel
        titulo="Editar evento"
        volver={{ href: `/panel/eventos/${id}`, texto: e.titulo }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <FormularioEvento
          accion={editarEvento.bind(null, id)}
          textoEnviar="Guardar cambios"
          moneda={ctx.iglesia.moneda}
          valores={{
            titulo: e.titulo,
            descripcion: e.descripcion ?? '',
            lugar: e.lugar ?? '',
            inicio: `${inicio.fecha}T${inicio.hora}`,
            fin: fin ? `${fin.fecha}T${fin.hora}` : '',
            // El precio se guarda como `numeric` y llega '50000.00'. Se le
            // quitan los decimales cuando son cero para que el pastor no vea un
            // formato que él no escribió.
            precio: e.precio ? e.precio.replace(/\.00$/, '') : '',
            cupo: e.cupo ? String(e.cupo) : '',
            enlacePago: e.enlacePago ?? '',
            pagoInstrucciones: e.pagoInstrucciones ?? '',
          }}
        />
      </Contenedor>
    </>
  );
}
