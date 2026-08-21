import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { KeyRound, Mail } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { withUser } from '@/lib/db';
import { miembros } from '@/lib/db/schema';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { guardarMisDatos } from './actions';

export const metadata: Metadata = { title: 'Tu cuenta' };

/**
 * Los datos de quien está usando el panel.
 *
 * ESTA PANTALLA NO EXISTÍA
 * ------------------------
 * No había ninguna forma de ver ni cambiar los propios datos. El bloque del pie
 * del menú lateral —iniciales, nombre y rol— era un `<span>` inerte, y lo único
 * que se podía hacer con la cuenta propia era cerrarla. Para corregirse el
 * nombre había que pedírselo a quien tuviera el permiso `editar_miembros`, y ni
 * así: eso cambiaba la ficha pero no el nombre de la cuenta, que es el que
 * aparece en la cabecera y firmando los avisos.
 *
 * Hay además una regla escrita en `permisos.ts` desde el principio y que no se
 * aplicaba en ningún sitio, porque nadie la llamaba nunca:
 *
 *     // Cada cual puede corregir su propia ficha siempre.
 *     if (ctx.miembroId === miembroId) return true;
 *
 * Esta pantalla es donde por fin significa algo.
 */
export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string; password?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, guardado, password } = await searchParams;

  // La ficha, si la tiene. Hay cuentas sin ficha —quien acaba de ser aprobado y
  // todavía no se le ha creado— y esta pantalla tiene que funcionar igual.
  const [ficha] = ctx.miembroId
    ? await withUser(ctx.user.id, (tx) =>
        tx
          .select({
            nombre: miembros.nombre,
            apellidos: miembros.apellidos,
            telefono: miembros.telefono,
          })
          .from(miembros)
          .where(eq(miembros.id, ctx.miembroId!))
          .limit(1),
      )
    : [];

  const nombre = ficha?.nombre ?? nombreDeLaCuenta(ctx.user);

  return (
    <>
      <CabeceraPanel titulo="Tu cuenta" subtitulo="Tus datos y tu contraseña" />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {guardado && <Aviso tipo="ok">Tus datos están guardados.</Aviso>}
        {password && <Aviso tipo="ok">Tu contraseña está cambiada.</Aviso>}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <form>
            <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3.5">
                <span className="flex size-12 flex-none items-center justify-center rounded-full bg-muted text-[15px] font-bold text-muted-foreground">
                  {iniciales(nombre)}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="t-subtitulo">Tus datos</h2>
                  <p className="text-[13px] text-muted-foreground">
                    {ETIQUETAS_ROLES[ctx.rol].titulo} en {ctx.iglesia.nombre}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    required
                    maxLength={120}
                    defaultValue={nombre}
                    autoComplete="given-name"
                  />
                </div>

                {/* Apellidos y teléfono solo si hay ficha: sin ella no hay
                    dónde guardarlos. `user_metadata` guarda únicamente el
                    nombre, y meterle más campos sería empezar otra copia de la
                    ficha en un sitio donde nadie la busca. */}
                {ctx.miembroId && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="apellidos">
                        Apellidos{' '}
                        <span className="font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </Label>
                      <Input
                        id="apellidos"
                        name="apellidos"
                        maxLength={120}
                        defaultValue={ficha?.apellidos ?? ''}
                        autoComplete="family-name"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="telefono">
                        Teléfono{' '}
                        <span className="font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </Label>
                      <Input
                        id="telefono"
                        name="telefono"
                        type="tel"
                        maxLength={40}
                        defaultValue={ficha?.telefono ?? ''}
                        autoComplete="tel"
                      />
                    </div>
                  </>
                )}
              </div>

              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Tu nombre aparece en la cabecera, firmando lo que publicas en la
                comunidad y en el fichero de la congregación. Se guarda en los
                dos sitios a la vez.
              </p>

              <Button type="submit" formAction={guardarMisDatos} className="self-start">
                Guardar tus datos
              </Button>
            </section>
          </form>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-col gap-1">
                <h2 className="t-subtitulo">Cómo entras</h2>
                <p className="text-[13px] text-muted-foreground">
                  El correo y la contraseña con los que abres Hatril.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-alt px-4 py-3">
                <Mail
                  className="size-[17px] flex-none text-muted-foreground"
                  strokeWidth={1.7}
                />
                <span className="min-w-0 flex-1 truncate text-[14.5px]">
                  {ctx.user.email}
                </span>
              </div>

              {/*
               * El correo no se edita, y conviene decir por qué en vez de
               * dejar un campo gris sin explicación.
               *
               * Cambiarlo en Supabase Auth manda un enlace de confirmación al
               * correo NUEVO, y hasta que se pulsa la cuenta sigue con el
               * viejo. Ese envío lo hace hoy Supabase con su plantilla, no
               * Hatril: `src/lib/email/` está vacío y Resend no está montado.
               * Ofrecer aquí el cambio sería ofrecer un flujo que termina en un
               * correo que no controlamos, y si no llega, la persona se queda
               * sin saber con qué dirección entra.
               */}
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Para cambiar el correo escríbenos: hay que confirmarlo desde la
                dirección nueva y todavía no lo hacemos desde aquí.
              </p>

              <Button
                variant="outline"
                className="self-start"
                render={<Link href="/panel/cuenta/contrasena" />}
              >
                <KeyRound strokeWidth={1.8} />
                Cambiar la contraseña
              </Button>
            </section>

            {ctx.miembroId && (
              <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
                <h2 className="t-subtitulo">Tu ficha en la congregación</h2>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                  Lo que aquí cambias se refleja en el fichero de{' '}
                  {ctx.iglesia.nombre}. El resto de tu ficha —desde cuándo
                  vienes, en qué ministerios sirves— lo lleva quien administra.
                </p>
              </section>
            )}
          </div>
        </div>
      </Contenedor>
    </>
  );
}
