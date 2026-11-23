import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Flag, MessagesSquare } from 'lucide-react';

import { Aviso } from '@/components/aviso';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { CabeceraDelDia } from './cabecera-del-dia';
import { Publicador } from './publicador';
import { Publicacion } from './publicacion';
import type { datosDelMuro } from '../datos';

/**
 * Lo que pinta el muro, sin consultar nada.
 *
 * Salió de `../page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`), cada una con sus datos (`datosDelMuro`). El porqué
 * de cada pieza está en esa página.
 */
export type DatosDelMuro = Awaited<ReturnType<typeof datosDelMuro>>;

export function VistaComunidad({
  cabecera,
  iglesiaNombre,
  config,
  puedePublicar,
  porQueNo,
  moderador,
  muro,
  versiculo,
  devocional,
  miFoto,
  denuncias,
  nombre,
  error,
  bloqueado,
}: DatosDelMuro & { cabecera: ReactNode; error?: string; bloqueado?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/*
       * La campana aquí y no solo en el panel: la mayoría de la congregación no
       * entra al panel nunca.
       *
       * SIN FLECHA DE VOLVER, Y NO ES UN DESCUIDO
       * -----------------------------------------
       * La tenía, apuntando a `/mi`. Pero `/mi` redirige a esta misma pantalla
       * en cuanto quien mira pertenece a una iglesia (ver `mi/page.tsx`), así
       * que la flecha daba la vuelta y volvía aquí: un botón que parecía llevar
       * a algún sitio y no llevaba a ninguno.
       *
       * Y aunque llevara: esto es una pestaña, no una pantalla de detalle. Una
       * flecha de «atrás» sobre una sección principal, con la barra de abajo
       * justo debajo diciendo dónde estás, es la clase de mueble que sobra.
       */}
      {cabecera}

      {/*
       * La columna de todas las pantallas de `/mi` (guía visual), con su
       * `gap-4` también en el móvil. Aquí llevaba `gap-3` porque las
       * publicaciones iban a sangre y se quería que se leyeran seguidas; desde
       * el 17-nov cada una es su tarjeta, y ese aire es justo lo que separa
       * una de la siguiente.
       */}
      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {bloqueado && (
          <Aviso tipo="ok">
            Ya no verás lo que publica ni lo que comenta. Puedes desbloquear
            desde Mi cuenta.
          </Aviso>
        )}

        {/* La cola del moderador asoma aquí, en el muro, porque es donde
            trabaja: el permiso de moderar no abre el panel. */}
        {denuncias > 0 && (
          <Link
            href="/mi/comunidad/denuncias"
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-badge-warning-bg text-badge-warning-fg">
              <Flag className="size-[17px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1 text-[14.5px] font-semibold">
              {denuncias === 1
                ? 'Hay 1 denuncia por revisar'
                : `Hay ${denuncias} denuncias por revisar`}
            </span>
            <ChevronRight className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
          </Link>
        )}

        {/*
         * Lo del día corona la pantalla, y va FUERA del `if` de la comunidad
         * apagada: el versículo y el devocional no son del muro, son de la
         * iglesia. Cerrar las publicaciones no puede dejar a la congregación sin
         * lo que le toca leer hoy.
         */}
        <CabeceraDelDia
          versiculo={versiculo}
          devocional={
            devocional && {
              titulo: devocional.titulo,
              fecha: devocional.fecha,
              // El extracto se corta aquí, en el servidor, además del recorte de
              // la portada: un cuerpo de tres mil caracteres viajaría entero al
              // navegador para enseñar cuarenta.
              cuerpo: devocional.cuerpo.slice(0, 180),
              imagenUrl: devocional.imagenUrl,
              esDeHoy: devocional.esDeHoy,
            }
          }
        >
          {/*
           * El compositor cierra la portada, dentro del mismo marco que el
           * versículo y el devocional. Solo si esta persona puede publicar: con
           * la comunidad apagada o el muro cerrado al equipo, la portada se
           * queda en sus dos primeras filas.
           */}
          {config.activa && puedePublicar && (
            <Publicador
              nombre={nombre}
              miFoto={miFoto}
              admiteFotos={config.fotos}
              // Cristal solo si hay foto detrás. Sin foto, la portada es clara
              // (`cabecera-del-dia.tsx`) y el compositor va con su tarjeta.
              sobreFoto={Boolean(versiculo?.imagenUrl ?? devocional?.imagenUrl)}
            />
          )}
        </CabeceraDelDia>

        {!config.activa ? (
          /*
           * Apagada. Se dice que lo publicado sigue ahí porque la primera
           * lectura de una pantalla vacía es «se ha perdido todo», y esa es
           * exactamente la sensación que la `0027` evita dejando el SELECT
           * fuera de la configuración.
           */
          <div className="rounded-xl border border-border bg-surface">
            <EstadoVacio
              Icono={MessagesSquare}
              titulo="La comunidad está apagada ahora mismo"
            >
              {iglesiaNombre} ha cerrado el muro por ahora, así que no se
              puede publicar ni comentar. Lo que se publicó sigue guardado y
              vuelve a verse en cuanto lo enciendan.
            </EstadoVacio>
          </div>
        ) : (
          <>
            {/* Quien no puede publicar se entera aquí, y sobrio: es una
                decisión de la iglesia sobre su muro, no un castigo a quien
                lee. Quien SÍ puede tiene el compositor arriba, en la
                portada. */}
            {!puedePublicar && (
              <p className="text-pretty rounded-xl border border-border bg-surface px-4 py-3.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {porQueNo}
              </p>
            )}

            {muro.length === 0 ? (
              /* Un muro vacío no es un error, es el primer día. Se dice así en
                 vez de dejar la pantalla en blanco. */
              <div className="rounded-xl border border-border bg-surface">
                <EstadoVacio
                  Icono={MessagesSquare}
                  titulo="Todavía no hay nada por aquí"
                >
                  Esto lo ve solo la gente de {iglesiaNombre}. Una foto del
                  domingo o una petición de oración son buenas maneras de
                  empezar.
                </EstadoVacio>
              </div>
            ) : (
              muro.map((p) => (
                <Publicacion
                  key={p.id}
                  publicacion={p}
                  puedeModerar={moderador}
                  admiteComentarios={config.comentarios}
                />
              ))
            )}

            {/* El aviso de las fotos solo si de verdad se pueden subir: un
                texto que describe algo que la pantalla no ofrece es la clase de
                mentira pequeña que este repo ya ha pagado en los legales. */}
            <p className="px-1 pt-2 text-label leading-relaxed text-muted-foreground">
              Lo que se publica aquí no sale en la web de la iglesia ni lo ve
              nadie de fuera.
              {config.fotos &&
                ' Si subes una foto donde salen otras personas, pídeles permiso antes.'}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
