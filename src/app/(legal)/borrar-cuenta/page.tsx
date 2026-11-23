import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';

import { PLAZO_BAJA_DIAS } from '@/lib/cuenta/baja';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Borrar tu cuenta de Hatril',
  description: 'Cómo borrar tu cuenta de Hatril y qué pasa con tus datos.',
};

/**
 * La página pública para borrar la cuenta.
 *
 * Google la pide en el formulario de seguridad de datos de Play: una dirección
 * web donde se explique cómo pedir el borrado, además del botón dentro de la
 * app. Y es también donde aterriza quien acaba de pedirlo, ya sin sesión
 * (`?pedida=AAAA-MM-DD`).
 */
export default async function BorrarCuentaPublicaPage({
  searchParams,
}: {
  searchParams: Promise<{ pedida?: string }>;
}) {
  const { pedida } = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida ?? '')
    ? new Intl.DateTimeFormat('es', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(pedida + 'T12:00:00Z'))
    : null;

  return (
    <article className="flex flex-col gap-6 text-[16px] leading-relaxed">
      {fecha && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <CheckCircle2 className="mt-0.5 size-6 flex-none text-badge-success-fg" strokeWidth={1.8} />
          <div className="flex flex-col gap-1">
            <p className="font-bold">Tu cuenta está desactivada</p>
            <p className="text-muted-foreground">
              La borraremos el {fecha}. Si cambias de idea, entra antes de esa
              fecha con tu correo y tu contraseña y la recuperas.
            </p>
          </div>
        </div>
      )}

      <h1 className="text-[30px] font-extrabold tracking-[-0.03em]">
        Borrar tu cuenta de Hatril
      </h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">Cómo se hace</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-6">
          <li>Entra en la app o en hatril.com con tu correo y tu contraseña.</li>
          <li>Ve a <strong>Mi cuenta</strong> y, al final, a <strong>Borrar mi cuenta</strong>.</li>
          <li>Escribe tu contraseña para confirmarlo.</li>
        </ol>
        <p className="text-muted-foreground">
          Si no recuerdas la contraseña, puedes{' '}
          <Link href="/recuperar" className="font-semibold text-foreground underline underline-offset-2">
            recuperarla
          </Link>{' '}
          primero.
        </p>
        <Link
          href={'/acceso?next=' + encodeURIComponent('/mi/cuenta/borrar')}
          className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' self-start'}
        >
          Entrar para borrar mi cuenta
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">Qué pasa después</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-6">
          <li>
            <strong>Al momento</strong>, la cuenta se desactiva: se cierra la
            sesión en todos tus dispositivos y dejas de entrar en tu iglesia.
            Tus turnos pendientes quedan sin cubrir y avisamos a quien lleva tus
            equipos.
          </li>
          <li>
            <strong>A los {PLAZO_BAJA_DIAS} días</strong> borramos tu cuenta, tu
            foto, lo que hayas publicado y comentado en la comunidad, tus
            «me gusta», tus bloqueos, tus denuncias y tus avisos.
          </li>
          <li>
            <strong>Hasta entonces</strong> puedes recuperarla entrando con tu
            correo y tu contraseña.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">Lo que no se borra</h2>
        <p>
          Tu ficha en tu iglesia —nombre, datos de contacto, los equipos en los
          que has servido— la lleva la propia iglesia, que es quien decide sobre
          su fichero. Al borrar la cuenta se queda sin cuenta enlazada. Si
          quieres salir también de ese fichero, pídeselo a tu pastor. También se
          conserva el registro de los consentimientos que diste, como explica la{' '}
          <Link href="/privacidad" className="font-semibold underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
