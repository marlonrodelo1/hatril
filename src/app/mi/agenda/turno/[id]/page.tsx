import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../../../_components/cabecera-miembro';
import { VistaTurno } from './_components/vista-turno';
import { datosDelTurno } from './datos';

export const metadata: Metadata = { title: 'Turno' };

/**
 * Un turno, visto desde dentro del equipo.
 *
 * Lo abre quien sirve en ese culto, desde su aviso o desde la agenda, y también
 * cualquiera del mismo equipo que quiera ver con quién le toca. Fuera del equipo
 * es un 404: lo decide `turnoParaMiembro()`, que mira la pertenencia real.
 *
 * El único botón naranja es el de confirmar, y solo cuando falta: con el turno
 * ya confirmado, lo que queda es la salida discreta de «al final no puedo».
 */
export default async function TurnoMiembroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { id } = await params;
  const { error, guardado } = await searchParams;

  const datos = await datosDelTurno(ctx, id);
  if (!datos) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <VistaTurno
      cabecera={
        <CabeceraMiembro
          user={user!}
          titulo="Turno"
          subtitulo={datos.turno.ministerio.nombre}
          volver="/mi/agenda"
        />
      }
      {...datos}
      error={error}
      guardado={guardado}
    />
  );
}
