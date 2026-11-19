import Link from 'next/link';
import { ArrowLeft, HandHeart } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

import { getCurrentUserContext } from '@/lib/auth/user-context';
import { estadoDeDar } from '@/lib/donativos/consultas';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { esDelEquipo, esPastor, rolParaMostrar } from '@/lib/auth/permisos';
import { listarNotificaciones } from '@/lib/notificaciones/consultas';
import { paraLaCampana } from '@/lib/notificaciones/campana';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { miFotoDePerfil } from '@/lib/miembros/foto';
import { MarcaIglesia } from '@/app/panel/_components/marca-iglesia';
import { Campana } from '@/components/campana';
import { Logo } from '@/components/marca/logo';
import { MenuCuenta } from '@/components/menu-cuenta';
import { EnlaceADar } from './enlace-a-dar';
import { VigiaTitulo } from './vigia-titulo';

/**
 * La cabecera de cualquier pantalla del área del miembro.
 *
 * POR QUÉ UNA SOLA Y NO TRES
 * --------------------------
 * `/mi`, `/mi/avisos` y `/mi/comunidad` se pintaban cada una su `<header>`, casi
 * iguales y copiados a mano. Ya habían divergido en lo que se ve y en lo que no:
 * dos anchos distintos (560 y 620, así que el contenido saltaba 60 px al navegar
 * entre ellas), una con campana hecha a mano y las otras sin nada, y un botón de
 * «Salir» suelto donde el panel tiene un menú de cuenta entero.
 *
 * EL LAYOUT DE `/mi` NO PINTA LA CABECERA, Y ESO NO ES UN DESCUIDO
 * ----------------------------------------------------------------
 * Tendría que resolver ahí el título de cada pantalla, y sobre todo decidir un
 * guard común. No lo hay: `/mi/comunidad` exige
 * `requireIglesia()` y `/mi/avisos` NO puede exigirlo bajo ningún concepto —a
 * quien le rechazan la solicitud se le borra la membresía en el mismo movimiento
 * y ese aviso es justo el que se lo explica—. Un componente compartido unifica
 * la cabecera sin tocar los guards, que es lo único que aquí no se puede tocar.
 *
 * RECIBE EL `user` PERO NO EL CONTEXTO DE IGLESIA
 * -----------------------------------------------
 * Al revés que `CabeceraPanel`, que resuelve las dos cosas por su cuenta porque
 * la usan veinticuatro pantallas. Aquí son tres, y las tres tienen el `user` en
 * la mano: pedirlo ahorra una validación de sesión contra Supabase por render.
 *
 * El contexto de iglesia sí lo resuelve ella, y es a propósito: de él depende si
 * el menú de cuenta puede ofrecer «Tus datos» o si esa persona no tiene iglesia
 * y esos enlaces la rebotarían. Dejar esa decisión en cada página es dejar tres
 * sitios donde equivocarse en el único caso que importa. Sale gratis porque
 * `getCurrentUserContext` está envuelto en `cache()` de React: donde la página
 * ya lo pidió, esta llamada no vuelve a viajar a Postgres.
 */
