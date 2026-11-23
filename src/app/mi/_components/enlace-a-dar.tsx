import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { isNativeApp } from '@/lib/platform/is-native-app';

/**
 * El enlace a la página de dar de la iglesia (`/i/<slug>/dar`) desde la app
 * del miembro: el botón «Dar» de la cabecera, la fila de Mi cuenta y el vacío
 * de «Lo que he dado». Una pieza y no tres enlaces escritos a mano, porque lo
 * que decide aquí es una regla de las tiendas y tiene que cumplirse en los
 * tres sitios a la vez.
 *
 * EN LA APP SE ABRE FUERA
 * -----------------------
 * Apple (norma 3.2.2 de App Review) solo deja recoger donativos dentro de una
 * app de iPhone a organizaciones benéficas que ella misma haya aprobado; a las
 * demás les pide hacerlo fuera, en Safari. `target="_blank"` es lo que lo
 * consigue: en iOS, Capacitor manda toda ventana nueva a
 * `UIApplication.shared.open` (`WebViewDelegationHandler.createWebViewWith`,
 * en `node_modules/@capacitor/ios`), y eso abre Safari. Aunque la dirección
 * sea la de la propia app: `decidePolicyFor` la deja pasar por estar en
 * `allowNavigation`, y como no tiene marco de destino WebKit pide la ventana
 * nueva igual.
 *
 * En Android se queda dentro: Capacitor no activa `setSupportMultipleWindows`
 * ni atiende `onCreateWindow`, así que el WebView carga el `_blank` en sí
 * mismo. Google deja cobrar donativos a entidades exentas sin su sistema de
 * pagos, así que ahí no hace falta salir.
 *
 * En el navegador de siempre, sin `_blank`: ya está en un navegador, y una
 * pestaña nueva solo le dejaría dos Hatril abiertos.
 *
 * `isNativeApp()` mira el User-Agent, que se puede falsificar. Da igual: no
 * protege nada, solo decide por dónde se abre una página pública.
 *
 * OJO CON SAFARI
 * --------------
 * Safari no comparte las cookies del WebView, así que desde el iPhone se da
 * sin sesión, con nombre y correo. Ese donativo no sale en «Lo que he dado»,
 * que va por `donante_auth_user_id`.
 */
export async function EnlaceADar({
  href,
  className,
  children,
  ...resto
}: {
  href: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<'a'>, 'href' | 'className' | 'children' | 'target' | 'rel'>) {
  if (await isNativeApp()) {
    return (
      <a href={href} target="_blank" rel="noopener" className={className} {...resto}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} {...resto}>
      {children}
    </Link>
  );
}
