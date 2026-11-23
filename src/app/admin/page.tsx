import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { resumenInicio } from '@/lib/admin/inicio';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { Cifra } from '@/components/ui/cifra';
import { Fila, Lista } from '@/components/ui/fila';
import { Insignia } from '@/components/ui/insignia';
import { CabeceraAdmin } from './_components/cabecera';
import { plural } from './_components/piezas';
import { InicialIglesia } from './_components/iglesias-inicial';
import { fechaCorta, hoyEnPalabras } from './_components/iglesias-formato';
import {
  NecesitanAlgo,
  necesitaAtencion,
  ordenarPorUrgencia,
} from './_components/inicio-necesitan';

export const metadata: Metadata = { title: 'Inicio' };

/**
 * Inicio del super admin: cómo está la plataforma y qué necesita que hagas algo.
 *
 * Rediseño de la zona 4 (18-nov), aprobado tal cual. El orden responde a la
 * pregunta con la que se abre esta pantalla cada mañana —«¿hay algo que hacer
 * hoy?»—: las cuatro cifras, y justo debajo, a todo el ancho, lo que pide
 * atención con su botón. Las pruebas que acaban y las últimas altas, después.
 * En el móvil las cifras van en dos por dos para que lo urgente se vea sin
 * bajar: una debajo de otra eran un pantallazo entero.
 *
 * Sin botón naranja: aquí no hay una acción de la pantalla, solo una por fila,
 * y esas van de contorno.
 */
export default async function AdminInicioPage() {
  await requireSuperAdmin();
  const ahora = new Date();
  const r = await resumenInicio(ahora);

  const atencion = ordenarPorUrgencia(r.iglesias.filter(necesitaAtencion));
  const enAtencion = new Set(atencion.map((i) => i.id));

  // Las pruebas en curso que NO están ya arriba. Una prueba que acaba esta
  // semana sube a «Necesitan algo de ti» y sale de aquí: la misma iglesia en
  // dos listas de la misma pantalla se lee como dos avisos.
  const pruebas = r.iglesias
    .flatMap((i) =>
      i.estado.situacion === 'prueba' && i.activa && !enAtencion.has(i.id)
        ? [{ i, dias: i.estado.diasRestantes, hasta: i.estado.accesoHasta }]
        : [],
    )
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);
  const pruebasArriba = atencion.some((i) => i.estado.situacion === 'prueba');

  // `listarIglesias` ya las da de la más nueva a la más vieja.
  const ultimas = r.iglesias.slice(0, 5);

  const desglose = [
    plural(r.porGrupo.prueba, 'en prueba', 'en prueba'),
    plural(r.porGrupo.pagan, 'paga', 'pagan'),
    r.porGrupo.vencidas > 0 && plural(r.porGrupo.vencidas, 'vencida', 'vencidas'),
    r.porGrupo.suspendidas > 0 &&
      plural(r.porGrupo.suspendidas, 'suspendida', 'suspendidas'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <CabeceraAdmin titulo="Inicio" subtitulo={`Hatril hoy, ${hoyEnPalabras(ahora)}`} />

      <Contenedor>
        <section className="flex flex-col gap-2.5" aria-labelledby="cifras">
          <h2 id="cifras" className="sr-only">
            La plataforma
          </h2>
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <EnlaceCifra href="/admin/iglesias">
              <Cifra
                etiqueta="Iglesias"
                valor={r.iglesias.length}
                cambio={cambioDe(r.altas30.iglesias)}
                className="h-full transition-colors duration-150 group-hover:border-support-hover group-hover:bg-surface-alt motion-reduce:transition-none"
              >
                <SinAltas n={r.altas30.iglesias} />
                <Detalle largo={desglose} corto={plural(r.porGrupo.prueba, 'en prueba', 'en prueba')} />
              </Cifra>
            </EnlaceCifra>

            <Cifra
              etiqueta="Personas"
              valor={r.personas}
              miles
              cambio={cambioDe(r.altas30.personas)}
            >
              <SinAltas n={r.altas30.personas} />
              <Detalle largo="En fichas, sin contar las archivadas" corto="En fichas" />
            </Cifra>

            <EnlaceCifra href="/admin/cuentas">
              <Cifra
                etiqueta="Cuentas"
                valor={r.cuentas ?? '—'}
                miles
                // Sin pastilla si no se han podido leer todas: antes nada que
                // una cifra a medias.
                cambio={r.altas30.cuentas === null ? undefined : cambioDe(r.altas30.cuentas)}
                className="h-full transition-colors duration-150 group-hover:border-support-hover group-hover:bg-surface-alt motion-reduce:transition-none"
              >
                <SinAltas n={r.altas30.cuentas} />
                {r.cuentas === null ? (
                  <span className="text-label text-muted-foreground">
                    No se han podido leer ahora
                  </span>
                ) : (
                  <Detalle largo="Con iglesia o sin ella" corto="Con o sin iglesia" />
                )}
              </Cifra>
            </EnlaceCifra>

            <Cifra etiqueta="Solicitudes" valor={r.solicitudesPendientes}>
              <Detalle
                largo="Sin contestar; las contesta cada iglesia"
                corto="Sin contestar"
              />
            </Cifra>
          </div>
        </section>

        <section
          className="anim-aparece flex flex-col gap-2.5"
          style={{ '--retraso': '60ms' } as CSSProperties}
        >
          <h2 className="t-micro px-1">Necesitan algo de ti</h2>
          <NecesitanAlgo lista={atencion} />
        </section>

        <div
          // `grid-cols-1` explícito: sin él la columna implícita crece hasta lo
          // que mide el nombre más largo sin cortar, y a 375 px las dos listas
          // se salían por la derecha.
          className="anim-aparece grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
          style={{ '--retraso': '120ms' } as CSSProperties}
        >
          <section className="flex flex-col gap-2.5">
            <h2 className="t-micro px-1">Pruebas que acaban pronto</h2>
            {pruebas.length === 0 ? (
              <Vacio>
                {pruebasArriba
                  ? 'Las que acaban esta semana están arriba. No hay más en prueba.'
                  : 'Ninguna iglesia está en prueba ahora mismo.'}
              </Vacio>
            ) : (
              <Lista>
                {pruebas.map(({ i, dias, hasta }) => (
                  <Fila
                    key={i.id}
                    href={`/admin/iglesias/${i.id}`}
                    inicio={<InicialIglesia nombre={i.nombre} logoUrl={i.logoUrl} />}
                    titulo={i.nombre}
                    // La fecha en la hora de la iglesia: es su día el que se
                    // acaba, no el nuestro.
                    detalle={`Acaba el ${fechaCorta(hasta, i.timezone, ahora)}`}
                    fin={
                      <span className="flex-none text-label font-semibold tabular-nums">
                        {plural(dias, 'día', 'días')}
                      </span>
                    }
                  />
                ))}
              </Lista>
            )}
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="t-micro px-1">Últimas altas</h2>
            {ultimas.length === 0 ? (
              <Vacio>Todavía no se ha registrado ninguna iglesia.</Vacio>
            ) : (
              <Lista>
                {ultimas.map((i) => (
                  <Fila
                    key={i.id}
                    href={`/admin/iglesias/${i.id}`}
                    inicio={<InicialIglesia nombre={i.nombre} logoUrl={i.logoUrl} />}
                    titulo={i.nombre}
                    // Sin insignia, como en el diseño: la situación ya está
                    // arriba si pide algo, y aquí la pregunta es quién ha
                    // llegado y cuánto ha crecido.
                    detalle={`${fechaCorta(i.createdAt, undefined, ahora)} · ${plural(i.personas, 'persona', 'personas')}`}
                  />
                ))}
              </Lista>
            )}
          </section>
        </div>
      </Contenedor>
    </>
  );
}

