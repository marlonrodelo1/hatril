import Link from 'next/link';
import type { Metadata } from 'next';

import {
  DATOS_RESPONSABLE,
  ENCARGADOS,
  faltanDatosLegales,
} from '@/lib/legal/datos-responsable';
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
  title: 'Términos',
  description:
    'Condiciones de uso de Hatril y el encargo de tratamiento que se firma con cada iglesia.',
};

/**
 * Condiciones del servicio y encargo de tratamiento.
 *
 * EL ANEXO ES LA MITAD IMPORTANTE
 * -------------------------------
 * El apartado 7 no es relleno jurídico: es el contrato del art. 28 del RGPD. Sin
 * él, Hatril trata datos de categoría especial por cuenta de un tercero sin nada
 * que lo ampare, y eso no lo puede defender ni la iglesia ni nosotros. Estaba
 * pendiente desde el principio y esta página es donde deja de estarlo.
 *
 * Se acepta al registrar la iglesia. Va aquí y no en un PDF que haya que firmar
 * a mano porque un contrato que exige imprimir y escanear no lo firma nadie, y
 * un encargo sin firmar es exactamente el mismo problema que no tenerlo.
 *
 * QUÉ NO SE PROMETE
 * -----------------
 * Ni disponibilidad garantizada, ni copias de seguridad con plazo de
 * restauración, ni soporte con tiempos. Prometer un 99,9% por escrito cuando
 * esto corre en un VPS sin redundancia es crear una obligación que no se puede
 * cumplir. Lo que sí se promete, se cumple.
 */
