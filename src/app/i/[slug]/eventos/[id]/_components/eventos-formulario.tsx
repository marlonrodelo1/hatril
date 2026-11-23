'use client';

import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { CircleAlert } from 'lucide-react';
import { clsx } from 'clsx';

import { Aviso } from '@/components/aviso';
import { buttonVariants } from '@/components/ui/button';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';

/**
 * «Apuntarme» y el formulario de siempre, en la página del evento.
 *
 * LA SERVER ACTION NO CAMBIA, NI SUS CAMPOS
 * -----------------------------------------
 * `inscribirse` (`../actions.ts`) sigue siendo la que valida de verdad, con su
 * Zod y su función de Postgres. Esto solo adelanta dos errores —nombre y
 * correo, al salir del campo— y la casilla al enviar, para que no haya que
 * esperar a la vuelta del servidor y perder lo escrito. Los `name` son los de
 * siempre: `nombre`, `email`, `telefono`, `acompanantes`, `nota`,
 * `consentimiento`. Los mensajes, los mismos que da el servidor.
 *
 * UN SOLO NARANJA EN PANTALLA: POR ESO `<details>`
 * ------------------------------------------------
 * «Apuntarme» abre el formulario y el formulario acaba en otro «Apuntarme».
 * Los dos a la vez serían dos botones naranjas (regla 1), así que el primero
 * es el `<summary>` y se esconde al abrir. Con `<details>` y no con un
 * `useState` porque funciona aunque el JavaScript no llegue: un móvil con mala
 * cobertura sigue pudiendo apuntarse. Si el servidor devolvió un error, se
 * pinta ya abierto.
 *
 * `noValidate`: los globos nativos del navegador saldrían en el idioma del
 * sistema y con su propio dibujo; los errores van pegados al campo y con
 * icono, como en el resto de Hatril.
 */

const MENSAJES = {
  nombre: 'Escribe tu nombre.',
  email: 'Ese correo no parece válido.',
  consentimiento:
    'Tienes que aceptar que la iglesia guarde tus datos para el evento.',
} as const;

type Errores = Partial<Record<keyof typeof MENSAJES, string>>;

function revisarNombre(valor: string) {
  // El mismo mínimo que el Zod del servidor: dos letras.
  return valor.trim().length >= 2 ? undefined : MENSAJES.nombre;
}

function revisarCorreo(valor: string) {
  // Laxo a propósito: solo caza lo evidente (falta la arroba o el dominio).
  // El que decide es el `.email()` del servidor.
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor.trim())
    ? undefined
    : MENSAJES.email;
}

