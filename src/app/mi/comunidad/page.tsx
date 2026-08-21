import type { Metadata } from 'next';
import { MessagesSquare } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { listarMuro } from '@/lib/comunidad/consultas';
import {
  devocionalDeHoy,
  versiculoDelDia,
} from '@/lib/devocionales/consultas';
import {
  porQueNoPuedesPublicar,
  puedePublicarEnMuro,
} from '@/lib/comunidad/reglas';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { Aviso } from '@/components/aviso';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { CabeceraDelDia } from './_components/cabecera-del-dia';
import { Publicador } from './_components/publicador';
import { Publicacion } from './_components/publicacion';

export const metadata: Metadata = { title: 'Comunidad' };

/**
 * El muro de la congregación.
 *
 * PUERTAS ADENTRO
 * ---------------
 * `requireIglesia()` echa a quien no tiene membresía ACTIVA: sin sesión, a
 * identificarse; con sesión y solicitud pendiente, a `/mi`, que le cuenta en qué
 * punto está. Aquí no entra nadie de fuera de la congregación, y las policies de
 * la `0015` lo garantizan aunque este guard se cayera.
 *
 * POR QUÉ NO ESTÁ EN EL PANEL
 * ---------------------------
 * El panel es la herramienta de quien administra la iglesia —fichero de
 * miembros, ministerios, ajustes— y la mayoría de la congregación no entra ahí
 * ni tiene por qué. El muro es de todos, así que vive en el área del miembro.
 *
 * LO QUE ESTA PANTALLA PINTA LO DECIDE LA IGLESIA
 * -----------------------------------------------
 * Los cuatro campos de `ctx.iglesia.comunidad` (migraciones `0026` y `0027`) se
 * tocan en `/panel/comunidad` y se aplican aquí. La regla de oro es que la
 * interfaz no ofrezca lo que las policies van a rechazar: un botón que siempre
 * da error es peor que no tener botón.
 *
 * Y al revés, lo que YA está publicado se sigue viendo entero aunque después se
 * apaguen las fotos o los comentarios. Apagar es dejar de escribir, no borrar —
 * la propia `0027` deja el SELECT fuera de la configuración a propósito para que
 * apagar un domingo no parezca haber perdido el muro.
 *
 * `dynamic` porque esto cambia cada minuto y cada persona ve una cosa distinta:
 * sus «me gusta», sus publicaciones, sus botones de borrar. Cachearlo sería
 * enseñarle a alguien el muro tal y como lo ve otro.
 */
export const dynamic = 'force-dynamic';

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const config = ctx.iglesia.comunidad;
  const puedePublicar = puedePublicarEnMuro(ctx);

  // Con la comunidad apagada no se pide el muro siquiera: no se va a pintar, y
  // son cuatro consultas y una firma de imágenes contra Storage.
  //
  // El versículo y el devocional SÍ se piden aunque el muro esté apagado: no son
  // del muro, son de la iglesia. Apagar la comunidad es cerrar las
  // publicaciones, no dejar a la congregación sin lo que le toca leer hoy.
  const [muro, versiculo, devocional] = await Promise.all([
    config.activa ? listarMuro(ctx) : Promise.resolve([]),
    versiculoDelDia(ctx),
    devocionalDeHoy(ctx),
  ]);

  const nombre = nombreDeLaCuenta(ctx.user);

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
      <CabeceraMiembro
        logoUrl={ctx.iglesia.logoUrl}
        user={ctx.user}
        titulo="Comunidad"
        subtitulo={ctx.iglesia.nombre}
      />

      {/*
       * `gap-3` en móvil y no `gap-4`: las publicaciones van a sangre —sin borde
       * a los lados— y con cuatro unidades entre ellas el muro se lee como una
       * lista de fichas sueltas en vez de como una conversación seguida. En
       * pantalla ancha vuelven a ser tarjetas y el aire hace falta otra vez.
       */}
      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-6">
        {error && <Aviso tipo="error">{error}</Aviso>}

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
              // El extracto se corta aquí, en el servidor, además del
              // `line-clamp` de la tarjeta: un cuerpo de tres mil caracteres
              // viajaría entero al navegador para enseñar cuarenta.
              cuerpo: devocional.cuerpo.slice(0, 180),
              imagenUrl: devocional.imagenUrl,
              esDeHoy: devocional.esDeHoy,
            }
          }
        />

        {!config.activa ? (
          /*
           * Apagada. Se dice que lo publicado sigue ahí porque la primera
           * lectura de una pantalla vacía es «se ha perdido todo», y esa es
           * exactamente la sensación que la `0027` evita dejando el SELECT
           * fuera de la configuración.
           */
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MessagesSquare className="size-5" strokeWidth={1.7} />
            </span>

            <h2 className="text-[17px] font-bold tracking-[-0.02em]">
              La comunidad está apagada ahora mismo
            </h2>

            <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {ctx.iglesia.nombre} ha cerrado el muro por ahora, así que no se
              puede publicar ni comentar. Lo que se publicó sigue guardado y
              vuelve a verse en cuanto lo enciendan.
            </p>
          </div>
        ) : (
          <>
            {puedePublicar ? (
              <Publicador nombre={nombre} admiteFotos={config.fotos} />
            ) : (
              /* Sobrio y sin regañar: es una decisión de la iglesia sobre su
                 muro, no un castigo a quien lee. */
              <p className="text-pretty rounded-xl border border-border bg-surface px-4 py-3.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {porQueNoPuedesPublicar(ctx)}
              </p>
            )}

            {muro.length === 0 ? (
              /* Un muro vacío no es un error, es el primer día. Se dice así en
                 vez de dejar la pantalla en blanco. */
              <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
                <h2 className="text-[17px] font-bold tracking-[-0.02em]">
                  Todavía no hay nada por aquí
                </h2>
                <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                  Esto lo ve solo la gente de {ctx.iglesia.nombre}. Una foto del
                  domingo o una petición de oración son buenas maneras de
                  empezar.
                </p>
              </div>
            ) : (
              muro.map((p) => (
                <Publicacion
                  key={p.id}
                  publicacion={p}
                  puedeModerar={puedeModerarComunidad(ctx)}
                  admiteComentarios={config.comentarios}
                />
              ))
            )}

            {/* El aviso de las fotos solo si de verdad se pueden subir: un
                texto que describe algo que la pantalla no ofrece es la clase de
                mentira pequeña que este repo ya ha pagado en los legales. */}
            <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-muted-foreground">
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
