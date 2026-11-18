import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { fichaIglesia } from '@/lib/admin/consultas';
import { leerRegistro } from '@/lib/admin/registro';
import { Aviso } from '@/components/aviso';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Cifra } from '@/components/ui/cifra';
import { Insignia } from '@/components/ui/insignia';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../../_components/cabecera';
import { Dato, fecha } from '../../_components/piezas';
import { ListaRegistro } from '../../_components/registro';
import { Copiable } from './_components/copiar';
import { Palancas } from './_components/palancas';

export const metadata: Metadata = { title: 'Iglesia' };

/**
 * Los textos de confirmación, por clave. `Object.hasOwn` al leerlos: con
 * `CONFIRMACIONES[ok]` a secas, `?ok=constructor` pinta una función (lo cuenta
 * `ESTADO.md` de las pantallas de `/mi/equipo`).
 */
const CONFIRMACIONES: Record<string, string> = {
  prueba: 'Prueba ampliada.',
  suspendida: 'Iglesia suspendida. Nadie de ella puede entrar y su web ya no se ve.',
  reactivada: 'Iglesia reactivada.',
  directorio: 'Ya no sale en el directorio.',
};

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * La ficha de una iglesia: la pantalla con más poder de Hatril.
 *
 * Arriba, quién es y en qué situación está. Luego sus cuatro recuentos y, en
 * «Lo que puedes hacer», las palancas juntas, cada una con su ventana de
 * confirmación (`_components/palancas.tsx`). A la derecha, con quién hablar y
 * sus datos; debajo de las palancas, lo que ya se ha hecho con ella.
 *
 * Solo recuentos y las cuentas de sus pastores, ninguna ficha de miembro:
 * somos encargados de los datos de la congregación, no sus dueños
 * (`lib/admin/consultas.ts`).
 */
