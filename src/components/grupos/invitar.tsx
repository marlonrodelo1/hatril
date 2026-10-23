import { MessageCircle } from 'lucide-react';

import { enlaceWhatsapp, urlSolicitar, type IglesiaEnlazable } from '@/lib/url/absoluta';
import { buttonVariants } from '@/components/ui/button';
import { Copiar } from '@/app/panel/compartir/_components/copiar';

/**
 * El enlace de invitación de un grupo: `/solicitar` de la iglesia con el grupo
 * marcado.
 *
 * Es el puente que pidió Marlon. Quien va a una célula no entra en la célula:
 * entra en la iglesia, con su cuenta y su consentimiento, y al aprobarle queda
 * en esa célula y con la app —el muro, el devocional, la agenda—. Por eso el
 * enlace es el de pedir unirse a la iglesia y no uno propio del grupo.
 *
 * El mensaje de WhatsApp no lleva zona, día ni nombres: lo reenvía quien lo
 * recibe, y lo que se cuenta por ahí no se puede borrar.
 */
export function urlDeInvitacion(
  iglesia: IglesiaEnlazable,
  origen: string,
  codigo: string,
): string {
  return `${urlSolicitar(iglesia, origen)}?grupo=${codigo}`;
}

export function Invitar({
  url,
  grupo,
  iglesia,
  children,
}: {
  url: string;
  grupo: string;
  iglesia: string;
  /** Lo de más de cada pantalla: en el panel, cambiar el enlace. */
  children?: React.ReactNode;
}) {
  return (
    <section
      id="invitar"
      className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">Invitar</h2>
        <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">
          Con este enlace, quien invites pide unirse a {iglesia}. Cuando se le
          aprueba, entra directamente aquí y se queda con la app de la iglesia.
        </p>
      </div>
      <Copiar url={url} etiqueta={`Enlace de invitación de ${grupo}`} />
      <div className="flex flex-wrap gap-2">
        <a
          href={enlaceWhatsapp(`Te invito a «${grupo}», de ${iglesia}. Desde aquí pides unirte:`, url)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          <MessageCircle strokeWidth={1.8} />
          Enviar por WhatsApp
        </a>
        {children}
      </div>
    </section>
  );
}
