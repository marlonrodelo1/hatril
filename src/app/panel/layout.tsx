import { redirect } from 'next/navigation';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esDelEquipo } from '@/lib/auth/permisos';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { flagsDelMenu } from '@/lib/panel/menu';
import { leerEstadoSuscripcion } from '@/lib/suscripcion/estado';
import { iniciales } from '@/lib/format/iniciales';
import { PanelSidebar } from './_components/sidebar';
import { AvisoSuscripcion } from './_components/aviso-suscripcion';

/**
 * Marco del panel.
 *
 * `requireIglesia()` va aquí y no en cada página: puesto en el layout cubre la
 * sección entera, incluidas las rutas dinámicas. Gonper lo hacía página a
 * página y ahí es donde se le quedaron los huecos — `/panel/clientes` guardado
 * y `/panel/clientes/[id]` sin guardar.
 *
 * Ojo: esto NO es lo que aísla una iglesia de otra. Eso lo hacen las policies
 * de RLS y `withUser()`. Si este guard faltara, lo peor que pasa es que se vea
 * una pantalla vacía; sin la RLS, se verían los datos de otra congregación.
 *
 * QUÉ SE FUE DE AQUÍ
 * ------------------
 * El cálculo de qué secciones tocan y sus contadores, que estaba escrito a mano
 * en este fichero. Ahora vive en `lib/panel/menu.ts` porque lo piden dos
 * menús —el lateral y el de móvil, que sale de la cabecera de cada página— y
 * con el cálculo aquí el segundo no podía verlo.
 *
 * También se fue `sinLeer()`: el contador de avisos ya no cuelga del menú sino
 * de la campana de la cabecera, que lo pide donde lo pinta.
 */
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireIglesia();

  // El panel es de quien lleva la iglesia. Un miembro raso tiene su área en
  // `/mi`, y `esDelEquipo()` decide mirando las capacidades efectivas y no el
  // nombre del rol — el porqué está en `permisos.ts`.
  //
  // Va aquí y no en `requireIglesia()` porque ese guard lo usa también
  // `/mi/comunidad`, y meterlo dentro mandaría al miembro de `/mi` a `/mi` para
  // siempre. Mismo motivo que el corte de abajo.
  if (!esDelEquipo(ctx)) redirect('/mi');

  // El corte del re-consentimiento, y va AQUÍ y no en `requireIglesia()`.
  //
  // Puesto en el guard cubriría también `/acepta`, que llama a lo mismo, y esa
  // pantalla se redirigiría a sí misma para siempre. En el layout del panel
  // corta lo que hay que cortar —todo lo que trata datos— y deja abierta la
  // única ruta que permite salir del estado.
  //
  // Solo alcanza a quien ACEPTÓ una versión anterior. Quien nunca aceptó nada
  // —toda ficha tecleada por el pastor— pasa de largo: pararle el panel a media
  // congregación por un consentimiento que jamás se le pidió sería castigar a la
  // iglesia por una decisión de diseño anterior. El porqué, en `rgpd/consultas.ts`.
  await exigirConsentimientoAlDia(ctx);

  /*
   * El muro de suscripción, y solo cuando ya no queda ni la gracia de lectura.
   *
   * VA A UNA RUTA DE FUERA DEL PANEL, Y NO SE PINTA AQUÍ
   * ----------------------------------------------------
   * Lo natural sería pintar el muro en lugar de `{children}`. No sirve, y la
   * razón está en la documentación de Next: un layout **no se vuelve a ejecutar
   * al navegar** entre rutas que comparte, y además «no controla si el resto de
   * la ruta se renderiza». Un muro pintado aquí se esquivaría con un clic del
   * menú, que seguiría estando a la vista.
   *
   * Con `redirect()` a `/suscripcion` —que cuelga de la raíz, no del panel— la
   * persona sale de esta sección y ya no hay layout que mantener al día. Y
   * `/suscripcion` hace lo contrario: si la iglesia vuelve a tener acceso,
   * devuelve al panel. Las dos condiciones son la misma función negada, que es
   * lo que impide que se llamen entre ellas para siempre.
   *
   * En `solo_lectura` NO se corta: el panel sigue navegable durante los tres
   * días de gracia y lo único que se bloquea es guardar, que lo hace
   * `exigirPoderEscribir()` en el guard de cada server action.
   */
  if (leerEstadoSuscripcion(ctx.iglesia).situacion === 'bloqueada') {
    redirect('/suscripcion');
  }

  const flags = await flagsDelMenu(ctx);

  return (
    <div className="flex min-h-dvh bg-background">
      <PanelSidebar
        flags={flags}
        iglesiaNombre={ctx.iglesia.nombre}
        iglesiaCiudad={ctx.iglesia.ciudad}
        iglesiaIniciales={iniciales(ctx.iglesia.nombre)}
        iglesiaLogo={ctx.iglesia.logoUrl}
        webIglesia={ctx.iglesia.webPublica ? `/i/${ctx.iglesia.slug}` : null}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Encima de la cabecera de cada pantalla a propósito: es lo único que
            afecta a la iglesia entera, y dentro del contenido se perdería entre
            lo que cada sección tenga ese día. */}
        <AvisoSuscripcion ctx={ctx} />
        {children}
      </main>
    </div>
  );
}
