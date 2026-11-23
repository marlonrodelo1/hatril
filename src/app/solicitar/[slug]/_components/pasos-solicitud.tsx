'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, HouseHeart } from 'lucide-react';
import { clsx } from 'clsx';

import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import { ReglaPassword, cumpleReglaPassword } from './regla-password';

/**
 * La solicitud, en pasos: «Tus datos», «Tu contraseña» y «Los permisos».
 *
 * LOS PASOS SON SOLO DE LA PANTALLA
 * ---------------------------------
 * Hay UN `<form>` con todos los campos dentro, con los mismos `name` de
 * siempre, y se envía entero al final a la action de siempre
 * (`solicitar/actions.ts`, que no sabe que existen pasos). Un paso que no se ve
 * está escondido con CSS, no desmontado: un campo con `display: none` viaja en
 * el envío igual, y uno desmontado no viajaría.
 *
 * SIN JAVASCRIPT, LOS TRES SEGUIDOS
 * ---------------------------------
 * Lo que esconde los pasos de más es `@media (scripting: enabled)`, no un
 * estado de React. Sin JavaScript esa consulta no casa: se ven los tres pasos
 * uno debajo de otro, cada uno con su título, sin «Seguir» (que no haría nada)
 * y con el «Enviar» del final, y el navegador valida con los `required` de
 * siempre. Con JavaScript, el primer pintado ya sale con un solo paso, sin el
 * parpadeo que daría esperar a que React arranque para esconder los otros.
 *
 * Con JavaScript el formulario pasa a `noValidate` y valida esto, paso a paso:
 * los globos del navegador saldrían en inglés en algunos, y no llegan a un
 * campo escondido.
 *
 * Con sesión no hay contraseña que pedir, y son dos pasos.
 *
 * CON LA INVITACIÓN DE UNA CÉLULA
 * -------------------------------
 * El enlace de una célula trae su código (`?grupo=`). Viaja en un campo oculto
 * y en cada vuelta —crear la cuenta, entrar con Google, «¿Ya tienes cuenta?»—,
 * porque perderlo era perder la célula sin que la persona lo supiera. Aquí
 * solo se dice; quién lo valida y lo guarda es `registrarSolicitud`.
 */

type Paso = 'datos' | 'password' | 'permisos';

const TITULOS: Record<Paso, string> = {
  datos: 'Tus datos',
  password: 'Tu contraseña',
  permisos: 'Los permisos',
};

type Errores = Partial<Record<'nombre' | 'email' | 'telefono', string>>;

/** El paso que no es el actual: escondido solo si hay JavaScript. */
const SOLO_SIN_JS = '[@media(scripting:enabled)]:hidden';
const SOLO_CON_JS = '[@media(scripting:none)]:hidden';

const CLASE_SELECT =
  'h-[42px] flex-none rounded-lg border border-input bg-surface-alt px-3 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16 md:text-[15px]';

const CLASE_TEXTAREA =
  'w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16 md:text-[15px]';

const sinSuscripcion = () => () => {};
const siempre = () => true;
const nunca = () => false;

