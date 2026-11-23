import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';

import { eventoPublico } from '@/lib/eventos/publica';
import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { DatosEvento } from '../../../_components/eventos-piezas';

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
 *
 * Y por eso tampoco promete un correo, aunque el diseño de la zona 3 lo
 * dijera («te hemos mandado un correo…»): hoy no se manda ninguno. Del diseño
 * se queda la forma —la marca que salta y los datos del evento con las mismas
 * piezas que su página—, no esa frase.
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
      <div className="flex w-full max-w-[520px] flex-col items-center gap-5 rounded-xl border border-border bg-surface p-6 text-center sm:p-8">
        {/* Salta una vez al llegar (`anim-salta`, de la base común) y luego
            se queda quieta. Con «reducir movimiento», ni eso. */}
        <span className="anim-salta flex size-16 items-center justify-center rounded-full bg-badge-success-bg text-badge-success-fg">
          <Check className="size-[30px]" strokeWidth={1.8} aria-hidden />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="t-titulo text-balance">Listo, te esperamos</h1>
          <p className="text-pretty text-body leading-relaxed text-muted-foreground">
            {iglesia.nombre} tiene tu inscripción para{' '}
            <b className="font-semibold text-foreground">{e.titulo}</b>.
          </p>
        </div>

        <div className="w-full">
          <DatosEvento evento={e} timezone={iglesia.timezone} dentro />
        </div>

        {(e.enlacePago || e.pagoInstrucciones) && (
          <p className="text-pretty text-body leading-relaxed text-muted-foreground">
            Este evento tiene un precio. Vuelve a la página del evento para ver
            cómo pagarlo: la iglesia apunta a mano quién ha pagado.
          </p>
        )}

        <p className="text-pretty text-label leading-relaxed text-muted-foreground">
          Si no puedes venir o quieres que borren tus datos, escribe a la
          iglesia y lo hacen.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <BotonEnlace href={`/i/${slug}/eventos/${id}`} variant="outline">
            Volver al evento
          </BotonEnlace>
          <BotonEnlace href={`/i/${slug}`} variant="ghost">
            Ver la iglesia
          </BotonEnlace>
        </div>
      </div>
    </div>
  );
}
