'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

/**
 * Compartir el devocional.
 *
 * QUÉ SE COMPARTE, Y QUÉ NO
 * -------------------------
 * El versículo, su referencia y el nombre de la iglesia. **No el enlace.**
 *
 * Parece lo natural mandar la dirección de la pantalla, y es justo lo que no se
 * puede hacer: `/mi/devocional` está detrás de sesión y de membresía activa. A
 * quien reciba ese enlace y no sea de la congregación, `requireIglesia()` lo
 * echa — así que compartir sería mandar a la gente a una pantalla de acceso sin
 * explicación. Y el muro de la comunidad tiene la misma promesa: lo que se
 * publica dentro no sale a la calle.
 *
 * Así que se comparte el TEXTO. Que es además lo que la gente reenvía de verdad
 * por WhatsApp un domingo: el versículo, no una dirección.
 *
 * DOS BOTONES Y NINGUNO OBLIGATORIO
 * ---------------------------------
 * `navigator.share` abre el menú del sistema —WhatsApp, notas, correo— y es lo
 * que espera cualquiera en un móvil. En escritorio no existe en casi ningún
 * navegador, así que copiar al portapapeles es el respaldo, y se enseña siempre:
 * un botón que a veces está y a veces no es peor que dos que están siempre.
 */
export function Compartir({
  titulo,
  versiculo,
  referencia,
  iglesia,
}: {
  titulo: string;
  versiculo: string | null;
  referencia: string | null;
  iglesia: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const texto = [
    titulo,
    versiculo ? `«${versiculo}»` : null,
    referencia,
    `— Devocional de ${iglesia}`,
  ]
    .filter(Boolean)
    .join('\n');

  async function compartir() {
    /*
     * `navigator.share` puede no existir, y también puede fallar porque la
     * persona cierre el menú del sistema. Lo segundo NO es un error que haya que
     * enseñar: cancelar es una respuesta válida.
     */
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        return;
      }
    }
    await copiar();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      // Vuelve solo a los dos segundos: un «copiado» que se queda para siempre
      // deja de significar que acaba de pasar algo.
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer desde aquí, y un
      // error rojo por no poder copiar un versículo es desproporcionado.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={compartir}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] font-semibold outline-none hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        <Share2 className="size-4" strokeWidth={1.8} />
        Compartir
      </button>

      <button
        type="button"
        onClick={copiar}
        aria-live="polite"
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] font-semibold text-muted-foreground outline-none hover:bg-surface-alt hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        {copiado ? (
          <>
            <Check className="size-4 text-badge-success-fg" strokeWidth={2} />
            Copiado
          </>
        ) : (
          <>
            <Copy className="size-4" strokeWidth={1.8} />
            Copiar
          </>
        )}
      </button>
    </div>
  );
}
