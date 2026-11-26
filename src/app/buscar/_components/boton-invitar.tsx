'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { compartir } from '@/lib/compartir';

/**
 * «Invita a tu iglesia»: compartir un enlace a Hatril.
 *
 * Con la hoja de compartir del sistema —en el móvil es donde está el WhatsApp
 * de la persona—, y si no la hay, se copia el enlace. Hatril no manda nada a
 * nadie: quien invita elige a quién y por dónde. El cómo, en `lib/compartir.ts`,
 * que es también por qué en la app no hacía nada hasta el 26-nov.
 *
 * Es el naranja de su pantalla: en un buscador vacío es lo único útil que
 * queda por hacer.
 */
const TEXTO =
  'Me gustaría que nuestra iglesia estuviera en Hatril, la app para el muro, la agenda y los turnos de la congregación. Échale un vistazo:';

export function BotonInvitar({ variante = 'default' }: { variante?: 'default' | 'outline' }) {
  const [copiado, setCopiado] = useState(false);

  async function invitar() {
    const resultado = await compartir({ titulo: 'Hatril', texto: TEXTO, ruta: '/' });
    setCopiado(resultado === 'copiado');
  }

  return (
    <Button type="button" size="lg" variant={variante} className="w-full" onClick={invitar}>
      {copiado ? <Check strokeWidth={1.8} /> : <Share2 strokeWidth={1.8} />}
      {copiado ? 'Enlace copiado' : 'Invita a tu iglesia'}
    </Button>
  );
}