export async function CabeceraMiembro({
  user,
  titulo,
  subtitulo,
  volver,
  campana = true,
  logoUrl,
  marca = false,
  children,
}: {
  /** La sesión, que las tres páginas ya tienen resuelta antes de pintar nada. */
  user: User;
  titulo: string;
  subtitulo?: string;
  /** A dónde lleva la flecha de la izquierda. Sin ella, no se pinta. */
  volver?: string;
  /**
   * La campana. Se apaga en las pantallas donde sobra: en `/mi/avisos`, que ya
   * ES la bandeja, y en `/mi`, la sala de espera de quien todavía no tiene
   * congregación.
   */
  campana?: boolean;
  /**
   * El logo de la iglesia. Sin él no se pinta nada a la izquierda, que es el
   * caso de la sala de espera: quien todavía no tiene congregación no tiene
   * logo que enseñar, y unas iniciales de «Hatril» ahí no dicen nada.
   */
  logoUrl?: string | null;
  /**
   * El logotipo de Hatril en lugar del título. Es para la sala de espera, la
   * única pantalla sin iglesia que nombrar, donde el título era «Hatril» a
   * secas. El `titulo` se sigue pidiendo: es el nombre de la pantalla.
   */
  marca?: boolean;
  /** Las acciones de ESTA pantalla: «Marcar todo»… */
  children?: React.ReactNode;
}) {
  const ctx = await getCurrentUserContext();
  const nombre = nombreDeLaCuenta(user);

  /*
   * Los avisos solo se piden si hay campana que pintar. Y el número de sin leer
   * sale de la propia lista en vez de la consulta `sinLeer()` que usa el panel:
   * esa pide el contexto de iglesia entero y aquí puede no haberlo. Para un
   * punto rojo el recuento exacto da igual —la lista viene cortada en 40—, y a
   * cambio es una consulta y no dos.
   */
  // La foto de quien mira, para que el avatar de la cabecera sea el suyo y no
  // dos letras. Solo se pide si hay contexto: sin iglesia no hay ficha.
  const miFoto = ctx ? await miFotoDePerfil(ctx) : null;

  const avisos = campana ? await listarNotificaciones(user.id) : [];
  const pendientes = avisos.filter((a) => !a.leida).length;

  /*
   * CREMA, COMO EL RESTO DE LA APLICACIÓN
   * -------------------------------------
   * Fue verde `support` desde que el área se veía —textualmente— «muy gris, no
   * la veo viva», y el 15-oct a Marlon dejó de gustarle: pidió la paleta de
   * Claude, crema con naranja quemado. La cabecera de Claude es del color de la
   * página, y aquí también.
   *
   * Lo que impide que vuelva lo de «muy gris» ya no es la cabecera: debajo
   * está la portada con foto del día, y la pestaña activa lleva el naranja.
   *
   * Glaseado con guarda, igual que la barra de abajo: sin `backdrop-filter` un
   * fondo translúcido deja el texto ilegible sobre lo que pase por debajo al
   * desplazar, y con la guarda ese navegador cae a crema sólido.
   *
   * Los dos botones de la derecha, `Campana` y `MenuCuenta`, vuelven a su
   * aspecto de siempre, el del panel: ya no hay fondo de color que les obligue
   * a vestirse de blanco.
   */
  /*
   * EL TÍTULO GRANDE QUE SE RECOGE (base común, 17-nov)
   *
   * En las pantallas de primer nivel (las de la barra de abajo: sin flecha de
   * volver y sin el logotipo de Hatril), el título va grande debajo de la
   * cabecera, como `<h1>`, y al bajar se recoge en la barra de arriba. Es el
   * patrón de iOS y Android, y le da a cada pantalla de `/mi` el título de
   * página que no tenía (inventario, D12).
   *
   * Quien decide cuándo se ha recogido es `VigiaTitulo`, en el cliente, con un
   * IntersectionObserver: pone `data-recogida` en la cabecera. Sin JavaScript
   * el título grande se ve igual y el chico se queda escondido, que no pierde
   * nada. En las pantallas de detalle (con flecha) el título va arriba como
   * siempre, y ahí es él el `<h1>`.
   */
  const grande = !volver && !marca;
  const TituloChico = grande ? 'span' : 'h1';

  /*
   * «DAR», EN LAS PESTAÑAS (diezmos y ofrendas, 18-nov)
   *
   * Solo en las pantallas de primer nivel —las de la barra de abajo y Mi
   * cuenta—, que es lo aprobado: «sale igual en todas las pestañas». En las de
   * detalle, con su flecha y el título arriba, no cabría junto a un título
   * largo y no es el sitio desde el que se va a dar.
   *
   * Y solo si la iglesia tiene a dónde: un botón que lleva a «tu iglesia no ha
   * configurado esto» le pasa el problema a quien no puede resolverlo, que es
   * lo mismo que ya decidía si salía la cuenta en Mi cuenta. Con tarjeta va a
   * la página de dar; solo con transferencia, a la cuenta del banco de Mi
   * cuenta, que es lo único que hay.
   */
  const dar = grande && ctx ? await estadoDeDar(ctx.iglesia.id) : null;

  return (
    <>
    <header
      data-cabecera-miembro=""
      data-recogida={grande ? 'no' : undefined}
      className="group/cabecera sticky top-0 z-20 border-b border-border bg-background supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-[620px] items-center gap-3 px-4 py-3 sm:px-5">
        {volver && (
          <Link
            href={volver}
            aria-label="Volver"
            className="flex size-9 flex-none items-center justify-center rounded-full text-muted-foreground no-underline hover:bg-surface-active hover:text-foreground hover:no-underline"
          >
            <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
          </Link>
        )}

        {logoUrl && (
          <MarcaIglesia logoUrl={logoUrl} iniciales="" nombre={titulo} />
        )}

        {marca ? (
          <Logo variante="logotipo" tamano={22} />
        ) : (
          <span
            className={
              'flex min-w-0 flex-col ' +
              (grande
                ? 'transition-[opacity,translate] duration-240 ease-hatril group-data-[recogida=no]/cabecera:translate-y-1 group-data-[recogida=no]/cabecera:opacity-0 motion-reduce:transition-none'
                : '')
            }
            aria-hidden={grande || undefined}
          >
            <TituloChico className="truncate text-[15.5px] font-extrabold leading-tight tracking-[-0.02em]">
              {titulo}
            </TituloChico>
            {subtitulo && (
              <span className="truncate text-[12.5px] leading-tight text-muted-foreground">
                {subtitulo}
              </span>
            )}
          </span>
        )}

        {/*
         * Lo de la derecha, junto y empujado con `ml-auto`. Antes un `<span
         * class="flex-1">` hacía de muelle, y como hijo de la fila se llevaba
         * su hueco de 12 px a cada lado aunque midiera cero. Con «Dar» al lado
         * de la campana hacía falta ese sitio para el título que se recoge: con
         * el muelle y huecos de 12, a 390 px «Devocional» se quedaba en «De…».
         * Entre botones de 36 px, 8 de hueco siguen sin juntar los dedos.
         */}
        <div className="ml-auto flex flex-none items-center gap-2">
          {children}

          {ctx && dar && (dar.conTarjeta || dar.conTransferencia) && (
            <BotonDar
              slug={ctx.iglesia.slug}
              conTarjeta={dar.conTarjeta}
              compacto={Boolean(children)}
            />
          )}

          {campana && (
            <Campana avisos={paraLaCampana(avisos)} sinLeer={pendientes} />
          )}

          <MenuCuenta
            nombre={nombre}
            correo={user.email ?? ''}
            fotoUrl={miFoto}
            rol={ctx ? rolParaMostrar(ctx) : undefined}
            esPastor={ctx !== null && esPastor(ctx)}
            // Pastor, secretaría, tesorería o líder: gente que tiene panel al que
            // volver. El miembro raso no, y ofrecérselo sería un enlace que le
            // rebota.
            alPanel={ctx !== null && esDelEquipo(ctx)}
            // Sin iglesia, las tres opciones del menú viven detrás de
            // `requireIglesia()` y devolverían a esta misma persona a `/mi`.
            soloSalir={ctx === null}
          />
        </div>
      </div>
    </header>

    {grande && (
      <div className="mx-auto w-full max-w-[620px] px-4 pt-5 sm:px-5">
        <h1 className="t-titulo text-balance">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1 text-label text-muted-foreground">{subtitulo}</p>
        )}
        <VigiaTitulo />
      </div>
    )}
    </>
  );
}

