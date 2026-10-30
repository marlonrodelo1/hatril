import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Check, Flag, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { denunciasPendientes } from '@/lib/comunidad/moderacion';
import { motivoCorto } from '@/lib/comunidad/denuncias';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import { AvatarPersona } from '@/components/avatar-persona';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { dejarDenunciado, quitarDenunciado } from '../actions';

export const metadata: Metadata = { title: 'Denuncias' };
export const dynamic = 'force-dynamic';

/**
 * La cola de quien modera la comunidad.
 *
 * EN `/mi` Y NO EN EL PANEL
 * -------------------------
 * `moderar_comunidad` se puede dar a un miembro raso, y un miembro raso no
 * entra al panel. La moderación se ejerce donde está el muro.
 *
 * LA GUARDA VA AQUÍ, NO EN UN LAYOUT
 * ----------------------------------
 * `requireIglesia()` más el permiso, en la propia página (CLAUDE.md). Y aunque
 * se cayera, la policy de la `0053` solo enseña a quien no modera sus propias
 * denuncias.
 *
 * SIN EL NOMBRE DE QUIEN DENUNCIA
 * -------------------------------
 * Ni se pinta ni se consulta (`denunciasPendientes` no lo devuelve). Lo que
 * decide el moderador es si eso puede estar en el muro, y para eso no hace
 * falta saber quién avisó; saberlo es la forma más corta de que deje de avisar
 * nadie.
 */
export default async function DenunciasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; hecho?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  if (!puedeModerarComunidad(ctx)) redirect('/mi/comunidad');

  const { error, hecho } = await searchParams;
  const cola = await denunciasPendientes(ctx);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={ctx.user}
        titulo="Denuncias"
        subtitulo={ctx.iglesia.nombre}
        volver="/mi/comunidad"
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {hecho === 'quitado' && (
          <Aviso tipo="ok">Quitado del muro. Hemos avisado a quien lo escribió.</Aviso>
        )}
        {hecho === 'dejado' && (
          <Aviso tipo="ok">
            Se queda en el muro. Quien lo denunció lo sigue sin ver.
          </Aviso>
        )}

        <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          Lo que alguien de la congregación ha denunciado del muro. Quien lo
          escribió no sabe que se ha denunciado ni quién lo hizo, y aquí tampoco
          sale.
        </p>

        {cola.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-badge-success-bg text-badge-success-fg">
              <Check className="size-5" strokeWidth={1.8} />
            </span>
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">
              No hay nada por revisar
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Cuando alguien denuncie algo del muro te llegará un aviso y
              aparecerá aquí.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {cola.map((d) => (
              <li
                key={d.tipo + d.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-badge-warning-bg px-2.5 py-1 text-badge-warning-fg">
                    <Flag className="size-[13px]" strokeWidth={2} />
                    {d.total === 1 ? '1 denuncia' : `${d.total} denuncias`}
                  </span>
                  {d.motivos.map((m) => (
                    <span
                      key={m.motivo}
                      className="rounded-full bg-badge-neutral-bg px-2.5 py-1 text-badge-neutral-fg"
                    >
                      {motivoCorto(m.motivo)}
                      {m.veces > 1 && ` · ${m.veces}`}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-2.5">
                    <AvatarPersona nombre={d.autorNombre} fotoUrl={d.autorFoto} tamano="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-bold">{d.autorNombre}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {d.tipo === 'comentario' ? 'Comentario' : 'Publicación'} ·{' '}
                        {haceCuanto(d.publicadoAt)}
                      </span>
                    </span>
                  </div>
                  {d.texto && (
                    <p className="line-clamp-6 whitespace-pre-line text-[14.5px] leading-relaxed">
                      {d.texto}
                    </p>
                  )}
                  {d.imagenes.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {d.imagenes.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="aspect-square w-full rounded-md border border-border object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {d.detalles.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {d.detalles.map((texto, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-surface-alt px-3 py-2 text-[13.5px] leading-relaxed"
                      >
                        «{texto}»
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <form action={dejarDenunciado.bind(null, d.tipo, d.id)}>
                    <Button type="submit" variant="outline" className="w-full">
                      Dejarlo
                    </Button>
                  </form>
                  <form action={quitarDenunciado.bind(null, d.tipo, d.id)}>
                    <Button type="submit" variant="destructive" className="w-full">
                      <Trash2 strokeWidth={1.8} />
                      Quitar del muro
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
