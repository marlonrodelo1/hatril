import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Plus, Power } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import {
  TIPOS_ACTIVABLES,
  ministeriosActivosPorTipo,
  type MinisterioDelCatalogo,
  type TipoEnLaIglesia,
} from '@/lib/ministerios/catalogo';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { MODULOS_MINISTERIO } from '@/lib/ministerios/modulos';
import {
  TIPO_POR_DEFECTO,
  tipoDeMinisterio,
  type TipoMinisterio,
} from '@/lib/ministerios/tipos';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { activarModulo, anadirOtroModulo } from './actions';
import { BotonEnviar } from './_components/boton-enviar';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';

export const metadata: Metadata = { title: 'Módulos' };

/*
 * Lo que hay aquí son ministerios. Las herramientas de la iglesia entera
 * —Finanzas, Eventos, Reuniones, Devocionales— entran en un segundo bloque con
 * la tanda 3, que es la que trae `iglesias.modulos` para poder apagarlas.
 */
export default async function ModulosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // El permiso lo exige el layout. Esto solo recoge el contexto, que va en
  // `cache()` y no repite la consulta.
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  const porTipo = await ministeriosActivosPorTipo(ctx);
  const otro = tipoDeMinisterio(TIPO_POR_DEFECTO);

  return (
    <>
      <CabeceraPanel titulo="Módulos" subtitulo="Activa lo que usa tu iglesia" />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="t-subtitulo">Ministerios</h2>
            <p className="text-pretty text-[13px] text-muted-foreground">
              Cada uno trae sus herramientas. Al activarlo se crea el equipo y
              pasas a él para elegir quién lo lleva.
            </p>
          </div>

          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TIPOS_ACTIVABLES.map((t) => (
              <li key={t.id}>
                <TarjetaTipo
                  tipo={t}
                  enMarcha={porTipo.get(t.id) ?? SIN_NADA}
                />
              </li>
            ))}

            {/*
             * «Otro» al final y sin botón de activar: no tiene nombre por
             * defecto que sirva, y un ministerio llamado «Otro» no le dice nada
             * a nadie. Lleva al formulario, donde se le pone nombre. Los que ya
             * existen de ese tipo —o de uno que el catálogo ya no conoce— salen
             * aquí para que no se pierdan de la lista, salvo los que se llaman
             * como una tarjeta de arriba: esos salen en la suya.
             */}
            <li>
              <article className="flex h-full flex-col gap-4 rounded-xl border border-dashed border-border bg-surface p-5">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[17px] font-bold tracking-[-0.018em]">
                    Algo que no está en la lista
                  </h3>
                  <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
                    {otro.descripcion}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
                  <ListaActivos activos={porTipo.get(otro.id)?.delTipo ?? []} />
                  <Button
                    variant="outline"
                    className="w-full sm:w-fit"
                    render={<Link href="/panel/ministerios/nuevo" />}
                  >
                    <Plus strokeWidth={1.9} />
                    Crear uno a tu medida
                  </Button>
                </div>
              </article>
            </li>
          </ul>
        </section>
      </Contenedor>
    </>
  );
}

const SIN_NADA: TipoEnLaIglesia = { delTipo: [], porNombre: [] };