/**
 * El botón «Dar» de la cabecera.
 *
 * Con la palabra y no solo el icono: una mano con un corazón, sola, se lee
 * como «me gusta». De contorno, alto 36 y esquinas de 8 px como el resto de
 * botones, y nunca naranja: fijo en la cabecera de todas las pestañas,
 * competiría con el botón principal de cada pantalla.
 *
 * `compacto`, en las pantallas que ya traen sus propias acciones arriba (el
 * A−/A+ del devocional): ahí, en el móvil, va solo el icono. Medido a 390 px,
 * con la palabra «Devocional» se quedaba en «De…»; con el icono cabe entero.
 * La palabra pasa a `sr-only`, que es el nombre que anuncia el lector de
 * pantalla (lo mismo que un `aria-label="Dar"`, sin escribirla dos veces). En
 * las demás pestañas cabe con la palabra hasta a 360 px.
 */
function BotonDar({
  slug,
  conTarjeta,
  compacto,
}: {
  slug: string;
  conTarjeta: boolean;
  compacto: boolean;
}) {
  // `cn` y no `clsx`: hay que QUITAR el relleno y el hueco del `sm` de serie
  // (14 y 8 px), no sumarles otro. Un punto más prietos porque es la pieza que
  // más sitio le quita al título.
  const clases = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'gap-1.5 px-3',
    compacto && 'max-sm:w-9 max-sm:px-0',
  );
  const cuerpo = (
    <>
      <HandHeart className="size-4" strokeWidth={1.8} aria-hidden />
      <span className={compacto ? 'max-sm:sr-only' : undefined}>Dar</span>
    </>
  );

  // Solo con transferencia no hay página de dar a la que ir: lleva a la
  // cuenta del banco de Mi cuenta, que no es cobrar y se queda en la app.
  if (!conTarjeta) {
    return (
      <Link href="/mi/cuenta#ofrendar" className={clases}>
        {cuerpo}
      </Link>
    );
  }
  return (
    <EnlaceADar href={`/i/${slug}/dar`} className={clases}>
      {cuerpo}
    </EnlaceADar>
  );
}
