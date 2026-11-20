import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { VistaComunidad } from './_components/vista-comunidad';
import { datosDelMuro } from './datos';

export const metadata: Metadata = { title: 'Comunidad' };

/**
 * El muro de la congregación.
 *
 * PUERTAS ADENTRO
 * ---------------
 * `requireIglesia()` echa a quien no tiene membresía ACTIVA: sin sesión, a
 * identificarse; con sesión y solicitud pendiente, a `/mi`, que le cuenta en qué
 * punto está. Aquí no entra nadie de fuera de la congregación, y las policies de
 * la `0015` lo garantizan aunque este guard se cayera.
 *
 * POR QUÉ NO ESTÁ EN EL PANEL
 * ---------------------------
 * El panel es la herramienta de quien administra la iglesia —fichero de
 * miembros, ministerios, ajustes— y la mayoría de la congregación no entra ahí
 * ni tiene por qué. El muro es de todos, así que vive en el área del miembro.
 *
 * LO QUE ESTA PANTALLA PINTA LO DECIDE LA IGLESIA
 * -----------------------------------------------
 * Los cuatro campos de `ctx.iglesia.comunidad` (migraciones `0026` y `0027`) se
 * tocan en `/panel/comunidad` y se aplican aquí. La regla de oro es que la
 * interfaz no ofrezca lo que las policies van a rechazar: un botón que siempre
 * da error es peor que no tener botón.
 *
 * Y al revés, lo que YA está publicado se sigue viendo entero aunque después se
 * apaguen las fotos o los comentarios. Apagar es dejar de escribir, no borrar —
 * la propia `0027` deja el SELECT fuera de la configuración a propósito para que
 * apagar un domingo no parezca haber perdido el muro.
 *
 * `dynamic` porque esto cambia cada minuto y cada persona ve una cosa distinta:
 * sus «me gusta», sus publicaciones, sus botones de borrar. Cachearlo sería
 * enseñarle a alguien el muro tal y como lo ve otro.
 */
export const dynamic = 'force-dynamic';

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bloqueado?: string }>;
}) {
  const { error, bloqueado } = await searchParams;
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const datos = await datosDelMuro(ctx);

  return (
    <VistaComunidad
      cabecera={
        <CabeceraMiembro
          logoUrl={ctx.iglesia.logoUrl}
          user={ctx.user}
          titulo="Comunidad"
          subtitulo={ctx.iglesia.nombre}
        />
      }
      {...datos}
      error={error}
      bloqueado={bloqueado}
    />
  );
}