export function PasosSolicitud({
  slug,
  nombreIglesia,
  paisIglesia,
  conSesion,
  nombreSugerido,
  error,
  accion,
  permisos,
  accesoRapido,
  invitacion,
}: {
  slug: string;
  nombreIglesia: string;
  paisIglesia: string;
  /** Con sesión no se crea cuenta: ni correo ni contraseña. */
  conSesion: boolean;
  nombreSugerido: string;
  error?: string;
  accion: (formData: FormData) => Promise<void>;
  /** El tercer paso, con los textos legales ya escritos en el servidor. */
  permisos: ReactNode;
  /**
   * «Continuar con Google / Apple», solo sin sesión y en el primer paso. Va
   * FUERA del formulario de los pasos: el de Google en la web es otro
   * `<form>`, y un formulario dentro de otro no es HTML válido.
   */
  accesoRapido?: ReactNode;
  /** La célula del enlace, ya resuelta contra esta iglesia en el servidor. */
  invitacion?: { codigo: string; nombre: string };
}) {
  // A dónde se vuelve sin perder la invitación.
  const aqui = `/solicitar/${slug}${invitacion ? `?grupo=${invitacion.codigo}` : ''}`;
  const pasos: Paso[] = conSesion
    ? ['datos', 'permisos']
    : ['datos', 'password', 'permisos'];
  const ultimo = pasos.length - 1;

  const [paso, setPaso] = useState(0);
  // Falso en el servidor y al hidratar, verdadero en cuanto React ha
  // arrancado: es lo que dice si la validación de aquí ya funciona.
  const hidratado = useSyncExternalStore(sinSuscripcion, siempre, nunca);
  const [errores, setErrores] = useState<Errores>({});
  const [fallosPassword, setFallosPassword] = useState(0);
  const [faltaPermiso, setFaltaPermiso] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const seccionesRef = useRef<(HTMLElement | null)[]>([]);
  // Hacia dónde se movió el último cambio de paso: el contenido entra por la
  // derecha al avanzar y por la izquierda al volver.
  const direccion = useRef<1 | -1>(1);
  // El paso del último pintado. Comparar con él y no con un «es el primero»:
  // en desarrollo React monta dos veces, y el segundo montaje se tomaría por
  // un cambio de paso (foco al título y animación nada más abrir).
  const pasoPintado = useRef(paso);

  useEffect(() => {
    if (pasoPintado.current === paso) return;
    pasoPintado.current = paso;

    // El foco al título del paso: el lector de pantalla anuncia dónde se ha
    // llegado, y la página sube hasta él si el paso anterior era largo.
    tituloRef.current?.focus();

    const seccion = seccionesRef.current[paso];
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seccion && !reducido) {
      // Con la API de animaciones y no con una clase: la de `globals.css`
      // entra de abajo (`anim-aparece`), y el paso tiene que entrar de lado.
      // Las mismas medidas que la base común: 240 ms y su curva.
      seccion.animate(
        [
          { opacity: 0, transform: `translateX(${14 * direccion.current}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
  }, [paso]);

  function irA(destino: number) {
    direccion.current = destino > paso ? 1 : -1;
    setPaso(destino);
  }

  function campo(nombre: string) {
    return formRef.current?.elements.namedItem(nombre) as
      | HTMLInputElement
      | null
      | undefined;
  }

  /**
   * ¿Se puede salir de este paso? Pinta los errores y, si no se puede y es el
   * paso que se ve, lleva el foco al primer campo que falla.
   *
   * Algo más estricto que el servidor en dos cosas, las dos del diseño
   * aprobado: el nombre pide nombre y apellido (el campo ya decía «Nombre
   * completo») y el teléfono, siete cifras. Lo demás es la misma regla que
   * `actions.ts` y `validarPassword`, adelantada.
   */
  function validar(i: number): boolean {
    const cual = pasos[i];

    if (cual === 'datos') {
      const e: Errores = {};
      const nombre = campo('nombre')?.value.trim() ?? '';
      if (!/\S+\s+\S+/.test(nombre)) e.nombre = 'Escribe tu nombre y apellido.';

      if (!conSesion) {
        const email = campo('email')?.value.trim() ?? '';
        if (!email) e.email = 'Escribe tu correo.';
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
          e.email = 'Ese correo no parece bien escrito.';
      }

      const cifras = (campo('telefono')?.value ?? '').replace(/\D/g, '');
      if (!cifras) e.telefono = 'Falta el teléfono.';
      else if (cifras.length < 7) e.telefono = 'A ese teléfono le faltan números.';

      setErrores(e);
      const primero = (['nombre', 'email', 'telefono'] as const).find((n) => e[n]);
      if (primero && i === paso) campo(primero)?.focus();
      return !primero;
    }

    if (cual === 'password') {
      const ok = cumpleReglaPassword(campo('password')?.value ?? '');
      if (!ok) {
        setFallosPassword((n) => n + 1);
        if (i === paso) campo('password')?.focus();
      }
      return ok;
    }

    const ok = Boolean(campo('consentimiento')?.checked);
    setFaltaPermiso(!ok);
    return ok;
  }

  function seguir() {
    if (validar(paso)) irA(paso + 1);
  }

  /**
   * Enter en un campo envía el formulario. Antes del último paso eso es
   * «Seguir»; en el último se repasan TODOS, por si algo se escapó, y si uno
   * falla se vuelve a él en lugar de enviar.
   */
  function alEnviar(e: FormEvent<HTMLFormElement>) {
    if (paso < ultimo) {
      e.preventDefault();
      seguir();
      return;
    }
    for (let i = 0; i < pasos.length; i++) {
      if (!validar(i)) {
        e.preventDefault();
        if (i !== paso) irA(i);
        return;
      }
    }
  }

  /** El error de un campo se va en cuanto se vuelve a escribir en él. */
  function alCambiar(e: FormEvent<HTMLFormElement>) {
    const nombre = (e.target as HTMLInputElement).name;
    if (nombre in errores) setErrores((prev) => ({ ...prev, [nombre]: undefined }));
    if (nombre === 'consentimiento' && faltaPermiso) setFaltaPermiso(false);
  }

  /**
   * React vacía el formulario cuando la action termina. Si vuelve con un error
   * (el correo ya tiene cuenta, por ejemplo), los campos están en blanco otra
   * vez y hay que empezar por el principio, no quedarse en «Los permisos».
   */
  function alVaciar() {
    direccion.current = -1;
    setPaso(0);
    setErrores({});
    setFallosPassword(0);
    setFaltaPermiso(false);
  }

  return (
    <>
      {/* A qué iglesia se pide entrar, siempre a la vista. La flecha vuelve
          al paso anterior, y desde el primero, a la ficha. */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center gap-1 px-2">
          <Link
            href={`/iglesia/${slug}`}
            onClick={(e) => {
              if (paso > 0) {
                e.preventDefault();
                irA(paso - 1);
              }
            }}
            aria-label={paso > 0 ? 'Volver al paso anterior' : 'Volver a la ficha de la iglesia'}
            className="flex size-11 flex-none items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Link>
          <h1 className="min-w-0 truncate text-body">
            <span className="text-muted-foreground">Pides entrar en </span>
            <span className="font-semibold">{nombreIglesia}</span>
          </h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-5 pt-5">
        {error && <Aviso>{error}</Aviso>}

        {invitacion && paso === 0 && (
          <p className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-label text-pretty">
            <HouseHeart className="mt-0.5 size-5 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
            <span>
              {/* Las condiciones son las de la aprobación (`motivoDeLaInvitacion`):
                  prometer el grupo sin más era prometer de más. Y lo del
                  teléfono, porque quien lleva la célula lo verá (decidido el
                  23-nov). */}
              Vienes con la invitación de <strong className="font-semibold">{invitacion.nombre}</strong>.
              Cuando {nombreIglesia} apruebe tu solicitud verás lo de toda la iglesia, y
              quedarás en ese grupo si para entonces sigue abierto y con este enlace.
              Quien lo lleva verá tu nombre y tu teléfono, para poder llamarte.
            </span>
          </p>
        )}

        {/* Con Google o Apple se ahorra el correo y la contraseña: entra, y
            vuelve aquí ya con sesión, al formulario corto (nombre, teléfono y
            permisos). Lo pidió Marlon el 19-nov: elegir la iglesia, pulsar
            «Pedir unirme» y AHÍ iniciar sesión. */}
        {!conSesion && paso === 0 && accesoRapido && (
          <div className="flex flex-col gap-4">{accesoRapido}</div>
        )}

        {/* La cabecera de los pasos: cuál, cuántos, y la barra que se llena.
            Sin JavaScript no significa nada y cada paso lleva su título. */}
        <div className={clsx('flex flex-col gap-2', SOLO_CON_JS)}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 ref={tituloRef} tabIndex={-1} className="text-body font-semibold outline-none">
              {TITULOS[pasos[paso]!]}
            </h2>
            <span className="text-label text-muted-foreground tabular-nums">
              Paso {paso + 1} de {pasos.length}
            </span>
          </div>
          <div
            aria-hidden
            className={clsx('grid gap-1', pasos.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}
          >
            {pasos.map((p, i) => (
              <span key={p} className="h-1 overflow-hidden rounded-full bg-surface-active">
                <span
                  className={clsx(
                    'block h-full origin-left bg-primary transition-transform duration-240 ease-hatril motion-reduce:transition-none',
                    i <= paso ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>
            ))}
          </div>
        </div>

        <form
          ref={formRef}
          action={accion}
          noValidate={hidratado}
          onSubmit={alEnviar}
          onChange={alCambiar}
          onReset={alVaciar}
          className="flex flex-col gap-8"
        >
          <input type="hidden" name="slug" value={slug} />
          {invitacion && <input type="hidden" name="grupo" value={invitacion.codigo} />}

          {pasos.map((p, i) => (
            <section
              key={p}
              ref={(el) => {
                seccionesRef.current[i] = el;
              }}
              className={clsx('flex flex-col gap-4', i !== paso && SOLO_SIN_JS)}
            >
              <h2 className={clsx('flex items-baseline justify-between gap-3', SOLO_SIN_JS)}>
                <span className="text-body font-semibold">{TITULOS[p]}</span>
                <span className="text-label font-normal text-muted-foreground">
                  Paso {i + 1} de {pasos.length}
                </span>
              </h2>

              {p === 'datos' && (
                <>
                  <p className="text-label text-pretty text-muted-foreground">
                    {conSesion
                      ? 'El pastor verá lo que escribas aquí y te avisaremos cuando responda.'
                      : 'Con tu cuenta el pastor sabrá quién eres y podrás entrar cuando te acepte.'}
                  </p>
                  <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
                    <Campo etiqueta="Nombre completo" htmlFor="nombre" error={errores.nombre}>
                      <Input
                        id="nombre"
                        name="nombre"
                        required
                        maxLength={120}
                        autoComplete="name"
                        defaultValue={nombreSugerido}
                        aria-invalid={errores.nombre ? true : undefined}
                      />
                    </Campo>

                    {!conSesion && (
                      <Campo etiqueta="Correo electrónico" htmlFor="email" error={errores.email}>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          aria-invalid={errores.email ? true : undefined}
                        />
                      </Campo>
                    )}

                    <Campo
                      etiqueta="Teléfono"
                      htmlFor="telefono"
                      ayuda={
                        invitacion
                          ? `Para que tu iglesia y quien lleva ${invitacion.nombre} puedan contactarte.`
                          : 'Solo para que tu iglesia pueda contactarte.'
                      }
                      error={errores.telefono}
                    >
                      <div className="flex gap-2">
                        <select
                          name="prefijo"
                          aria-label="Prefijo del país"
                          defaultValue={paisIglesia === 'ES' ? 'ES' : 'CO'}
                          className={CLASE_SELECT}
                        >
                          <option value="ES">ES +34</option>
                          <option value="CO">CO +57</option>
                        </select>
                        <Input
                          id="telefono"
                          name="telefono"
                          type="tel"
                          required
                          maxLength={40}
                          autoComplete="tel-national"
                          aria-invalid={errores.telefono ? true : undefined}
                        />
                      </div>
                    </Campo>

                    <Campo etiqueta="Dirección" htmlFor="direccion" opcional>
                      <Input
                        id="direccion"
                        name="direccion"
                        maxLength={240}
                        autoComplete="street-address"
                      />
                    </Campo>

                    <Campo etiqueta="Mensaje para el pastor" htmlFor="mensaje" opcional>
                      <textarea
                        id="mensaje"
                        name="mensaje"
                        rows={3}
                        maxLength={600}
                        placeholder="Vengo los domingos desde marzo, me presentó Marta."
                        className={CLASE_TEXTAREA}
                      />
                    </Campo>
                  </div>
                </>
              )}

              {p === 'password' && (
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
                  <Campo etiqueta="Contraseña" htmlFor="password">
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      aria-describedby="regla-password"
                    />
                    <ReglaPassword idCampo="password" fallos={fallosPassword} />
                  </Campo>
                </div>
              )}

              {p === 'permisos' && (
                <>
                  {permisos}
                  {faltaPermiso && (
                    <div className="anim-aparece">
                      <Aviso>Para unirte hace falta el primer permiso.</Aviso>
                    </div>
                  )}
                </>
              )}

              {/* Antes del último paso, sin JavaScript esta fila se queda sin
                  nada que hacer: fuera entera, no solo sus botones. */}
              <div className={clsx('flex gap-2', i < ultimo && SOLO_CON_JS)}>
                {i > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Paso anterior"
                    onClick={() => irA(i - 1)}
                    className={clsx('size-11', SOLO_CON_JS)}
                  >
                    <ArrowLeft strokeWidth={1.8} />
                  </Button>
                )}
                {i < ultimo ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={seguir}
                    className={clsx('flex-1', SOLO_CON_JS)}
                  >
                    Seguir
                  </Button>
                ) : (
                  <BotonEnviar size="lg" pendiente="Enviando…" className="flex-1">
                    Enviar solicitud
                  </BotonEnviar>
                )}
              </div>

              {i === ultimo && (
                <p className="text-center text-label text-pretty text-muted-foreground">
                  Hasta que el pastor lo apruebe no verás nada de la congregación, y
                  ellos solo verán lo que has escrito aquí.
                </p>
              )}
            </section>
          ))}
        </form>

        {!conSesion && (
          <p className="pb-2 text-center text-body text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link
              href={`/acceso?next=${encodeURIComponent(aqui)}`}
              className="font-semibold text-foreground underline underline-offset-2 hover:text-foreground"
            >
              Entra
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
