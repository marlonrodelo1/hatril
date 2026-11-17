import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ChevronRight,
  Church,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  User,
  UserX,
  Users,
} from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esDelEquipo, puedeGestionarMinisterio } from '@/lib/auth/permisos';
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
import { Fila } from '@/components/ui/fila';
import { salir } from '../../(auth)/actions';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { CuadroIcono, FilaBoton, FilaDato, Grupo } from './_components/ajustes';
import { FotoPerfil } from './_components/foto-perfil';
import { InterruptorAsistencia } from './_components/interruptor-asistencia';
import { cambiarPermisoAsistencia } from './actions';

export const metadata: Metadata = { title: 'Mi cuenta' };

const CONFIRMACIONES: Record<string, string> = {
  foto: 'Foto guardada.',
  'sin-foto': 'Foto quitada.',
  'asistencia-si': 'Gracias. La iglesia podrá apuntar cuándo vienes.',
  'asistencia-no': 'Permiso retirado. Ya no sales en las listas, y lo que había apuntado de ti se ha borrado.',
};

/**
 * Mi cuenta, ordenada como los ajustes del móvil: la cara arriba y debajo
 * grupos con la misma fila (`_components/ajustes.tsx`).
 *
 * El orden va de lo que más se mira a lo que casi nunca: tus datos y tus
 * equipos, ofrendar, privacidad, la sesión, y borrar la cuenta al final y
 * sola. Antes todo pesaba lo mismo —bloqueados y la política eran tan grandes
 * como tus equipos— y era una pantalla larga que costaba recorrer.
 *
 * No hay ningún naranja: aquí no hay una acción de la pantalla, cada fila es
 * la suya.
 */
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
  const correo = user!.email ?? '';

  /*
   * Cambiar la contraseña con la sesión abierta pide la actual, y esa
   * pantalla vive en el panel (`/panel/cuenta/contrasena`, con `requirePanel`):
   * a un miembro raso le devolvería aquí sin decirle nada. Para él, el camino
   * que sí tiene es el del correo, que es la prueba de identidad que le queda.
   * `esDelEquipo` es la misma pregunta que hace la puerta del panel, sin
   * consultar nada.
   */
  const contrasena = esDelEquipo(ctx)
    ? { href: '/panel/cuenta/contrasena', detalle: undefined }
    : { href: '/recuperar', detalle: 'Te mandamos un enlace a tu correo' };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Mi cuenta"
        subtitulo={ctx.iglesia.nombre}
        logoUrl={ctx.iglesia.logoUrl}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <FotoPerfil nombre={nombre} correo={correo} foto={miFoto} />

        <Grupo rotulo="Tus datos">
          <FilaDato icono={<User strokeWidth={1.8} />} etiqueta="Nombre">
            {nombre}
          </FilaDato>
          <FilaDato icono={<Mail strokeWidth={1.8} />} etiqueta="Correo">
            {correo}
          </FilaDato>
          {/* La web de la iglesia, que antes era un botón suelto: solo enlaza
              si la iglesia la tiene publicada. */}
          <FilaDato
            icono={<Church strokeWidth={1.8} />}
            etiqueta="Tu iglesia"
            href={ctx.iglesia.webPublica ? `/i/${ctx.iglesia.slug}` : undefined}
            fin={
              ctx.iglesia.webPublica ? (
                <span className="flex-none text-label text-muted-foreground">Ver su web</span>
              ) : undefined
            }
          >
            {ctx.iglesia.nombre}
          </FilaDato>
        </Grupo>

        <Grupo rotulo={ministerios.length === 1 ? 'Tu equipo' : 'Tus equipos'}>
          {ministerios.length === 0 ? (
            <li>
              <div className="flex items-center gap-3 px-4 py-3">
                <CuadroIcono>
                  <Users strokeWidth={1.8} />
                </CuadroIcono>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-body font-semibold">
                    Todavía no sirves en ningún equipo
                  </span>
                  <span className="text-pretty text-label text-muted-foreground">
                    Si te apetece echar una mano, díselo en persona el domingo:
                    eso no se pide por una aplicación.
                  </span>
                </span>
              </div>
            </li>
          ) : (
            ministerios.map((m) => {
              const color = colorDeMinisterio(m.colorHex);
              const rol =
                m.rolEnMinisterio ??
                (m.rolEquipo === 'responsable'
                  ? 'Responsable'
                  : m.rolEquipo === 'colider'
                    ? 'Colíder'
                    : 'Voluntario');
              return (
                <li key={m.id} className="border-b border-border last:border-b-0">
                  {/*
                   * A la portada del equipo en la propia app, la de la
                   * pestaña «Equipo». Quien lo lleva entra a sus
                   * herramientas; quien sirve sin llevarlo, a lo suyo: sus
                   * turnos, el próximo ensayo, la lista del domingo. Los dos
                   * van al mismo sitio, y lo que ven lo decide la portada.
                   *
                   * Con `puedeGestionarMinisterio` y no `esDelEquipo`: el
                   * voluntario que lleva la caja entra al panel, pero en ESTE
                   * equipo no tiene herramientas.
                   *
                   * Una fila propia y no la `Fila` de la base común por «Hacia
                   * dónde vamos», que no sale en ninguna otra pantalla de la
                   * app y necesita dos renglones enteros.
                   */}
                  <Link
                    href={rutaApp(m.id)}
                    className="group flex flex-col gap-1.5 px-4 py-3 text-foreground no-underline transition-colors duration-150 hover:bg-surface-alt hover:text-foreground hover:no-underline"
                  >
                    <span className="flex items-center gap-3">
                      {/* El color del equipo, en línea: sale de la base de
                          datos y Tailwind solo genera las clases que ve
                          escritas. */}
                      <span
                        aria-hidden
                        className="flex size-8 flex-none items-center justify-center rounded-lg"
                        style={{ background: color.suave }}
                      >
                        <span className="size-3 rounded-full" style={{ background: color.hex }} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-body font-semibold">{m.nombre}</span>
                        <span className="truncate text-label text-muted-foreground">{rol}</span>
                      </span>
                      <span className="flex-none text-label text-muted-foreground">
                        {puedeGestionarMinisterio(ctx, m.id) ? 'Abrir herramientas' : 'Ver tu equipo'}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="size-4 flex-none text-muted-foreground transition-transform duration-240 ease-hatril group-hover:translate-x-[3px] motion-reduce:transition-none"
                        strokeWidth={1.8}
                      />
                    </span>
                    {m.objetivo && (
                      <span className="line-clamp-2 pl-11 text-pretty text-label text-muted-foreground">
                        <span className="font-semibold">Hacia dónde vamos: </span>
                        {m.objetivo}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })
          )}
        </Grupo>

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
          <Grupo
            rotulo="Ofrendar"
            nota={`La cuenta de ${ctx.iglesia.nombre}. El dinero va directo a ella: Hatril no cobra nada por su cuenta ni se queda comisión.`}
          >
            <FilaDato icono={<Landmark strokeWidth={1.8} />} etiqueta="Cuenta" copiable>
              {donativos.cuenta}
            </FilaDato>
            {donativos.titular && (
              <FilaDato icono={<User strokeWidth={1.8} />} etiqueta="Titular" copiable>
                {donativos.titular}
              </FilaDato>
            )}
          </Grupo>
        )}

        {/*
         * Privacidad a mano dentro de la app (Apple 5.1.1(i)), y las personas
         * bloqueadas, que la hoja de bloquear promete que se deshacen aquí.
         */}
        <Grupo rotulo="Privacidad">
          {/*
           * El permiso de asistencia, que el texto de la casilla promete poder
           * retirar «cuando quiera». Sin ficha no hay a qué colgarlo, y la
           * fila no sale.
           *
           * El MISMO formulario de siempre, y el interruptor es su botón:
           * con el permiso dado se envía vacío y lo retira; sin él lleva
           * `asistencia=on` y lo da. Lo que se autoriza y lo que pasa al
           * retirarlo se quedan escritos debajo, a la vista: un toque en el
           * interruptor retira el permiso y borra lo apuntado, y eso no puede
           * pasar sin haberlo leído.
           */}
          {ctx.miembroId && (
            <li className="border-b border-border last:border-b-0">
              <form action={cambiarPermisoAsistencia}>
                {!consentimiento.asistenciaAceptada && (
                  <input type="hidden" name="asistencia" value="on" />
                )}
                <InterruptorAsistencia dado={consentimiento.asistenciaAceptada} />
              </form>
              <div className="flex flex-col gap-1.5 pr-4 pb-3.5 pl-[60px] text-pretty text-label text-muted-foreground">
                <p>{TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO}</p>
                {consentimiento.asistenciaAceptada && (
                  <p className="font-semibold text-foreground">
                    Al retirarlo se borra lo que la iglesia tenía apuntado de tu
                    asistencia y de las veces que te contactaron.
                  </p>
                )}
              </div>
            </li>
          )}
          <Fila
            href="/mi/cuenta/bloqueados"
            inicio={
              <CuadroIcono>
                <UserX strokeWidth={1.8} />
              </CuadroIcono>
            }
            titulo="Personas bloqueadas"
            fin={
              <span className="flex-none text-label text-muted-foreground">
                {bloqueos.length === 0
                  ? 'Nadie'
                  : bloqueos.length === 1
                    ? '1 persona'
                    : `${bloqueos.length} personas`}
              </span>
            }
          />
          <Fila
            href="/privacidad"
            inicio={
              <CuadroIcono>
                <ShieldCheck strokeWidth={1.8} />
              </CuadroIcono>
            }
            titulo="Política de privacidad"
            detalle="Qué datos se guardan y para qué"
          />
        </Grupo>

        <Grupo rotulo="Sesión">
          <Fila
            href={contrasena.href}
            inicio={
              <CuadroIcono>
                <KeyRound strokeWidth={1.8} />
              </CuadroIcono>
            }
            titulo="Cambiar la contraseña"
            detalle={contrasena.detalle}
          />
          <li className="border-b border-border last:border-b-0">
            <form action={salir}>
              <FilaBoton icono={<LogOut strokeWidth={1.8} />} titulo="Cerrar sesión" />
            </form>
          </li>
        </Grupo>

        {/*
         * Al final y sola, en rojo: es lo único de la pantalla que no se
         * deshace con otro toque. Lleva a `/mi/cuenta/borrar`, que cuenta lo
         * que pasa y pide la contraseña; aquí no se confirma nada más, que
         * sería pedirlo dos veces.
         */}
        <Grupo>
          <Fila
            href="/mi/cuenta/borrar"
            inicio={
              <CuadroIcono peligro>
                <Trash2 strokeWidth={1.8} />
              </CuadroIcono>
            }
            titulo={<span className="text-danger">Borrar mi cuenta</span>}
            detalle="Se borra del todo a los 30 días"
          />
        </Grupo>
      </main>
    </div>
  );
}
