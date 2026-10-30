import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ChevronRight,
  ExternalLink,
  HandCoins,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Trash2,
  UserX,
  Users,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { puedeGestionarMinisterio } from '@/lib/auth/permisos';
import { estadoConsentimiento, exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO } from '@/lib/rgpd/consentimiento';
import { miFotoDePerfil } from '@/lib/miembros/foto';
import { Aviso } from '@/components/aviso';
import { misMinisterios } from '@/lib/ministerios/consultas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { donativosDeMiIglesia } from '@/lib/iglesias/donativos';
import { misBloqueos } from '@/lib/comunidad/moderacion';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { createClient } from '@/lib/supabase/server';
import { Button, buttonVariants } from '@/components/ui/button';
import { salir } from '../../(auth)/actions';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { FotoPerfil } from './_components/foto-perfil';
import { cambiarPermisoAsistencia } from './actions';

export const metadata: Metadata = { title: 'Mi cuenta' };

const CONFIRMACIONES: Record<string, string> = {
  foto: 'Foto guardada.',
  'sin-foto': 'Foto quitada.',
  'asistencia-si': 'Gracias. La iglesia podrá apuntar cuándo vienes.',
  'asistencia-no': 'Permiso retirado. Ya no sales en las listas, y lo que había apuntado de ti se ha borrado.',
};

export default async function MiCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ministerios, donativos, bloqueos, miFoto, consentimiento] = await Promise.all([
    misMinisterios(ctx),
    donativosDeMiIglesia(ctx),
    misBloqueos(ctx),
    miFotoDePerfil(ctx),
    estadoConsentimiento(ctx),
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
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <FotoPerfil nombre={nombre} correo={user!.email ?? ''} foto={miFoto} />

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
                    {/*
                     * A la portada del equipo en la propia app, la de la
                     * pestaña «Equipo». Quien lo lleva entra a sus
                     * herramientas; quien sirve sin llevarlo, a lo suyo: sus
                     * turnos, el próximo ensayo, la lista del domingo. Los dos
                     * van al mismo sitio, y lo que ven lo decide la portada.
                     *
                     * Con `puedeGestionarMinisterio` y no `esDelEquipo`: el
                     * voluntario que lleva la caja entra al panel, pero en ESTE
                     * equipo no tiene herramientas. En contorno porque con dos
                     * ministerios serían dos naranjas, y se admite uno. Y un
                     * `Link` con las clases del botón, no un `Button` con
                     * `render`: Base UI le pondría `type="button"` a un enlace.
                     */}
                    <Link
                      href={rutaApp(m.id)}
                      className={buttonVariants({
                        variant: 'outline',
                        className: 'self-start',
                      })}
                    >
                      {puedeGestionarMinisterio(ctx, m.id) ? (
                        <>
                          <LayoutDashboard strokeWidth={1.8} />
                          Abrir herramientas
                        </>
                      ) : (
                        <>
                          <Users strokeWidth={1.8} />
                          Ver tu equipo
                        </>
                      )}
                    </Link>
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

        {/*
         * Privacidad a mano dentro de la app (Apple 5.1.1(i)), y las personas
         * bloqueadas, que la hoja de bloquear promete que se deshacen aquí.
         */}
        <section className="flex flex-col gap-3">
          <h2 className="t-subtitulo">Privacidad</h2>
          {/*
           * El permiso de asistencia, que el texto de la casilla promete poder
           * retirar «cuando quiera». Sin ficha no hay a qué colgarlo, y la
           * sección no sale.
           */}
          {ctx.miembroId && (
            <form
              action={cambiarPermisoAsistencia}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">Registrar mi asistencia</span>
                <span className="text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
                  {TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO}
                </span>
              </div>
              {consentimiento.asistenciaAceptada ? (
                <>
                  <p className="text-[13.5px] font-semibold text-badge-success-fg">
                    Lo tienes dado.
                  </p>
                  <Button type="submit" variant="outline" className="self-start">
                    Retirar el permiso
                  </Button>
                  <p className="text-[12.5px] leading-snug text-muted-foreground">
                    Al retirarlo se borra lo que la iglesia tenía apuntado de tu
                    asistencia y de las veces que te contactaron.
                  </p>
                </>
              ) : (
                <>
                  <input type="hidden" name="asistencia" value="on" />
                  <p className="text-[13.5px] text-muted-foreground">No lo has dado.</p>
                  <Button type="submit" variant="outline" className="self-start">
                    Dar el permiso
                  </Button>
                </>
              )}
            </form>
          )}

          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <FilaEnlace
              href="/mi/cuenta/bloqueados"
              icono={<UserX strokeWidth={1.8} />}
              titulo="Personas bloqueadas"
              detalle={
                bloqueos.length === 0
                  ? 'Nadie'
                  : bloqueos.length === 1
                    ? '1 persona'
                    : `${bloqueos.length} personas`
              }
            />
            <FilaEnlace
              href="/privacidad"
              icono={<ShieldCheck strokeWidth={1.8} />}
              titulo="Política de privacidad"
              detalle="Qué datos se guardan y para qué"
            />
          </div>
        </section>

        {/*
         * Al final y en su zona, como pide el diseño: es lo único de la pantalla
         * que no se deshace con otro toque.
         */}
        <section className="flex flex-col gap-3 rounded-xl border border-danger-border bg-surface p-5">
          <h2 className="t-subtitulo text-danger">Borrar mi cuenta</h2>
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Se desactiva al momento y se borra a los 30 días, con lo que hayas
            publicado. Tu ficha en {ctx.iglesia.nombre} la sigue llevando la
            iglesia.
          </p>
          <Link
            href="/mi/cuenta/borrar"
            className={buttonVariants({ variant: 'destructive', className: 'self-start' })}
          >
            <Trash2 strokeWidth={1.8} />
            Quiero borrar mi cuenta
          </Link>
        </section>
      </main>
    </div>
  );
}

function FilaEnlace({
  href,
  icono,
  titulo,
  detalle,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border px-4 py-3.5 text-foreground no-underline outline-none last:border-b-0 hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20 [&>svg:first-child]:size-5 [&>svg:first-child]:flex-none [&>svg:first-child]:text-muted-foreground"
    >
      {icono}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{titulo}</span>
        <span className="text-[13px] text-muted-foreground">{detalle}</span>
      </span>
      <ChevronRight className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
    </Link>
  );
}