export default function TerminosPage() {
  const r = DATOS_RESPONSABLE;
  const activos = ENCARGADOS.filter((e) => e.activo);

  return (
    <>
      <Titulo>Términos</Titulo>
      <Entradilla>
        Las condiciones de uso de Hatril y, al final, el contrato que nos permite
        tratar los datos de tu congregación. Se aceptan al registrar la iglesia.
      </Entradilla>

      {faltanDatosLegales() && (
        <AvisoBorrador>
          <strong className="font-bold">Este texto está sin terminar.</strong>{' '}
          El anexo del apartado 7 nombra a los subencargados y uno está sin
          identificar. No debe aceptarse ningún registro contra esta versión
          hasta rellenarlo en{' '}
          <code className="rounded bg-surface-alt px-1 py-px text-[13px]">
            src/lib/legal/datos-responsable.ts
          </code>
          .
        </AvisoBorrador>
      )}

      <Seccion numero={1} titulo="Con quién contratas">
        <Recuadro>
          <Dato etiqueta="Titular">{r.razonSocial}</Dato>
          <Dato etiqueta="NIF">{r.nif}</Dato>
          <Dato etiqueta="Domicilio">{r.domicilio}</Dato>
          <Dato etiqueta="Contacto">
            <a href={`mailto:${r.email}`}>{r.email}</a>
          </Dato>
        </Recuadro>
        <P>
          Hatril es un servicio en internet para que una iglesia lleve su
          fichero de miembros, organice sus ministerios y publique una página
          propia.
        </P>
      </Seccion>

      <Seccion numero={2} titulo="Quién puede contratarlo">
        <P>
          Una iglesia o congregación, a través de una persona mayor de edad con
          capacidad para obligarla. Quien registra la iglesia declara que puede
          hacerlo en su nombre.
        </P>
        <P>
          Un menor de 14 años no puede tener cuenta propia. Su iglesia sí puede
          tener su ficha si cuenta con el permiso de quien ejerza su patria
          potestad o tutela; conseguirlo y poder acreditarlo es cosa de la
          iglesia.
        </P>
      </Seccion>

      <Seccion numero={3} titulo="Qué pone cada uno">
        <P>Nosotros mantenemos el servicio en marcha y lo corregimos cuando falla.</P>
        <P>La iglesia se ocupa de:</P>
        <Lista>
          <li>
            Que los datos que mete sean ciertos y que tenga permiso para
            meterlos.
          </li>
          <li>
            Quién entra en su panel y con qué permisos. Las cuentas y los
            permisos los reparte ella desde{' '}
            <span className="font-semibold">Equipo</span>, y responde de lo que
            hagan.
          </li>
          <li>Guardar sus contraseñas y no compartirlas.</li>
          <li>
            Lo que publique en su página. El contenido es suyo y responde de él.
          </li>
        </Lista>
        <P>
          No se puede usar Hatril para mandar publicidad no pedida, ni para
          guardar datos de personas que no tengan relación con la congregación,
          ni para nada ilegal.
        </P>
      </Seccion>

      <Seccion numero={4} titulo="Precio y prueba">
        <P>
          Cada iglesia empieza con un periodo de prueba gratuito. Al terminar hay
          que contratar un plan para seguir usándolo.
        </P>
        <P>
          Los precios vigentes se muestran antes de pagar. Si cambian, avisamos
          con treinta días y el cambio se aplica en la siguiente renovación,
          nunca en la que ya está pagada.
        </P>
        <P>
          La suscripción se renueva sola hasta que se cancele. Se puede cancelar
          cuando se quiera y sigue funcionando hasta el final del periodo pagado.
          No devolvemos la parte no consumida salvo que el servicio haya fallado
          por nuestra culpa.
        </P>
        <P>
          <strong className="font-semibold">
            Cancelar y descargarse los datos nunca se bloquea por impago.
          </strong>{' '}
          Aunque haya un recibo devuelto, una iglesia siempre puede llevarse su
          fichero y darse de baja.
        </P>
      </Seccion>

      <Seccion numero={5} titulo="De quién son los datos y el contenido">
        <P>
          De la iglesia. Nosotros no adquirimos ningún derecho sobre ellos más
          allá de lo estrictamente necesario para prestar el servicio, y no los
          usamos para nada más.
        </P>
        <P>
          El código, el diseño y la marca Hatril son nuestros. Usar el servicio
          no da derecho sobre ellos.
        </P>
        <P>
          Al cerrar la cuenta, la iglesia puede pedir una copia de sus datos
          durante los 60 días siguientes. Pasado ese plazo se eliminan.
        </P>
      </Seccion>

      <Seccion numero={6} titulo="Qué no prometemos">
        <P>
          El servicio se presta tal como está. Ponemos empeño en que funcione,
          pero no garantizamos por escrito un porcentaje de disponibilidad ni un
          tiempo de respuesta: prometer una cifra que no podemos sostener sería
          engañar.
        </P>
        <P>
          No respondemos del lucro cesante ni de daños indirectos. Nuestra
          responsabilidad se limita a lo que la iglesia nos haya pagado en los
          doce meses anteriores.
        </P>
        <P>
          Nada de esto limita lo que la ley no permite limitar: ni el dolo, ni la
          negligencia grave, ni los derechos que el RGPD reconoce a las personas.
        </P>
        <P>
          Podemos suspender una cuenta que incumpla estos términos o que ponga en
          riesgo el servicio. Avisaremos antes salvo que la urgencia no lo
          permita, y siempre dejando descargar los datos.
        </P>
      </Seccion>

      <Seccion
        numero={7}
        titulo="Anexo: encargo de tratamiento (art. 28 RGPD)"
      >
        <P>
          Este anexo forma parte de los términos y se acepta al registrar la
          iglesia. Es el contrato que exige el artículo 28.3 del RGPD.
        </P>

        <P>
          <strong className="font-semibold">Quién es quién.</strong> La iglesia
          es la responsable del tratamiento. {r.razonSocial} es el encargado.
        </P>

        <P>
          <strong className="font-semibold">Objeto y duración.</strong> Tratar
          los datos de la congregación con el único fin de prestar el servicio,
          mientras dure la suscripción y durante los 60 días posteriores a su
          fin.
        </P>

        <P>
          <strong className="font-semibold">Qué datos y de quién.</strong> Datos
          identificativos y de contacto, y datos de categoría especial del
          artículo 9 —la pertenencia religiosa—, de los miembros, colaboradores
          y solicitantes de la iglesia.
        </P>

        <P>
          <strong className="font-semibold">Nuestras obligaciones.</strong>
        </P>
        <Lista>
          <li>
            Tratar los datos solo siguiendo las instrucciones de la iglesia, que
            son las que ella ejecuta al usar el servicio.
          </li>
          <li>
            Guardar secreto, también después de terminar, y exigir lo mismo a
            quien trabaje con nosotros.
          </li>
          <li>
            Aplicar las medidas del artículo 32. En concreto: cifrado en
            tránsito, control de acceso por persona, aislamiento entre
            congregaciones impuesto por la propia base de datos, y registro de
            quién consulta los datos protegidos.
          </li>
          <li>
            Avisar a la iglesia{' '}
            <strong className="font-semibold">sin dilación indebida</strong> si
            hay una brecha, con lo que sepamos, para que ella pueda cumplir sus
            plazos.
          </li>
          <li>
            Ayudarla a atender los derechos de sus miembros y a hacer su
            evaluación de impacto si la necesita.
          </li>
          <li>
            Al terminar, devolver o borrar los datos según nos indique, y borrar
            las copias salvo que la ley obligue a conservarlas.
          </li>
          <li>
            Poner a su disposición lo necesario para demostrar que cumplimos, y
            permitir auditorías razonables previo aviso.
          </li>
        </Lista>

        <P>
          <strong className="font-semibold">Subencargados.</strong> La iglesia
          autoriza de forma general a los siguientes, y avisaremos antes de
          añadir o cambiar alguno para que pueda oponerse:
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
          La lista completa, incluidos los que todavía no están en uso, está en{' '}
          <Link href="/privacidad#s5">el apartado 5 de la privacidad</Link>.
        </P>

        <P>
          <strong className="font-semibold">Transferencias.</strong> Los datos se
          guardan en la Unión Europea. Si algún subencargado tratara datos fuera,
          será con garantías del capítulo V del RGPD, y queda dicho en la lista
          de arriba.
        </P>
      </Seccion>

      <Seccion numero={8} titulo="Ley aplicable">
        <P>
          Se aplica la ley española. Para cualquier discusión, los juzgados de
          Santa Cruz de Tenerife, salvo que la ley imponga otro fuero —que es lo
          normal cuando la otra parte es consumidora.
        </P>
        <P>
          A las iglesias de Colombia se les aplica además la Ley 1581 de 2012 en
          lo que les corresponda.
        </P>
      </Seccion>

      <footer className="mt-12 flex flex-col gap-1 border-t border-border pt-6 text-[13.5px] text-muted-foreground">
        <span>Última actualización: {r.ultimaActualizacion}.</span>
        <span>
          Ver también <Link href="/privacidad">la política de privacidad</Link>.
        </span>
      </footer>
    </>
  );
}
