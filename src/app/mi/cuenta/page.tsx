import Link from 'next/link';
import type { Metadata } from 'next';
import { ExternalLink, HandCoins, LogOut } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misMinisterios } from '@/lib/ministerios/consultas';
import { donativosDeMiIglesia } from '@/lib/iglesias/donativos';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { iniciales } from '@/lib/format/iniciales';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { salir } from '../../(auth)/actions';
import { CabeceraMiembro } from '../_components/cabecera-miembro';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default async function MiCuentaPage() {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ministerios, donativos] = await Promise.all([
    misMinisterios(ctx),
    donativosDeMiIglesia(ctx),
  ]);

  const nombre = nombreDeLaCuenta(user!);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Mi cuenta"
        subtitulo={ctx.iglesia.nombre}
        logoUrl={ctx.iglesia.logoUrl}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-6 px-4 py-6 sm:px-5">
        <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
          <span className="flex size-12 flex-none items-center justify-center rounded-full bg-muted text-[14px] font-bold text-muted-foreground">
            {iniciales(nombre)}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[16px] font-bold tracking-[-0.018em]">
              {nombre}
            </span>
            <span className="truncate text-[13.5px] text-muted-foreground">
              {user!.email}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="t-subtitulo">
            {ministerios.length === 1 ? 'Tu ministerio' : 'Tus ministerios'}
          </h2>
          {ministerios.length === 0 ? (
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              Todavía no sirves en ningún equipo. Si te apetece echar una mano,
              díselo en persona el domingo: eso no se pide por una aplicación.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ministerios.map((m) => {
                const color = colorDeMinisterio(m.colorHex);
                return (
                  <li
                    key={m.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 flex-none items-center justify-center rounded-[10px]"
                        style={{ background: color.suave }}
                      >
                        <span
                          className="size-3 rounded"
                          style={{ background: color.hex }}
                        />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[15.5px] font-bold tracking-[-0.015em]">
                          {m.nombre}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {m.rolEnMinisterio ??
                            (m.rolEquipo === 'responsable'
                              ? 'Responsable'
                              : m.rolEquipo === 'colider'
                                ? 'Colíder'
                                : 'Voluntario')}
                        </span>
                      </div>
                    </div>
                    {m.objetivo && (
                      <div className="flex flex-col gap-1">
                        <span className="t-micro">Hacia dónde vamos</span>
                        <p className="text-pretty text-[14px] leading-snug">
                          {m.objetivo}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/*
         * Donar solo se pinta si la iglesia ha puesto su cuenta. Un botón que al
         * pulsarlo dice «tu iglesia todavía no ha configurado esto» le pasa el
         * problema a quien no puede resolverlo.
         *
         * Y no es una pasarela: es el mismo número que esa congregación ya
         * publica en su web. Por Hatril no pasa dinero, que es lo que
         * `/privacidad` §3 promete.
         */}
        {donativos && (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2.5">
              <HandCoins className="size-5 text-accent-brand" strokeWidth={1.8} />
              <h2 className="t-subtitulo">Ofrendar</h2>
            </div>
            <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
              La cuenta de {ctx.iglesia.nombre}. El dinero va directo a ella:
              Hatril no cobra nada por su cuenta ni se queda comisión.
            </p>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-alt p-3.5">
              <span className="t-micro">Cuenta</span>
              {/* `select-all`: en un móvil, copiar un IBAN a mano es donde la
                  gente se rinde. Un toque lo selecciona entero. */}
              <span className="select-all break-all text-[15px] font-semibold">
                {donativos.cuenta}
              </span>
              {donativos.titular && (
                <>
                  <span className="t-micro mt-1.5">Titular</span>
                  <span className="select-all text-[14.5px]">
                    {donativos.titular}
                  </span>
                </>
              )}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="t-subtitulo">Tu iglesia</h2>
          <div className="flex flex-wrap gap-2.5">
            {ctx.iglesia.webPublica && (
              <Button
                variant="outline"
                render={<Link href={`/i/${ctx.iglesia.slug}`} />}
              >
                <ExternalLink strokeWidth={1.8} />
                La web de {ctx.iglesia.nombre}
              </Button>
            )}
            <form action={salir}>
              <Button type="submit" variant="ghost">
                <LogOut strokeWidth={1.8} />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
