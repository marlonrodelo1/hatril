import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ChevronRight,
  HandHeart,
  ShieldCheck,
  SquarePen,
  UserMinus,
  UserPlus,
} from 'lucide-react';

import { requirePastor } from '@/lib/auth/guard-panel';
import {
  ETIQUETAS_PERMISOS,
  ETIQUETAS_ROLES,
  PERMISOS,
  ROLES_IGLESIA,
} from '@/lib/auth/permisos';
import { listarEquipo, type FilaEquipo } from '@/lib/equipo/consultas';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import {
  cambiarRol,
  devolverAcceso,
  guardarPermisos,
  quitarAcceso,
} from './actions';

export const metadata: Metadata = { title: 'Líderes' };

/**
 * Cuántos permisos tiene concedidos, para el resumen del desplegable.
 *
 * Se cuenta sobre el mapa EFECTIVO —el que ya incluye los defectos del rol—,
 * que es lo que la persona puede hacer de verdad. Contar solo las excepciones
 * del jsonb diría «0 de 6» de una secretaría que puede casi todo.
 */
function contarConcedidos(p: FilaEquipo): number {
  return PERMISOS.filter((permiso) => p.permisos[permiso]).length;
}

const CONFIRMACIONES: Record<string, string> = {
  rol: 'Rol cambiado. Los permisos volvieron a los de ese rol.',
  permisos: 'Permisos guardados.',
  quitado: 'Esa persona ya no puede entrar.',
  devuelto: 'Acceso devuelto.',
};

