import Link from 'next/link';
import type { Metadata } from 'next';

import {
  DATOS_RESPONSABLE,
  ENCARGADOS,
  faltanDatosLegales,
} from '@/lib/legal/datos-responsable';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import {
  AvisoBorrador,
  Dato,
  Entradilla,
  Lista,
  P,
  Recuadro,
  Seccion,
  Titulo,
} from '../_components/prosa';

export const metadata: Metadata = {
  title: 'Privacidad',
  description:
    'Qué datos guarda Hatril, por qué puede guardarlos y cómo se ejercen los derechos sobre ellos.',
};

/**
 * Política de privacidad.
 *
 * ESTA PÁGINA NO ES UN TRÁMITE
 * ----------------------------
 * El formulario de solicitud de ingreso enlaza aquí para recoger el
 * consentimiento del art. 9.2.a. Mientras daba 404, Hatril estaba pidiendo
 * consentimiento «informado» remitiendo a una página que no existía: el
 * consentimiento así no vale, y con él se cae la base jurídica de todo el
 * fichero de miembros.
 *
 * ESCRITA PARA QUE LA ENTIENDA UN PASTOR
 * --------------------------------------
 * Quien la lee no es un abogado: es alguien decidiendo si mete en una web los
 * nombres de las familias de su congregación. Por eso va en segunda persona y
 * sin latinajos, y los artículos concretos se citan solo donde aportan algo.
 * El art. 12.1 no pide solemnidad, pide lenguaje claro y sencillo.
 *
 * LA VERSIÓN IMPORTA
 * ------------------
 * El pie enseña `VERSION_POLITICA_PRIVACIDAD`, que es lo que se guarda con cada
 * consentimiento. Si se cambia el fondo de esta página hay que subir esa
 * constante Y volver a pedir el consentimiento a quien aceptó la anterior.
 * Cambiar el texto a solas deja la base diciendo que la gente aceptó algo que
 * nunca leyó.
 */