/**
 * La pastilla de lo que ha cambiado. Solo altas, que es lo que se puede contar
 * (`lib/admin/inicio.ts`), y por eso nunca baja.
 *
 * Con cero no se usa la de `Cifra`: su versión gris lleva la flecha de «va a
 * menos», y no ha bajado nada, sencillamente no ha entrado nadie. Va la
 * insignia neutra (`SinAltas`), que es la misma pastilla sin flecha. Un cero
 * también es un dato: un mes sin una sola iglesia nueva hay que verlo.
 */
function cambioDe(n: number): { texto: string } | undefined {
  return n > 0 ? { texto: `+${n} en 30 días` } : undefined;
}

function SinAltas({ n }: { n: number | null }) {
  if (n !== 0) return null;
  return (
    <Insignia tono="neutro" className="w-max">
      0 en 30 días
    </Insignia>
  );
}

/**
 * Dos textos: el de escritorio y uno corto para el dos por dos del móvil, donde
 * cada tarjeta mide 165 px y el largo partía en tres líneas.
 */
function Detalle({ largo, corto }: { largo: string; corto: string }) {
  return (
    <span className="text-label text-muted-foreground">
      <span className="hidden md:inline">{largo}</span>
      <span className="md:hidden">{corto}</span>
    </span>
  );
}

/**
 * La cifra entera como enlace. `text-foreground` por la regla 11: `globals.css`
 * pinta de naranja todo `<a>` y el número lo heredaría.
 */
function EnlaceCifra({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group rounded-xl text-foreground no-underline outline-none hover:text-foreground hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/20"
    >
      {children}
    </Link>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
      {children}
    </p>
  );
}
