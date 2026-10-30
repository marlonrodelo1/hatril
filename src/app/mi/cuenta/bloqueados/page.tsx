import type { Metadata } from 'next';
import { UserX } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misBloqueos } from '@/lib/comunidad/moderacion';
import { AvatarPersona } from '@/components/avatar-persona';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { desbloquear } from '../../comunidad/actions';

export const metadata: Metadata = { title: 'Personas bloqueadas' };

/**
 * A quién has bloqueado en el muro, y deshacerlo.
 *
 * Bloquear sin poder desbloquear sería una puerta que solo se cierra, y la
 * pantalla del bloqueo promete que se deshace desde aquí.
 */
export default async function BloqueadosPage({
  searchParams,
}: {
  searchParams: Promise<{ desbloqueado?: string; error?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { desbloqueado, error } = await searchParams;
  const bloqueos = await misBloqueos(ctx);

  const fecha = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    timeZone: ctx.iglesia.timezone,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={ctx.user}
        titulo="Personas bloqueadas"
        subtitulo={ctx.iglesia.nombre}
        volver="/mi/cuenta"
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {desbloqueado && (
          <Aviso tipo="ok">
            Desbloqueado. Vuelves a ver lo que publica, y no se ha enterado.
          </Aviso>
        )}

        <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          No ves lo que publican ni comentan en la comunidad. No saben que les
          has bloqueado.
        </p>

        {bloqueos.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserX className="size-5" strokeWidth={1.7} />
            </span>
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">
              No has bloqueado a nadie
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Si alguien te molesta en el muro, toca los tres puntos de lo que
              publica y elige «Bloquear».
            </p>
          </div>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {bloqueos.map((b) => (
              <li
                key={b.miembroId}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <AvatarPersona nombre={b.nombre} fotoUrl={b.foto} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{b.nombre}</span>
                  <span className="text-[13px] text-muted-foreground">
                    Desde el {fecha.format(b.desde)}
                  </span>
                </span>
                <form action={desbloquear.bind(null, b.miembroId)}>
                  <Button type="submit" variant="outline" size="sm">
                    Desbloquear
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {bloqueos.length > 0 && (
          <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
            Al desbloquear, volverás a ver lo que publica. Tampoco se entera.
          </p>
        )}
      </main>
    </div>
  );
}