export default async function AdminIglesiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Antes de consultar nada: aquí todo va por `dbAdmin`, sin RLS debajo, y un
  // layout no protege la página (CLAUDE.md).
  await requireSuperAdmin();
  const { id: crudo } = await params;
  const sp = await searchParams;

  // Un id que no es uuid haría reventar la consulta con un 500. Se vuelve al
  // listado con el porqué, que es lo que la guía pide en vez de un 404 en negro.
  const id = z.uuid().safeParse(crudo);
  if (!id.success) {
    redirect('/admin/iglesias?error=' + encodeURIComponent('Esa iglesia no existe.'));
  }

  const [ficha, historial] = await Promise.all([
    fichaIglesia(id.data),
    leerRegistro({ iglesiaId: id.data }, 20),
  ]);
  if (!ficha) {
    redirect('/admin/iglesias?error=' + encodeURIComponent('Esa iglesia no existe.'));
  }

  const { iglesia, situacion } = ficha;
  const error = primero(sp.error)?.slice(0, 300);
  const okClave = primero(sp.ok);
  const ok =
    okClave && Object.hasOwn(CONFIRMACIONES, okClave)
      ? CONFIRMACIONES[okClave]
      : null;

  const lugar = [iglesia.ciudad, iglesia.pais].filter(Boolean).join(', ');
  const insignia = (
    <Insignia tono={situacion.tono} punto>
      {situacion.etiqueta}
    </Insignia>
  );

  return (
    <>
      <CabeceraAdmin
        titulo={iglesia.nombre}
        // Junto al nombre en escritorio. En el móvil baja a la fila de «Ver su
        // web»: al lado de un nombre largo, «Vencida · solo lectura» lo dejaba
        // en «Iglesia Cri…». Es la misma pastilla dos veces, y `hidden` saca la
        // que no se ve también del árbol de accesibilidad.
        insignia={<span className="hidden flex-none md:inline-flex">{insignia}</span>}
        subtitulo={[lugar, iglesia.denominacion, `alta el ${fecha(iglesia.createdAt)}`]
          .filter(Boolean)
          .join(' · ')}
        volver={{ href: '/admin/iglesias', texto: 'Iglesias' }}
      >
        <span className="flex-none md:hidden">{insignia}</span>
        {/* Suspendida o sin publicar, `/i/[slug]` da «no encontrada»: un botón
            hacia ahí solo despistaría. «Web pública» en Datos dice cuál es. */}
        {iglesia.webPublica && iglesia.activa && (
          <BotonEnlace href={`/i/${iglesia.slug}`} nuevaPestana variant="outline">
            <ExternalLink strokeWidth={1.8} /> Ver su web
          </BotonEnlace>
        )}
      </CabeceraAdmin>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}

        {/* Dos por dos en el móvil: en una columna, las cuatro ocupaban un
            pantallazo entero antes de llegar a ninguna palanca. */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <Cifra etiqueta="Personas" valor={ficha.personas}>
            <Detalle>En su fichero</Detalle>
          </Cifra>
          <Cifra etiqueta="Ministerios" valor={ficha.ministeriosActivos}>
            <Detalle>Activos</Detalle>
          </Cifra>
          <Cifra etiqueta="Cuentas" valor={ficha.cuentas}>
            <Detalle>Con acceso</Detalle>
          </Cifra>
          <Cifra etiqueta="Solicitudes" valor={ficha.solicitudesPendientes}>
            <Detalle>Sin contestar</Detalle>
          </Cifra>
        </div>

        {/*
         * Dos columnas en escritorio: las palancas y el registro a la izquierda,
         * con quién hablar y los datos a la derecha. La columna derecha es UN
         * elemento que ocupa las dos filas, y la segunda fila es `1fr`: así lo
         * que sobre de altura se lo queda el registro y no abre un hueco entre
         * las palancas y él.
         *
         * En el orden del documento el registro va el último a propósito: en
         * el móvil, con una sola columna, se lee palancas, contacto, datos y
         * registro, que puede ser largo; y el tabulador sigue ese mismo orden.
         */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div className="lg:col-start-1 lg:row-start-1">
            <Palancas iglesia={iglesia} abrirAmpliar={primero(sp.ampliar) === '1'} />
          </div>

          <div className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {/* ---------- Con quién hablar ---------- */}
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-5">
              <h2 className="t-subtitulo">Con quién hablar</h2>

              {ficha.pastores.length === 0 ? (
                <p className="text-label text-muted-foreground">
                  Ninguna cuenta tiene el rol de pastor en esta iglesia.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {ficha.pastores.map((p) => (
                    <li key={p.authUserId} className="flex min-w-0 flex-col gap-1">
                      <span className="flex min-w-0 flex-col">
                        <Link
                          href={`/admin/cuentas/${p.authUserId}`}
                          className="w-fit max-w-full truncate text-body font-semibold text-foreground"
                        >
                          {p.nombre}
                        </Link>
                        <span className="text-label text-muted-foreground">Pastor</span>
                      </span>
                      {p.email ? (
                        <Copiable valor={p.email} que="el correo del pastor" />
                      ) : (
                        <span className="text-label text-muted-foreground">Sin correo</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="t-micro">De la iglesia</h3>
                {iglesia.email ? (
                  <Copiable valor={iglesia.email} que="el correo de la iglesia" />
                ) : (
                  <span className="text-label text-muted-foreground">Sin correo</span>
                )}
                {iglesia.telefono ? (
                  <Copiable valor={iglesia.telefono} que="el teléfono" />
                ) : (
                  <span className="text-label text-muted-foreground">Sin teléfono</span>
                )}
              </div>
            </section>

            {/* ---------- Datos ---------- */}
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-5">
              <h2 className="t-subtitulo">Datos</h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Dato etiqueta="Dirección en Hatril">/i/{iglesia.slug}</Dato>
                {/* Alta y denominación ya van en la cabecera, pero allí se
                    cortan en el móvil; aquí se leen enteras. */}
                <Dato etiqueta="Alta">{fecha(iglesia.createdAt)}</Dato>
                <Dato etiqueta="Denominación">{iglesia.denominacion ?? '—'}</Dato>
                <Dato etiqueta="Zona y moneda">
                  {iglesia.timezone} · {iglesia.moneda}
                </Dato>
                <Dato etiqueta="Web pública">
                  {iglesia.webPublica ? 'Publicada' : 'Sin publicar'}
                </Dato>
                <Dato etiqueta="Cliente de Stripe">
                  {iglesia.stripeCustomerId ? (
                    <code className="text-label">{iglesia.stripeCustomerId}</code>
                  ) : (
                    'Todavía no ha pasado por el pago'
                  )}
                </Dato>
                {iglesia.dominioPropio && (
                  <Dato etiqueta="Dominio propio">{iglesia.dominioPropio}</Dato>
                )}
              </dl>
            </section>
          </div>

          {/* ---------- Lo que se ha hecho ---------- */}
          <section className="flex flex-col gap-2.5 lg:col-start-1 lg:row-start-2">
            <h2 className="t-micro px-1">Lo que se ha hecho con esta iglesia</h2>
            <ListaRegistro
              apuntes={historial}
              dentroDe="iglesia"
              vacio="Nadie ha tocado esta iglesia desde la administración."
            />
          </section>
        </div>
      </Contenedor>
    </>
  );
}

/** La línea de debajo de cada cifra: qué cuenta. */
function Detalle({ children }: { children: React.ReactNode }) {
  return <span className="text-label text-muted-foreground">{children}</span>;
}
