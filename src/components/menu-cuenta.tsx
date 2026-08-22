'use client';

import Link from 'next/link';
import { LayoutDashboard, CreditCard, KeyRound, LogOut, UserRound } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AvatarPersona } from '@/components/avatar-persona';
import { salir } from '@/app/(auth)/actions';

/**
 * El menú de la persona, en la cabecera.
 *
 * POR QUÉ VIVE EN `src/components` Y NO EN `panel/_components`
 * -----------------------------------------------------------
 * Por lo mismo que `campana.tsx`, con la que siempre viaja: una carpeta
 * `_components` dentro de una ruta declara que eso es privado de esa ruta, y
 * dejó de serlo cuando el área del miembro necesitó la misma cabecera. Mover es
 * preferible a copiar: dos copias de este menú serían dos sitios donde añadir
 * la próxima entrada, y una de las dos se olvidaría.
 *
 * QUÉ HABÍA ANTES: NADA
 * ---------------------
 * El bloque del pie del menú lateral —iniciales, nombre y rol— era un `<span>`
 * inerte. No existía ninguna pantalla donde ver o cambiar los propios datos, ni
 * la contraseña estando dentro. Lo único que se podía hacer con la cuenta
 * propia era cerrarla.
 *
 * POR QUÉ SUSCRIPCIÓN CUELGA DE AQUÍ Y NO DE AJUSTES
 * --------------------------------------------------
 * Se planteó meterla dentro de Ajustes para descargar el menú lateral, y es
 * mala idea por un motivo escrito en el propio código de esa pantalla:
 * `/panel/suscripcion` es ruta HERMANA de ajustes a propósito, con su
 * `requirePastor()` en la página y no en un `layout.tsx`, para que el día que
 * exista el muro de suscripción nadie lo herede y acabe cerrando la única
 * puerta que sirve para pagar. Convertirla en hija de Ajustes rompe eso.
 *
 * Así que sale del menú lateral —descargándolo igual— pero mantiene su ruta.
 * Aquí encaja: es dinero, como el resto de este menú.
 *
 * `soloSalir`: EL MENÚ DE QUIEN NO TIENE IGLESIA
 * ----------------------------------------------
 * Las tres opciones de arriba viven bajo `/panel`, detrás de `requireIglesia()`.
 * En el área del miembro puede no haber iglesia: a quien le rechazan la
 * solicitud se le borra la membresía en el mismo movimiento, y su pantalla de
 * avisos —la única del producto que funciona sin congregación— es justo donde
 * lee por qué. Ofrecerle ahí «Tus datos» sería un enlace que rebota a `/mi` sin
 * decir nada. Con `soloSalir` el menú se queda en lo único que esa persona
 * puede hacer con su cuenta: cerrarla.
 */
export function MenuCuenta({
  nombre,
  correo,
  rol,
  fotoUrl,
  esPastor = false,
  alPanel = false,
  soloSalir = false,
}: {
  nombre: string;
  correo: string;
  /** El título del rol, ya traducido. Sin iglesia no hay rol que enseñar. */
  rol?: string;
  /**
   * La foto de la ficha. Sin ella se pintan las iniciales sobre su color, que
   * es lo que ve casi toda la congregación: el pastor da de alta desde una
   * lista, no subiendo retratos.
   */
  fotoUrl?: string | null;
  esPastor?: boolean;
  /**
   * Enseña «Ir al panel», y solo se pide desde el área del miembro.
   *
   * Vive aquí y no en la barra de abajo porque la barra es la navegación del
   * MIEMBRO —comunidad, devocional, agenda, biblia— y salir a la otra mitad de
   * la aplicación es una cosa de cuenta, como «Tus datos» o «Suscripción».
   * Estuvo un commit siendo una quinta pestaña y se veía forzado.
   *
   * Sin esto, quien es del equipo y entra al muro se queda sin salida: la
   * cabecera perdió la flecha de volver el día que se descubrió que apuntaba a
   * una ruta que redirige a la propia pantalla.
   */
  alPanel?: boolean;
  /** Sin iglesia detrás: solo «Cerrar sesión». Ver la cabecera del fichero. */
  soloSalir?: boolean;
}) {
  return (
    <Popover>
      {/*
       * El disparador ES el avatar, así que con foto tiene que pintar la foto y
       * sin ella las iniciales de color — igual que en el muro. Antes pintaba
       * siempre un círculo gris con dos letras, y quedaba como el único sitio de
       * la pantalla donde una persona no tenía cara.
       *
       * `AvatarPersona` ya resuelve los dos casos y deja las iniciales debajo
       * por si la foto no llega, así que aquí solo hay que dejarle sitio: el
       * botón pierde su fondo y su tamaño, que ahora los pone el avatar.
       */}
      <PopoverTrigger
        className="flex flex-none cursor-pointer rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/20"
        aria-label="Tu cuenta"
      >
        <AvatarPersona nombre={nombre} fotoUrl={fotoUrl} />
      </PopoverTrigger>

      <PopoverContent className="flex w-[264px] max-w-[calc(100vw-24px)] flex-col">
        <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
          <span className="truncate text-[14px] font-bold tracking-[-0.01em]">
            {nombre}
          </span>
          {/* El correo y no solo el nombre: es lo que distingue una cuenta de
              otra cuando alguien administra dos iglesias desde el mismo
              navegador. */}
          <span className="truncate text-[12.5px] text-muted-foreground">
            {correo}
          </span>
          {rol && (
            <span className="mt-1 text-[12px] text-muted-foreground">
              {rol}
            </span>
          )}
        </div>

        {!soloSalir && (
          <div className="flex flex-col p-1">
            {alPanel && (
              <Opcion href="/panel/hoy" Icono={LayoutDashboard}>
                Ir al panel
              </Opcion>
            )}
            <Opcion href="/panel/cuenta" Icono={UserRound}>
              Tus datos
            </Opcion>
            <Opcion href="/panel/cuenta/contrasena" Icono={KeyRound}>
              Cambiar la contraseña
            </Opcion>
            {esPastor && (
              <Opcion href="/panel/suscripcion" Icono={CreditCard}>
                Suscripción
              </Opcion>
            )}
          </div>
        )}

        {/* El borde de arriba solo cuando hay algo encima que separar. */}
        <div
          className={
            'p-1 ' + (soloSalir ? '' : 'border-t border-border')
          }
        >
          <form action={salir}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <LogOut className="size-[16px] flex-none" strokeWidth={1.7} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Opcion({
  href,
  Icono,
  children,
}: {
  href: string;
  Icono: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium text-muted-foreground no-underline transition-colors hover:bg-background hover:text-foreground hover:no-underline"
    >
      <Icono className="size-[16px] flex-none" strokeWidth={1.7} />
      {children}
    </Link>
  );
}
