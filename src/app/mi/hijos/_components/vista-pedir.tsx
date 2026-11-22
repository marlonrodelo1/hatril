import type { ReactNode } from 'react';

import type { MinisterioConTablon } from '@/lib/ninos/familia';
import {
  TEXTO_NINOS_CASILLA_IMAGEN,
  TEXTO_NINOS_CASILLA_VINCULO,
  TEXTO_NINOS_INFORMACION,
  TEXTO_NINOS_NO_OBLIGADO,
} from '@/lib/rgpd/consentimiento';
import { Aviso } from '@/components/aviso';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pedirVinculo } from '../actions';

const CLASE_SELECT =
  'h-[42px] w-full rounded-lg border border-input bg-surface-alt px-3 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';

/**
 * «Tengo un hijo en Niños»: lo mínimo del niño, la información de lo que pasa
 * con esos datos, y las dos casillas sin marcar.
 *
 * Los textos son los de `consentimiento.ts`, palabra por palabra: se guarda su
 * versión con la petición, y si la pantalla dijera otra cosa, el registro
 * mentiría. La información va ENTERA a la vista, encima de las casillas, y no
 * detrás de un «más información»: es la primera capa del art. 13 y es corta.
 *
 * Inputs a 16 px: por debajo, Safari amplía la página al tocar el campo.
 */
export function VistaPedirHijo({
  cabecera,
  iglesia,
  ministerios,
  error,
}: {
  cabecera: ReactNode;
  iglesia: string;
  ministerios: MinisterioConTablon[];
  error?: string;
}) {
  const anio = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}

        <form action={pedirVinculo} className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            {ministerios.length === 1 ? (
              <input type="hidden" name="ministerio" value={ministerios[0]!.id} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ministerio">Ministerio</Label>
                <select id="ministerio" name="ministerio" required className={CLASE_SELECT}>
                  {ministerios.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Cómo le llamáis</Label>
              <Input id="nombre" name="nombre" required maxLength={60} autoComplete="off" className="text-[16px]" />
              <p className="t-label text-muted-foreground">Basta con el nombre. Sin apellidos.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="anio">Año en que nació</Label>
              <Input
                id="anio"
                name="anio"
                type="number"
                inputMode="numeric"
                required
                min={anio - 13}
                max={anio}
                placeholder={String(anio - 6)}
                className="text-[16px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parentesco">Eres su</Label>
              <select id="parentesco" name="parentesco" required defaultValue="" className={CLASE_SELECT}>
                <option value="" disabled>
                  Elige…
                </option>
                <option value="madre">Madre</option>
                <option value="padre">Padre</option>
                <option value="tutor_legal">Tutor legal</option>
              </select>
            </div>
          </section>

          <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-[15px] font-bold">Qué pasa con estos datos</h2>
            {TEXTO_NINOS_INFORMACION(iglesia).map((p) => (
              <p key={p} className="text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>

          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="vinculo" required className="mt-1" />
              <span className="text-pretty text-[14px] leading-snug">{TEXTO_NINOS_CASILLA_VINCULO(iglesia)}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="imagen" className="mt-1" />
              <span className="text-pretty text-[14px] leading-snug">{TEXTO_NINOS_CASILLA_IMAGEN}</span>
            </label>
            <p className="text-[13.5px] text-muted-foreground">{TEXTO_NINOS_NO_OBLIGADO}</p>
          </section>

          <BotonEnviar pendiente="Enviando…" className="self-start">
            Pedirlo
          </BotonEnviar>
        </form>
      </main>
    </div>
  );
}