function TarjetaTipo({
  tipo,
  enMarcha,
}: {
  tipo: TipoMinisterio;
  enMarcha: TipoEnLaIglesia;
}) {
  const encendidos: readonly string[] = tipo.modulos;
  // En el orden del catálogo de módulos y no en el de la plantilla: es el de
  // las pestañas que el equipo va a ver dentro.
  const herramientas = MODULOS_MINISTERIO.filter((m) =>
    encendidos.includes(m.id),
  );
  // «Activo» solo con el tipo puesto. El que coincide por nombre existe, pero
  // está como «Otro» y puede no tener encendido nada de lo que dice «Trae»:
  // la insignia lo contaría como hecho.
  const activo = enMarcha.delTipo.length > 0;
  const loTiene = activo || enMarcha.porNombre.length > 0;

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-bold tracking-[-0.018em]">
            {tipo.nombre}
          </h3>
          {activo && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-badge-success-bg px-2.5 text-[12px] font-semibold text-badge-success-fg">
              Activo
            </span>
          )}
        </div>
        <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
          {tipo.descripcion}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="t-micro">Trae</span>
        <ul className="flex flex-wrap gap-1.5">
          {herramientas.map((m) => (
            <li
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-2.5 py-1 text-[12.5px] font-medium"
            >
              <m.Icono
                className="size-3.5 text-muted-foreground"
                strokeWidth={1.9}
                aria-hidden
              />
              {m.nombre}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        {loTiene ? (
          <>
            <ListaActivos activos={enMarcha.delTipo} />
            {enMarcha.porNombre.map((m) => (
              <SinTipo key={m.id} ministerio={m} />
            ))}
            {/* Discreto a propósito: lo normal es uno por tipo, y dos equipos
                de alabanza es la excepción que hay que poder hacer, no la
                invitación que hay que poner delante. */}
            <form action={anadirOtroModulo.bind(null, tipo.id)}>
              <BotonEnviar variant="ghost" size="sm" className="-ml-2">
                <Plus strokeWidth={1.9} />
                Añadir otro
                <span className="sr-only">: {tipo.nombre}</span>
              </BotonEnviar>
            </form>
          </>
        ) : (
          // Carbón y no naranja: sería un botón naranja por tarjeta, y el
          // sistema admite uno por pantalla.
          <form action={activarModulo.bind(null, tipo.id)}>
            <BotonEnviar variant="secondary" className="w-full sm:w-fit">
              <Power strokeWidth={1.9} />
              Activar
              <span className="sr-only"> {tipo.nombre}</span>
            </BotonEnviar>
          </form>
        )}
      </div>
    </article>
  );
}

/** Un enlace por ministerio en marcha de este tipo. */
function ListaActivos({ activos }: { activos: MinisterioDelCatalogo[] }) {
  if (activos.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {activos.map((m) => (
        <li key={m.id}>
          <FilaMinisterio ministerio={m} />
        </li>
      ))}
    </ul>
  );
}

/**
 * El ministerio que ya existía con este nombre pero está guardado como «Otro»,
 * casi siempre porque es anterior a los tipos.
 *
 * La pista dice «marca» y no solo «ponle el tipo»: el selector de Editar no
 * enciende nada al cambiarlo —sin JavaScript de cliente las casillas no se
 * enteran—, así que con el tipo solo, las herramientas de «Trae» seguirían
 * apagadas.
 */
function SinTipo({ ministerio }: { ministerio: MinisterioDelCatalogo }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FilaMinisterio ministerio={ministerio} antes="Ya lo tienes:" />
      <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
        Está guardado como «Otro». En{' '}
        <Link
          href={`/panel/ministerios/${ministerio.id}/editar`}
          className="underline"
        >
          Editar
        </Link>
        , ponle este tipo y marca las herramientas de arriba.
      </p>
    </div>
  );
}

function FilaMinisterio({
  ministerio: m,
  antes,
}: {
  ministerio: MinisterioDelCatalogo;
  antes?: string;
}) {
  return (
    <Link
      href={`/panel/ministerios/${m.id}`}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-alt px-3 py-2.5 text-[14px] font-semibold text-foreground no-underline transition-colors hover:bg-surface-active hover:no-underline"
    >
      <span
        className="size-2.5 flex-none rounded-full"
        style={{ background: colorDeMinisterio(m.colorHex).hex }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
        {antes && (
          <span className="font-normal text-muted-foreground">{antes} </span>
        )}
        {m.nombre}
      </span>
      <ChevronRight
        className="size-4 flex-none text-disabled-text"
        strokeWidth={1.9}
        aria-hidden
      />
    </Link>
  );
}
