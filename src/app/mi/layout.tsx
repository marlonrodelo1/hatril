import { getCurrentUserContext } from '@/lib/auth/user-context';
import { radioDeLaIglesia } from '@/lib/emisora/consultas';
import { BarraInferior } from './_components/barra-inferior';
import { MiniReproductor } from './_components/mini-reproductor';

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

  // Solo si la iglesia tiene una radio encendida y con señal. Sin ella no se
  // pinta nada: ni un hueco, ni un botón apagado.
  const radio = await radioDeLaIglesia(ctx);

  return (
    <>
      {children}
      {radio && (
        <MiniReproductor
          nombre={radio.nombre}
          streamUrl={radio.streamUrl}
          parrilla={radio.parrilla}
          timezone={ctx.iglesia.timezone}
          iglesiaNombre={ctx.iglesia.nombre}
          caratula={ctx.iglesia.logoUrl}
        />
      )}
      <BarraInferior />
      {/*
       * El hueco de la barra, que es `fixed` y flota sobre el contenido. Sin
       * esto la última publicación del muro queda debajo de las pestañas y no
       * hay forma de leerla — y en una lista larga eso no se nota hasta que
       * alguien se queja. En escritorio el hueco es menor: la barra es una
       * pastilla despegada del fondo.
       *
       * UN SOLO HUECO, Y CUENTA CON LA RADIO
       * ------------------------------------
       * Con radio, encima de la barra flota también el reproductor, y el hueco
       * es el de los dos: barra (12 + 65 px) + 6 + reproductor (54) en el móvil,
       * y en escritorio (20 + 52) + 6 + 54, más el mismo margen que ya dejaba
       * el hueco sin radio. Medidos con `getBoundingClientRect`, a 375 y a 1024:
       * lo último de cada pantalla de `/mi` queda entre 19 y 42 px por encima
       * del reproductor. Va aquí y no dentro del
       * reproductor para que quien añada una pantalla a `/mi` vea en un solo
       * sitio todo lo que tapa el final.
       *
       * Y con la zona segura del iPhone sumada en el móvil, porque la barra la
       * suma a su `bottom`: sin ella, con la raya de gestos, los últimos 34 px
       * de cada pantalla quedaban debajo de las pestañas.
       */}
      <div
        className={
          radio
            ? 'h-[calc(140px+env(safe-area-inset-bottom))] md:h-[148px]'
            : 'h-[calc(76px+env(safe-area-inset-bottom))] md:h-[88px]'
        }
        aria-hidden
      />
    </>
  );
}
