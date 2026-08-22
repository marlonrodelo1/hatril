import { getCurrentUserContext } from '@/lib/auth/user-context';
import { BarraInferior } from './_components/barra-inferior';

/**
 * El marco del área del miembro.
 *
 * AQUÍ NO HAY GUARD, Y ES DELIBERADO
 * ----------------------------------
 * Es la excepción a la regla del repo —«los guards van en el layout»— y tiene un
 * motivo concreto: bajo `/mi` conviven pantallas con requisitos distintos.
 * `/mi/avisos` funciona SIN membresía, porque a quien le rechazan la solicitud
 * se le borra la membresía en el mismo movimiento y el aviso que se lo explica
 * quedaría fuera de su alcance. Un `requireIglesia()` aquí lo dejaría fuera.
 *
 * Cada página pone el suyo. Lo único que hace este layout es decidir si pinta
 * las pestañas.
 *
 * Y NO LAS PINTA PARA CUALQUIERA
 * ------------------------------
 * Solo para quien pertenece a una iglesia y no lleva nada en ella. Los otros dos
 * casos verían una barra que no les sirve: quien todavía no tiene congregación
 * —la sala de espera— no tiene comunidad ni devocional a los que ir, y quien
 * lleva algo vive en el panel y solo pasa por aquí de rebote.
 */
export default async function MiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getCurrentUserContext();

  /*
   * LA BARRA ES PARA TODO EL QUE TENGA IGLESIA, TAMBIÉN PARA EL EQUIPO
   *
   * Antes se pintaba solo para el miembro raso: quien llevaba algo en la
   * congregación «vivía en el panel y solo pasaba por aquí de rebote». Eso dejó
   * de ser verdad el día que se quitó la flecha de volver de la cabecera —que
   * apuntaba a `/mi`, o sea, a esta misma pantalla—: un pastor que entra al muro
   * se quedaba sin barra Y sin flecha, es decir, sin ninguna forma de salir que
   * no fuera escribir la dirección a mano.
   *
   * Ahora la ve todo el mundo. La vuelta al panel para el equipo NO está en la
   * barra —eso duró un commit— sino en el menú del avatar: la barra es la
   * navegación del miembro, y salir a otra aplicación es una cosa de cuenta.
   */
  if (!ctx) return <>{children}</>;

  return (
    <>
      {children}
      <BarraInferior />
      {/*
       * El hueco de la barra, que es `fixed` y flota sobre el contenido. Sin
       * esto la última publicación del muro queda debajo de las pestañas y no
       * hay forma de leerla — y en una lista larga eso no se nota hasta que
       * alguien se queja. En escritorio el hueco es menor: la barra es una
       * pastilla despegada del fondo.
       */}
      <div className="h-[76px] md:h-[88px]" aria-hidden />
    </>
  );
}