export function EventosFormulario({
  accion,
  titulo,
  error,
  maxAcompanantes,
  consentimiento,
  informacion,
}: {
  accion: (formData: FormData) => Promise<void>;
  titulo: string;
  /** El error que devolvió la server action por la query string. */
  error?: string;
  maxAcompanantes: number;
  /** El texto de la casilla, con su enlace a la política. */
  consentimiento: ReactNode;
  /** La primera capa del art. 13, que pinta el servidor. */
  informacion: ReactNode;
}) {
  const [errores, setErrores] = useState<Errores>({});
  const formulario = useRef<HTMLFormElement>(null);

  function poner(campo: keyof Errores, mensaje: string | undefined) {
    setErrores((antes) =>
      antes[campo] === mensaje ? antes : { ...antes, [campo]: mensaje },
    );
  }

  function alAbrir(e: SyntheticEvent<HTMLDetailsElement>) {
    // Al abrir con el teclado, el `<summary>` desaparece y el foco se iría al
    // `<body>`: se lleva al primer campo, que es donde iba a ir la persona.
    if (e.currentTarget.open && !error) {
      formulario.current
        ?.querySelector<HTMLInputElement>('input[name="nombre"]')
        ?.focus({ preventScroll: true });
    }
  }

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    const datos = new FormData(e.currentTarget);
    const nuevos: Errores = {
      nombre: revisarNombre(String(datos.get('nombre') ?? '')),
      email: revisarCorreo(String(datos.get('email') ?? '')),
      consentimiento:
        datos.get('consentimiento') === 'on'
          ? undefined
          : MENSAJES.consentimiento,
    };
    setErrores(nuevos);

    const primero = (['nombre', 'email', 'consentimiento'] as const).find(
      (c) => nuevos[c],
    );
    if (primero) {
      // `preventDefault` en `onSubmit` es lo que impide que React lance la
      // action: sin él, se enviaría igual con el error en pantalla.
      e.preventDefault();
      e.currentTarget
        .querySelector<HTMLInputElement>(`[name="${primero}"]`)
        ?.focus();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <details
        open={Boolean(error)}
        onToggle={alAbrir}
        className="group peer open:w-full"
      >
        <summary
          className={clsx(
            buttonVariants({ size: 'lg' }),
            'w-fit list-none group-open:hidden [&::-webkit-details-marker]:hidden',
          )}
        >
          Apuntarme
        </summary>

        <section
          id="apuntarse"
          className="anim-aparece flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 className="t-subtitulo text-pretty">Apuntarte a {titulo}</h2>
            <p className="text-label text-muted-foreground">
              No hace falta tener cuenta.
            </p>
          </div>

          {error && <Aviso>{error}</Aviso>}

          <form
            ref={formulario}
            action={accion}
            onSubmit={alEnviar}
            noValidate
            className="flex flex-col gap-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo etiqueta="Tu nombre" htmlFor="nombre" error={errores.nombre}>
                <Input
                  id="nombre"
                  name="nombre"
                  required
                  maxLength={120}
                  autoComplete="name"
                  aria-invalid={errores.nombre ? true : undefined}
                  onBlur={(e) => poner('nombre', revisarNombre(e.currentTarget.value))}
                  // Con el error ya a la vista, se quita en cuanto se arregla;
                  // pero no se pone mientras se escribe la primera vez.
                  onChange={(e) =>
                    errores.nombre &&
                    poner('nombre', revisarNombre(e.currentTarget.value))
                  }
                />
              </Campo>

              <Campo etiqueta="Tu correo" htmlFor="email" error={errores.email}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  required
                  maxLength={200}
                  autoComplete="email"
                  aria-invalid={errores.email ? true : undefined}
                  onBlur={(e) => poner('email', revisarCorreo(e.currentTarget.value))}
                  onChange={(e) =>
                    errores.email &&
                    poner('email', revisarCorreo(e.currentTarget.value))
                  }
                />
              </Campo>

              <Campo etiqueta="Teléfono" htmlFor="telefono" opcional>
                <Input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  maxLength={32}
                  autoComplete="tel"
                />
              </Campo>

              <Campo etiqueta="¿Vienes con alguien?" htmlFor="acompanantes">
                {/* Un `select` nativo con los números de siempre como valor: la
                    action hace `Number()` del texto y lo acota al tope, así que
                    no cambia nada al otro lado. Letra de 16 en el móvil, como
                    `<Input>`, para que Safari no amplíe. */}
                <select
                  id="acompanantes"
                  name="acompanantes"
                  defaultValue="0"
                  className="h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 text-base outline-none md:text-body focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16"
                >
                  <option value="0">Voy solo</option>
                  {Array.from({ length: maxAcompanantes }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={String(n)}>
                        Con {n} {n === 1 ? 'persona' : 'personas'} más
                      </option>
                    ),
                  )}
                </select>
              </Campo>
            </div>

            <Campo etiqueta="¿Quieres decirles algo?" htmlFor="nota" opcional>
              <textarea
                id="nota"
                name="nota"
                rows={3}
                maxLength={500}
                className="w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-base outline-none md:text-body focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16"
              />
            </Campo>

            <div className="flex flex-col gap-1.5">
              {/* Casilla NATIVA, no la de shadcn. La de Base UI guarda el valor
                  en estado de React y necesita un input oculto para que viaje
                  en el envío; para el dato del art. 9, cuanto menos
                  intermediario mejor. Está estilizada en `globals.css`. */}
              <label className="flex items-start gap-2.5 text-label leading-relaxed text-foreground">
                <input
                  type="checkbox"
                  name="consentimiento"
                  required
                  aria-invalid={errores.consentimiento ? true : undefined}
                  onChange={(e) =>
                    errores.consentimiento &&
                    poner(
                      'consentimiento',
                      e.currentTarget.checked ? undefined : MENSAJES.consentimiento,
                    )
                  }
                  className="mt-0.5 flex-none"
                />
                <span>{consentimiento}</span>
              </label>
              {errores.consentimiento && (
                <span
                  role="alert"
                  className="anim-aparece flex items-center gap-1.5 text-label font-semibold text-badge-danger-fg"
                >
                  <CircleAlert className="size-[15px] flex-none" strokeWidth={1.8} />
                  {errores.consentimiento}
                </span>
              )}
            </div>

            {informacion}

            <BotonEnviar pendiente="Apuntando…" size="lg" className="w-fit">
              Apuntarme
            </BotonEnviar>
          </form>
        </section>
      </details>

      {/* Al lado del botón mientras está cerrado; al abrir lo dice el propio
          formulario. `peer-open` lee el `open` del `<details>` de al lado. */}
      <p className="text-label text-muted-foreground peer-open:hidden">
        No hace falta tener cuenta.
      </p>
    </div>
  );
}
