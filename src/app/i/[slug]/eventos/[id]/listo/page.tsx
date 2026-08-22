import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarDays, Check, MapPin } from 'lucide-react';

import { eventoPublico } from '@/lib/eventos/publica';
import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { formatearInstante } from '@/lib/fecha/zona';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Te has apuntado',
  // Es una pantalla de confirmación de una persona concreta. Que no la indexe
  // nadie, aunque no lleve datos: la dirección sí identifica el evento.
  robots: { index: false, follow: false },
};

/**
 * «Ya está».
 *
 * LO QUE ESTA PANTALLA NO DICE, Y ES SU DISEÑO ENTERO
 * ---------------------------------------------------
 * No dice si la inscripción era nueva o si ese correo ya estaba apuntado. Dice
 * exactamente lo mismo en los dos casos. Si dijera «ya estabas inscrito»,
 * cualquiera podría probar una lista de correos y averiguar quién asiste a un
 * acto de una congregación: confesión religiosa por inferencia, art. 9 del RGPD.
 *
 * Tampoco enseña el código de cancelación. Ese código es el secreto que
 * sustituye a la cuenta, y enseñarlo aquí sería el mismo oráculo con otro
 * nombre: solo aparecería en el alta de verdad. Viaja por correo o no viaja, y
 * mientras Resend no esté montado, la baja la da la iglesia.
 */
export default async function InscripcionListaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const e = await eventoPublico(slug, id);
  if (!e) notFound();

  const iglesia = await obtenerIglesiaPublica(slug);
  if (!iglesia) notFound();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16">
      <div className="flex w-full max-w-[520px] flex-col items-start gap-5 rounded-xl border border-border bg-surface p-7">
        <span className="flex size-11 items-center justify-center rounded-full bg-badge-success-bg text-badge-success-fg">
          <Check className="size-[22px]" strokeWidth={2.2} />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.025em]">
            Listo, te esperamos
          </h1>
          <p className="text-[15.5px] leading-relaxed text-muted-foreground">
            {iglesia.nombre} tiene tu inscripción para <b>{e.titulo}</b>.
          </p>
        </div>

        <div className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-surface-alt p-4 text-[14.5px]">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-[17px] flex-none text-muted-foreground" strokeWidth={1.7} />
            <span className="first-letter:uppercase">
              {formatearInstante(e.inicioEn, iglesia.timezone, { conAnio: true })}
            </span>
          </span>
          {e.lugar && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-[17px] flex-none text-muted-foreground" strokeWidth={1.7} />
              {e.lugar}
            </span>
          )}
        </div>

        {(e.enlacePago || e.pagoInstrucciones) && (
          <p className="text-[14.5px] leading-relaxed text-muted-foreground">
            Este evento tiene un precio. Vuelve a la página del evento para ver
            cómo pagarlo: la iglesia apunta a mano quién ha pagado.
          </p>
        )}

        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Si no puedes venir o quieres que borren tus datos, escribe a la
          iglesia y lo hacen.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href={`/i/${slug}/eventos/${id}`} />}>
            Volver al evento
          </Button>
          <Button variant="ghost" render={<Link href={`/i/${slug}`} />}>
            Ver la iglesia
          </Button>
        </div>
      </div>
    </div>
  );
}