export default function PrivacidadPage() {
  const r = DATOS_RESPONSABLE;
  const activos = ENCARGADOS.filter((e) => e.activo);
  const futuros = ENCARGADOS.filter((e) => !e.activo);

  return (
    <>
      <Titulo>Privacidad</Titulo>
      <Entradilla>
        Hatril guarda datos que la ley protege de forma reforzada, porque saber
        que alguien pertenece a una iglesia dice algo de sus creencias. Esto
        explica qué guardamos, por qué podemos hacerlo y cómo pedir que lo
        borremos.
      </Entradilla>

      {faltanDatosLegales() && (
        <AvisoBorrador>
          <strong className="font-bold">Este texto está sin terminar.</strong>{' '}
          Falta identificar al proveedor de alojamiento en el apartado 5. No debe
          publicarse ni recogerse ningún consentimiento contra esta versión hasta
          que ese dato esté relleno en{' '}
          <code className="rounded bg-surface-alt px-1 py-px text-[13px]">
            src/lib/legal/datos-responsable.ts
          </code>
          .
        </AvisoBorrador>
      )}

      <Seccion numero={1} titulo="Quién responde de tus datos">
        <Recuadro>
          <Dato etiqueta="Responsable">{r.razonSocial}</Dato>
          <Dato etiqueta="NIF">{r.nif}</Dato>
          <Dato etiqueta="Domicilio">{r.domicilio}</Dato>
          <Dato etiqueta="Contacto">
            <a href={`mailto:${r.email}`}>{r.email}</a>
          </Dato>
          <Dato etiqueta="Servicio">{r.marca}</Dato>
        </Recuadro>
        <P>
          Hatril opera como marca de la persona indicada arriba. No hay sociedad
          detrás, así que responde ella directamente.
        </P>
      </Seccion>

      <Seccion numero={2} titulo="Dos papeles distintos, y conviene separarlos">
        <P>
          Tu iglesia decide qué datos recoge de su congregación y para qué. Ella
          es la <strong className="font-semibold">responsable</strong> de ese
          fichero.
        </P>
        <P>
          Hatril es la herramienta donde esos datos viven. Nosotros somos{' '}
          <strong className="font-semibold">encargados del tratamiento</strong>:
          hacemos lo que la iglesia nos pide y nada más. No vendemos datos, no
          los usamos para publicidad y no los cruzamos entre congregaciones.
        </P>
        <P>
          Esa relación no es de palabra: está en el anexo de{' '}
          <Link href="/terminos#s7">los términos</Link>, que la iglesia acepta al
          registrarse, tal como exige el artículo 28 del RGPD.
        </P>
        <P>
          Por eso, si quieres corregir o borrar tu ficha, lo más rápido es
          hablarlo con tu iglesia. Si no obtienes respuesta, escríbenos a{' '}
          <a href={`mailto:${r.email}`}>{r.email}</a> y lo resolvemos nosotros.
        </P>
      </Seccion>

      <Seccion numero={3} titulo="Qué guardamos">
        <P>De quien tiene cuenta y ficha en una iglesia:</P>
        <Lista>
          <li>
            Nombre y apellidos, correo y teléfono. Lo mínimo para localizarte y
            para que puedas entrar.
          </li>
          <li>
            Tu vínculo con la congregación: desde cuándo, en qué situación estás
            y en qué ministerios sirves.
          </li>
          <li>
            Si tu iglesia los usa: dirección, fecha de nacimiento, estado civil y
            notas pastorales. Estos van aparte y solo los ve quien tenga permiso
            expreso para ello.
          </li>
          <li>
            El registro de tus consentimientos, con su fecha y la versión del
            texto que aceptaste. Es la prueba de que te preguntamos.
          </li>
        </Lista>
        <P>
          De quien solo pide entrar desde el directorio: nombre, correo,
          teléfono si lo das, y el mensaje que escribas.
        </P>
        <P>
          De quien se apunta a un evento abierto sin tener cuenta: nombre,
          correo, teléfono si lo das, cuántas personas te acompañan, lo que
          escribas en la nota, y si la iglesia ha marcado tu plaza como pagada.
          Guardamos también la dirección IP y el navegador desde el que te
          apuntaste. Sirven para una sola cosa: demostrar que el permiso lo diste
          tú. Si te apunta la iglesia porque llamaste por teléfono, no se guarda
          ninguna de las dos: la IP sería la suya, no la tuya. Apuntarte a un
          acto de una iglesia dice algo de tus creencias, así que ese dato lleva
          la misma protección que el de un miembro.{' '}
          <strong className="font-semibold">
            Apuntarte a un evento no te hace miembro de nada
          </strong>{' '}
          y no te damos de alta en el fichero de la congregación.
        </P>
        <P>
          Del dinero de la iglesia guardamos lo que entra y lo que sale: importe,
          concepto y fecha, y si una ofrenda fue diezmo o donativo para poder
          sumarlos por separado.{' '}
          <strong className="font-semibold">
            No hay ninguna casilla para el nombre de quien da.
          </strong>{' '}
          El concepto lo escribe a mano el tesorero de tu iglesia, y le pedimos
          que no ponga nombres ahí.
        </P>
        <P>
          Lo único que sí une a una persona con un pago es la marca de «plaza
          pagada» de un evento, y eso lo apunta la iglesia, no nosotros.
        </P>
        <P>
          <strong className="font-semibold">
            No pedimos datos bancarios a los miembros y no cobramos nada por
            cuenta de tu iglesia.
          </strong>{' '}
          Los donativos y las entradas de los eventos no pasan por Hatril: si tu
          iglesia publica una cuenta o un enlace de pago, son suyos y el dinero va
          directo a ella. Lo único que guardamos de eso es la anotación que hace
          la propia iglesia de quién ha pagado su plaza, que es un apunte suyo y
          no una comprobación nuestra.
        </P>
      </Seccion>

      <Seccion numero={4} titulo="Por qué podemos guardarlos">
        <P>
          Que alguien esté en el fichero de una iglesia revela su confesión
          religiosa, y el artículo 9 del RGPD prohíbe tratar ese tipo de dato
          salvo excepciones. Aquí nos apoyamos en dos cosas a la vez:
        </P>
        <Lista>
          <li>
            <strong className="font-semibold">Tu consentimiento explícito</strong>{' '}
            (art. 9.2.a). Es la casilla que marcas al pedir entrar, y puedes
            retirarla cuando quieras.
          </li>
          <li>
            <strong className="font-semibold">El contrato con tu iglesia</strong>{' '}
            (art. 6.1.b y art. 28), que es lo que nos permite prestarle el
            servicio.
          </li>
        </Lista>
        <P>
          <strong className="font-semibold">
            Si te apuntas a un evento sin ser de la iglesia
          </strong>{' '}
          la única base es tu consentimiento explícito, el que das en ese mismo
          formulario. No hay contrato contigo y no estás en el fichero de la
          congregación. Usamos tus datos para organizar ese evento y para avisarte
          si cambia o se cancela, y para nada más: ni te apuntamos a una lista de
          correo, ni te escribimos por otra cosa.
        </P>
        <P>
          Retirar el consentimiento no tiene más consecuencia que dejar de
          aparecer, y lo que ya pasó antes sigue siendo válido: lo dice el art.
          7.3. Todavía no hay un botón para hacerlo tú desde la aplicación:
          escríbele a tu iglesia, o a{' '}
          <a href={`mailto:${r.email}`}>{r.email}</a>, y lo tramitamos a mano,
          sin coste y sin pedirte explicaciones.
        </P>
      </Seccion>

      <Seccion numero={5} titulo="Quién más los toca">
        <P>
          Nadie más de lo imprescindible para que esto funcione. Estos son todos,
          con lo que hace cada uno:
        </P>
        <Recuadro>
          {activos.map((e) => (
            <Dato key={e.nombre} etiqueta={e.nombre}>
              {e.finalidad}.{' '}
              <span className="text-muted-foreground">{e.ubicacion}</span>
            </Dato>
          ))}
        </Recuadro>
        <P>
          Estos dos están integrados pero{' '}
          <strong className="font-semibold">todavía no en uso</strong>. Se
          nombran ahora para no tener que avisarte de un cambio el día que se
          activen:
        </P>
        <Recuadro>
          {futuros.map((e) => (
            <Dato key={e.nombre} etiqueta={e.nombre}>
              {e.finalidad}.{' '}
              <span className="text-muted-foreground">{e.ubicacion}</span>
            </Dato>
          ))}
        </Recuadro>
        <P>
          Ninguna otra iglesia de Hatril puede ver los datos de la tuya. Eso no
          lo garantiza nuestra buena intención: lo impone la base de datos, que
          rechaza la consulta aunque la aplicación se equivoque al pedirla.
        </P>
      </Seccion>

      <Seccion numero={6} titulo="Cuánto tiempo">
        <Lista>
          <li>
            Mientras tu iglesia use Hatril y tú sigas siendo parte de ella.
          </li>
          <li>
            Si te das de baja de la congregación, tu ficha se marca como baja y
            deja de estar a la vista. Tu iglesia puede conservarla como histórico
            —a quién bautizó, quién sirvió y cuándo— porque forma parte de su
            memoria.
          </li>
          <li>
            Si pides que se borre, se borra. Lo único que se conserva es el
            registro de que hubo un consentimiento y de que lo retiraste, porque
            sin eso no podríamos demostrar que actuamos bien. Una ficha de
            miembro que se da de baja no se borra sola: queda archivada como
            histórico hasta que pidas el borrado.
          </li>
          <li>
            Las listas de inscritos a un evento son de la iglesia y las borra
            ella. Lo que tiene pactado con nosotros es no guardarlas más de 90
            días desde que el evento termina, y tiene un botón para borrarlas de
            una vez. Si quieres que borren solo lo tuyo, y antes, pídeselo: puede
            hacerlo sin esperar a que pase el evento y sin tocar los datos de
            nadie más. Si no obtienes respuesta, escríbenos y lo hacemos
            nosotros.
          </li>
          <li>
            Si una iglesia deja Hatril, sus datos se eliminan a los 60 días de
            cerrar la cuenta. Ese plazo existe para que le dé tiempo a llevarse
            una copia.
          </li>
        </Lista>
      </Seccion>

      <Seccion numero={7} titulo="Qué puedes exigir">
        <P>
          Los derechos de los artículos 15 a 22 del RGPD, en cristiano: saber qué
          tenemos tuyo, corregirlo, borrarlo, llevártelo a otro sitio, pedir que
          dejemos de usarlo y oponerte a que lo usemos.
        </P>
        <P>
          Escribe a <a href={`mailto:${r.email}`}>{r.email}</a> desde el correo
          con el que te apuntaste o con el que estés registrado, y contestamos en
          un mes como máximo. No cobramos por ello.
        </P>
        <P>
          Si crees que lo hemos hecho mal puedes reclamar ante la Agencia
          Española de Protección de Datos (
          <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
            aepd.es
          </a>
          ). Preferimos que nos escribas antes, pero no hace falta: el derecho a
          reclamar no depende de que nos avises.
        </P>
      </Seccion>

      <Seccion numero={8} titulo="Si estás en Colombia">
        <P>
          Se aplica también la Ley 1581 de 2012. Tu pertenencia religiosa es un
          dato sensible según su artículo 5, y su artículo 6 exige que se te diga
          claramente que{' '}
          <strong className="font-semibold">
            no estás obligado a darlo
          </strong>
          . No lo estás: puedes negarte, y puedes retirarlo después.
        </P>
        <P>
          Los derechos de conocer, actualizar, rectificar y suprimir se ejercen
          en la misma dirección de arriba. La autoridad de control es la
          Superintendencia de Industria y Comercio.
        </P>
      </Seccion>

      <Seccion numero={9} titulo="Cookies">
        <P>
          Hatril usa <strong className="font-semibold">solo cookies técnicas</strong>:
          las que mantienen tu sesión abierta cuando entras. Sin ellas tendrías
          que identificarte en cada página.
        </P>
        <P>
          No hay analítica, ni seguimiento, ni cookies de terceros, ni
          publicidad. Por eso tampoco verás un cartel pidiéndote permiso: la ley
          solo lo exige para las que no son necesarias, y aquí no hay ninguna.
        </P>
      </Seccion>

      <Seccion numero={10} titulo="Si esto cambia">
        <P>
          Cuando cambiemos algo de fondo lo verás en la fecha del pie, y esa
          fecha es la única señal fiable: todavía no mandamos correos. Si el
          cambio afecta a aquello que consentiste, volveremos a preguntártelo: no
          damos por bueno un permiso dado sobre un texto distinto.
        </P>
      </Seccion>

      <footer className="mt-12 flex flex-col gap-1 border-t border-border pt-6 text-[13.5px] text-muted-foreground">
        <span>
          Versión{' '}
          <code className="rounded bg-surface px-1 py-px">
            {VERSION_POLITICA_PRIVACIDAD}
          </code>
          . Última actualización: {r.ultimaActualizacion}.
        </span>
        <span>
          Es la versión que queda registrada junto a cada consentimiento.
        </span>
      </footer>
    </>
  );
}
