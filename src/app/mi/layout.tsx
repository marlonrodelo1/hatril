import { getCurrentUserContext } from '@/lib/auth/user-context';
import { esDelEquipo } from '@/lib/auth/permisos';
import { puedePublicarEnMuro } from '@/lib/comunidad/reglas';
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
  const conPestanas = Boolean(ctx) && !esDelEquipo(ctx!);

  if (!conPestanas) return <>{children}</>;

  /*
   * El «+» de la barra abre el compositor del muro, así que solo se pinta si
   * esta persona puede escribir en él. Lo decide la iglesia —el muro puede
   * estar apagado, o abierto solo al equipo— y la policy de la `0027` rechaza
   * el INSERT si no. Un botón que promete algo que la base va a negar es peor
   * que no tener botón.
   *
   * Se calcula aquí, en el layout, y no dentro de la barra: la barra es un
   * componente de cliente y el contexto de iglesia no viaja al navegador.
   */
  const puedePublicar = puedePublicarEnMuro(ctx!);

  return (
    <>
      {children}
      <BarraInferior puedePublicar={puedePublicar} />
      {/*
       * El hueco de la barra, que es `fixed` y flota sobre el contenido. Sin
       * esto la última publicación del muro queda debajo de las pestañas y no
       * hay forma de leerla — y en una lista larga eso no se nota hasta que
       * alguien se queja. En escritorio el hueco es menor: la barra es una
       * pastilla despegada del fondo.
       */}
      <div className="h-[84px] md:h-[92px]" aria-hidden />
    </>
  );
}
