import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

import { getCurrentUserContext } from '@/lib/auth/user-context';
import { esDelEquipo, esPastor, ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { listarNotificaciones } from '@/lib/notificaciones/consultas';
import { paraLaCampana } from '@/lib/notificaciones/campana';
import { nombreDeLaCuenta } from '@/lib/auth/nombre';
import { iniciales } from '@/lib/format/iniciales';
import { MarcaIglesia } from '@/app/panel/_components/marca-iglesia';
import { Campana } from '@/components/campana';
import { MenuCuenta } from '@/components/menu-cuenta';

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
 * `/mi` NO TIENE `layout.tsx`, Y ESO NO ES UN DESCUIDO
 * ----------------------------------------------------
 * Un layout obligaría a resolver ahí el título de cada pantalla, y sobre todo
 * tendría que decidir un guard común. No lo hay: `/mi/comunidad` exige
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
  const avisos = campana ? await listarNotificaciones(user.id) : [];
  const pendientes = avisos.filter((a) => !a.leida).length;

  /*
   * EN VERDE, Y NO EN BLANCO COMO EL RESTO DE CABECERAS
   * ---------------------------------------------------
   * El área del miembro se veía —textualmente— «muy gris, no la veo viva»:
   * crema sobre crema en todas las superficies y ni un punto de color hasta el
   * bloque del versículo. Esta es la primera franja que se ve al abrir la
   * aplicación, así que es donde más rinde el color.
   *
   * Verde `support` y no naranja por lo de siempre: el naranja es de las
   * acciones, y una cabecera naranja competiría con el único botón de cada
   * pantalla.
   *
   * LOS DOS BOTONES DE DENTRO NO SE SABEN VERDES
   * --------------------------------------------
   * `Campana` y `MenuCuenta` son componentes compartidos con el panel, y allí
   * la cabecera sigue siendo clara: llevan `text-muted-foreground`, que sobre
   * verde no se lee. Se recolorean desde aquí con selectores descendentes en
   * vez de añadirles una prop de tono que habría que pasar por las veinticuatro
   * pantallas del panel para no usarla en ninguna.
   *
   * Sus desplegables NO se ven afectados, y es lo que hace que esto sea seguro:
   * Base UI los pinta en un portal, fuera de este `header`, así que el selector
   * no los alcanza y siguen siendo oscuros sobre blanco.
   */
  return (
    <header
      className={
        'sticky top-0 z-20 border-b border-support-hover bg-support text-white ' +
        // Los dos botones de la derecha, vestidos para el fondo verde.
        '[&_button]:text-white/85 hover:[&_button]:bg-white/15 hover:[&_button]:text-white ' +
        '[&_button]:data-popup-open:bg-white/20 [&_button]:data-popup-open:text-white'
      }
    >
      <div className="mx-auto flex max-w-[620px] items-center gap-3 px-4 py-3 sm:px-5">
        {volver && (
          <Link
            href={volver}
            aria-label="Volver"
            className="flex size-9 flex-none items-center justify-center rounded-full text-white/85 no-underline hover:bg-white/15 hover:text-white hover:no-underline"
          >
            <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
          </Link>
        )}

        {logoUrl && (
          <MarcaIglesia logoUrl={logoUrl} iniciales="" nombre={titulo} />
        )}

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15.5px] font-extrabold leading-tight tracking-[-0.02em]">
            {titulo}
          </span>
          {subtitulo && (
            <span className="truncate text-[12.5px] leading-tight text-white/85">
              {subtitulo}
            </span>
          )}
        </span>

        <span className="flex-1" />

        {children}

        {campana && (
          <Campana avisos={paraLaCampana(avisos)} sinLeer={pendientes} />
        )}

        <MenuCuenta
          nombre={nombre}
          correo={user.email ?? ''}
          iniciales={iniciales(nombre)}
          rol={ctx ? ETIQUETAS_ROLES[ctx.rol].titulo : undefined}
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
    </header>
  );
}