export default async function LideresPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requirePastor();
  const { error, guardado } = await searchParams;

  const equipo = await listarEquipo(ctx);
  const conAcceso = equipo.filter((p) => p.estado === 'activo');
  const sinAcceso = equipo.filter((p) => p.estado === 'baja');

  return (
    <>
      <CabeceraPanel
        titulo="Líderes"
        subtitulo="Quién entra en el panel y qué puede hacer dentro"
      />

      {/* `gap-8` y no el de por defecto: aquí lo que se separa son secciones
          enteras —«Con acceso» y «Sin acceso»—, no tarjetas sueltas. */}
      <Contenedor className="gap-8">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {/* Se dice aquí y una sola vez, no repetido en cada tarjeta: la puerta de
            entrada es la misma para todo el mundo y repetirlo por persona
            convierte una explicación en ruido. */}
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] leading-snug text-muted-foreground">
          Aquí solo aparece quien ya tiene cuenta en tu iglesia. Para que alguien
          entre, comparte el enlace de tu página pública: pide unirse, tú lo
          apruebas en <strong className="font-semibold">Solicitudes</strong>, y
          entonces puedes darle su rol desde esta pantalla.
        </p>

        <section className="flex flex-col gap-4">
          <h2 className="t-subtitulo">
            Con acceso{' '}
            <span className="font-medium text-muted-foreground">
              ({conAcceso.length})
            </span>
          </h2>

          {/*
           * Dos columnas a partir de `lg`, con `items-start`.
           *
           * Lo de `items-start` no es adorno: cada persona es un `<details>` y
           * en una rejilla las celdas de una misma fila se estiran a la altura
           * de la más alta. Con una abierta y su vecina cerrada, la cerrada
           * pasaría de ser una línea a un recuadro con un palmo de vacío
           * dentro. Con `items-start` cada tarjeta mide lo suyo.
           */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {conAcceso.map((p) => (
              <TarjetaPersona key={p.iglesiaUsuarioId} persona={p} />
            ))}
          </div>
        </section>

        {sinAcceso.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="t-subtitulo">
                Sin acceso{' '}
                <span className="font-medium text-muted-foreground">
                  ({sinAcceso.length})
                </span>
              </h2>
              <p className="text-[13.5px] text-muted-foreground">
                No pueden entrar al panel. Sus fichas y su histórico siguen
                intactos.
              </p>
            </div>

            {/* Misma rejilla que arriba, para que las dos listas de la pantalla
                se lean igual. Estas tarjetas no se despliegan, pero si esta
                sección fuera a una columna y la de arriba a dos, la página
                parecería dos pantallas pegadas. */}
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {sinAcceso.map((p) => (
                <article
                  key={p.iglesiaUsuarioId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4"
                >
                  <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12.5px] font-bold text-muted-foreground">
                    {iniciales(p.nombre)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[15px] font-semibold">
                      {p.nombre}
                    </span>
                    {p.email && (
                      <span className="truncate text-[13px] text-muted-foreground">
                        {p.email}
                      </span>
                    )}
                  </div>
                  <form action={devolverAcceso.bind(null, p.iglesiaUsuarioId)}>
                    <Button type="submit" variant="outline" size="sm">
                      <UserPlus strokeWidth={1.7} />
                      Devolver el acceso
                    </Button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        )}
      </Contenedor>
    </>
  );
}

function TarjetaPersona({ persona: p }: { persona: FilaEquipo }) {
  return (
    <details className="group/persona rounded-xl border border-border bg-surface open:pb-5">
      {/*
       * La tarjeta ENTERA es el desplegable: cerrada es una línea por persona,
       * y al abrirla sale todo lo suyo. Con diez cuentas, la lista se lee de un
       * vistazo en vez de ocupar cinco pantallas.
       *
       * Dentro del `<summary>` no va ningún enlace ni botón: pulsarlos abriría
       * y cerraría la tarjeta a la vez que navegan. «Editar ficha» y el enlace a
       * su ficha viven abajo, ya desplegados.
       */}
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3.5 p-5 marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 flex-none text-muted-foreground transition-transform group-open/persona:rotate-90"
          strokeWidth={2}
        />

        <span className="flex size-11 flex-none items-center justify-center rounded-full bg-muted text-[14px] font-bold text-muted-foreground">
          {iniciales(p.nombre)}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold tracking-[-0.018em]">
              {p.nombre}
            </span>
            {p.esTuCuenta && (
              <span className="rounded-full bg-accent px-2 py-[3px] text-[11.5px] font-bold text-accent-foreground">
                Tu cuenta
              </span>
            )}
          </div>

          {/* Cortado, como en las tarjetas de «Sin acceso»: a media anchura un
              correo largo no tiene por dónde partirse y se sale de la tarjeta. */}
          <span className="truncate text-[13.5px] text-muted-foreground">
            {p.email ?? 'Sin ficha de miembro todavía'}
          </span>

          {p.lidera.length > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <HandHeart className="size-3.5 flex-none" strokeWidth={1.7} />
              Lidera {p.lidera.map((m) => m.nombre).join(', ')}
            </span>
          )}
        </div>

        <span className="flex-none rounded-full bg-background px-2.5 py-[5px] text-[12px] font-semibold text-muted-foreground">
          {ETIQUETAS_ROLES[p.rol].titulo}
        </span>
      </summary>

      <div className="flex flex-col gap-5 px-5">
        {p.miembroId && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/panel/miembros?ficha=${p.miembroId}`} />}
            >
              Ver su ficha
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
              render={<Link href={`/panel/miembros/${p.miembroId}/editar`} />}
            >
              <SquarePen strokeWidth={1.7} />
              Editar ficha
            </Button>
          </div>
        )}

      {/*
       * La propia cuenta se pinta SIN controles.
       *
       * El trigger `guard_iglesia_usuarios` (HT101) lo impide de todas formas,
       * pero un control que siempre devuelve un error no es una protección: es
       * una trampa. Se explica la regla y, sobre todo, se explica la salida —que
       * es lo que de verdad busca quien llega hasta aquí.
       */}
      {p.esTuCuenta ? (
        <p className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
          Tu propio rol y tus permisos no se editan desde aquí. Es a propósito:
          evita que un pastor se deje fuera de su iglesia con un clic. Si vas a
          traspasar la iglesia, nombra pastor a otra persona y que sea ella quien
          te cambie a ti.
        </p>
      ) : (
        <>
          {/*
           * DOS FORMULARIOS, NO UNO.
           *
           * Los permisos por defecto dependen del rol. Con un solo formulario,
           * cambiar el desplegable de «líder» a «secretaría» enviaría además las
           * casillas que se estaban viendo —las de líder, casi todas apagadas— y
           * se guardarían como excepciones que apagan los cuatro permisos con los
           * que nace secretaría. El pastor creería estar delegando y estaría
           * cerrando.
           */}
          <form
            action={cambiarRol.bind(null, p.iglesiaUsuarioId)}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <label
                  htmlFor={`rol-${p.iglesiaUsuarioId}`}
                  className="t-label"
                >
                  Rol
                </label>
                <select
                  id={`rol-${p.iglesiaUsuarioId}`}
                  name="rol"
                  defaultValue={p.rol}
                  className="h-[42px] rounded-lg border border-input bg-surface-alt px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                >
                  {ROLES_IGLESIA.map((r) => (
                    <option key={r} value={r}>
                      {ETIQUETAS_ROLES[r].titulo}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline">
                Cambiar el rol
              </Button>
            </div>
            <p className="t-label text-muted-foreground">
              {ETIQUETAS_ROLES[p.rol].descripcion} Al cambiarlo, los permisos
              vuelven a los de ese rol.
            </p>
          </form>

          {/*
           * Los permisos van dentro del desplegable de la persona, ya abiertos.
           * Anidar un segundo `<details>` aquí obligaba a dos clics para llegar
           * a lo que se viene a hacer.
           */}
          <div className="border-t border-border pt-4">
            <form
              action={guardarPermisos.bind(null, p.iglesiaUsuarioId)}
              className="flex flex-col gap-3"
            >
              <span className="t-micro">
                Además de su rol, puede · {contarConcedidos(p)} de{' '}
                {PERMISOS.length}
              </span>

              <div className="flex flex-col gap-3">
                {PERMISOS.map((permiso) => (
                  <label
                    key={permiso}
                    className="flex cursor-pointer items-start gap-2.5"
                  >
                    {/* Casilla nativa, la restilizada en `globals.css`. Tiene
                        que viajar en el FormData de la server action. */}
                    <input
                      type="checkbox"
                      name={permiso}
                      defaultChecked={p.permisos[permiso]}
                      className="mt-0.5 flex-none"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[14.5px] font-semibold leading-snug">
                        {ETIQUETAS_PERMISOS[permiso].titulo}
                      </span>
                      <span className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
                        {ETIQUETAS_PERMISOS[permiso].descripcion}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button type="submit" variant="outline">
                  <ShieldCheck strokeWidth={1.7} />
                  Guardar permisos
                </Button>
              </div>
            </form>
          </div>

          {/* En su propio formulario y separado por el borde: con el botón de
              guardar permisos al lado, un Enter de más quita el acceso. */}
          {p.rol !== 'pastor' && (
            <form
              action={quitarAcceso.bind(null, p.iglesiaUsuarioId)}
              className="border-t border-border pt-4"
            >
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <UserMinus strokeWidth={1.7} />
                Quitarle el acceso al panel
              </Button>
            </form>
          )}
        </>
      )}
      </div>
    </details>
  );
}
