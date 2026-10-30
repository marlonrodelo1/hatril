'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * «Invita a tu iglesia»: compartir un enlace a Hatril.
 *
 * Con la hoja de compartir del sistema cuando la hay —en el móvil la hay, y es
 * donde está el WhatsApp de la persona—, y si no, se copia el enlace. Hatril no
 * manda nada a nadie: quien invita elige a quién y por dónde.
 *
 * Es el naranja de su pantalla: en un buscador vacío es lo único útil que
 * queda por hacer.
 */
const TEXTO =
  'Me gustaría que nuestra iglesia estuviera en Hatril, la app para el muro, la agenda y los turnos de la congregación. Échale un vistazo:';

export function BotonInvitar({ variante = 'default' }: { variante?: 'default' | 'outline' }) {
  const [copiado, setCopiado] = useState(false);

  async function invitar() {
    const url = `${window.location.origin}/`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hatril', text: TEXTO, url });
        return;
      } catch {
        // Cancelado por la persona: no es un error, no se dice nada.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${TEXTO} ${url}`);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Button type="button" size="lg" variant={variante} className="w-full" onClick={invitar}>
      {copiado ? <Check strokeWidth={1.8} /> : <Share2 strokeWidth={1.8} />}
      {copiado ? 'Enlace copiado' : 'Invita a tu iglesia'}
    </Button>
  );
}
