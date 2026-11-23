import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import {
  Baby,
  ChevronRight,
  Church,
  ExternalLink,
  HandHeart,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  ReceiptText,
  ShieldCheck,
  Trash2,
  User,
  UserX,
  Users,
} from 'lucide-react';

import { TEXTO_CONSENTIMIENTO_ASISTENCIA_Y_SEGUIMIENTO } from '@/lib/rgpd/consentimiento';
import { Aviso } from '@/components/aviso';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { formatearEuros } from '@/lib/donativos/calculo';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { Fila } from '@/components/ui/fila';
import { TarjetaMiGrupo } from '@/components/grupos/mi-grupo';
import { salir } from '../../../(auth)/actions';
import { CuadroIcono, FilaBoton, FilaDato, Grupo } from './ajustes';
import { FotoPerfil } from './foto-perfil';
import { InterruptorAsistencia } from './interruptor-asistencia';
import { cambiarPermisoAsistencia } from '../actions';
import type { datosDeMiCuenta } from '../datos';

/**
 * Lo que pinta Mi cuenta, sin consultar nada.
 *
 * Salió de `../page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`), cada una con sus datos (`datosDeMiCuenta`). El
 * porqué de cada pieza está en esa página.
 *
 * Dos cosas llegan de fuera porque cambian entre la web y la app:
 *
 *   - `EnlaceDar`: el enlace a la página de dar. En la web es `EnlaceADar`,
 *     que en el iPhone abre Safari mirando el User-Agent; en la app, uno que
 *     abre SIEMPRE fuera (norma 3.2.2 de Apple).
 *   - `urlWebIglesia`: la web de la iglesia. La app la pasa entera, para
 *     abrirla en el navegador.
 */
const CONFIRMACIONES: Record<string, string> = {
  foto: 'Foto guardada.',
  'sin-foto': 'Foto quitada.',
  'asistencia-si': 'Gracias. La iglesia podrá apuntar cuándo vienes.',
  'asistencia-no': 'Permiso retirado. Ya no sales en las listas, y lo que había apuntado de ti se ha borrado.',
};

export type DatosDeMiCuenta = Awaited<ReturnType<typeof datosDeMiCuenta>>;

type PropsEnlaceDar = { href: string; className?: string; children: ReactNode };

export function VistaCuenta({
  cabecera,
  EnlaceDar,
  urlWebIglesia,
  error,
  guardado,
  iglesia,
  miembroId,
  gestiona,
  ministerios,
  grupos,
  hoy,
  donativos,
  bloqueos,
  miFoto,
  consentimiento,
  dar,
  hayOfrendar,
  yaDio,
  totalDelAnio,
  notaOfrendar,
  nombre,
  correo,
  contrasena,
  misHijos,
}: DatosDeMiCuenta & {
  cabecera: ReactNode;
  EnlaceDar: ComponentType<PropsEnlaceDar>;
  urlWebIglesia?: string;
  error?: string;
  guardado?: string;
  /**
   * «Mis hijos» del ministerio de Niños. Solo lo pasa la app (`movil/`), y
   * solo si la iglesia tiene el tablón encendido: lo de los padres no va en
   * la web `/mi` (`plan-ninos.md` §6), así que la web no cambia.
   */
  misHijos?: { detalle: string } | null;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

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
            href={iglesia.webPublica ? (urlWebIglesia ?? `/i/${iglesia.slug}`) : undefined}
            fin={
              iglesia.webPublica ? (
                <span className="flex-none text-label text-muted-foreground">Ver su web</span>
              ) : undefined
            }
          >
            {iglesia.nombre}
          </FilaDato>
        </Grupo>

        {/*
         * Su célula, antes que sus equipos: es lo que más gente tiene, y para
         * quien va a una sin servir en nada es lo único suyo de esta pantalla.
         * Sin sección si no está en ninguna: no se le ofrece apuntarse, eso es
         * cosa de su red o de un enlace de invitación.
         */}
        {grupos.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="t-micro px-1">
              {grupos.length === 1
                ? `Tu ${grupos[0]!.etiquetas.uno}`
                : `Tus ${grupos[0]!.etiquetas.varios}`}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {grupos.map((g) => (
                <TarjetaMiGrupo key={g.grupoId} grupo={g} hoy={hoy} />
              ))}
            </ul>
          </section>
        )}

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
                        {gestiona.includes(m.id) ? 'Abrir herramientas' : 'Ver tu equipo'}
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
         * Ofrendar solo se pinta si la iglesia tiene a dónde: tarjeta (su
         * cuenta de Stripe conectada) o una cuenta para transferencias. Un
         * botón que al pulsarlo dice «tu iglesia todavía no ha configurado
         * esto» le pasa el problema a quien no puede resolverlo.
         *
         * Por Hatril sigue sin pasar dinero, que es lo que `/privacidad` §3
         * promete: la tarjeta se cobra en la cuenta de Stripe de la iglesia, y
         * la transferencia es el mismo número que ella publica en su web.
         *
         * El `id` es el ancla del «Dar» de la cabecera cuando solo hay
         * transferencia.
         */}
        {hayOfrendar && (
          <Grupo id="ofrendar" rotulo="Ofrendar" nota={notaOfrendar}>
            {dar.conTarjeta && (
              <li className="border-b border-border last:border-b-0">
                {/* El icono de enlace externo avisa de que se sale: en la app
                    del iPhone esto abre Safari (`EnlaceADar` cuenta por qué). */}
                <EnlaceDar
                  href={`/i/${iglesia.slug}/dar`}
                  className="group flex items-center gap-3 px-4 py-3 text-foreground no-underline transition-colors duration-150 hover:bg-surface-alt hover:text-foreground hover:no-underline"
                >
                  <CuadroIcono>
                    <HandHeart strokeWidth={1.8} />
                  </CuadroIcono>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-label text-muted-foreground">Con tarjeta</span>
                    <span className="truncate text-body font-semibold">
                      Dar a {iglesia.nombre}
                    </span>
                  </span>
                  <ExternalLink
                    aria-hidden
                    className="size-4 flex-none text-muted-foreground"
                    strokeWidth={1.8}
                  />
                </EnlaceDar>
              </li>
            )}
            {(dar.conTarjeta || yaDio) && (
              <Fila
                href="/mi/cuenta/donativos"
                inicio={
                  <CuadroIcono>
                    <ReceiptText strokeWidth={1.8} />
                  </CuadroIcono>
                }
                titulo="Lo que he dado"
                detalle={
                  totalDelAnio > 0 ? `Este año, ${formatearEuros(totalDelAnio)}` : undefined
                }
              />
            )}
            {donativos && (
              <FilaDato icono={<Landmark strokeWidth={1.8} />} etiqueta="Cuenta" copiable>
                {donativos.cuenta}
              </FilaDato>
            )}
            {donativos?.titular && (
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
        {misHijos && (
          <Grupo rotulo="Familia">
            <Fila
              href="/mi/hijos"
              inicio={
                <CuadroIcono>
                  <Baby strokeWidth={1.8} />
                </CuadroIcono>
              }
              titulo="Mis hijos en Niños"
              detalle={misHijos.detalle}
            />
          </Grupo>
        )}

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
          {miembroId && (
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
