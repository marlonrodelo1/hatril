import type { ReactNode } from 'react';
import Link from 'next/link';
import { Camera, CameraOff, ChevronRight, Clock, Newspaper, Plus } from 'lucide-react';

import type { DatosDeMisHijos } from '@/lib/ninos/familia';
import { TEXTO_NINOS_CASILLA_IMAGEN } from '@/lib/rgpd/consentimiento';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { desvincularme, darPermisoFotos, quitarPermisoFotos, retirarSolicitud } from '../actions';

/**
 * «Mis hijos»: los hijos vinculados al ministerio de Niños, sus permisos, lo
 * que espera a la responsable, y la entrada al tablón.
 *
 * Solo en la app (`movil/`): lo de los padres no va en la web `/mi`
 * (`plan-ninos.md` §6). Vive aquí, con las vistas de la web, porque la app
 * las comparte (`movil/src/pantallas/mi/hijos.tsx`).
 *
 * Un solo botón naranja: «Tengo un hijo en Niños». Dar y quitar el permiso de
 * fotos van en contorno, y el texto de lo que se autoriza va al lado del
 * botón: un permiso que se da sin leerlo no es un permiso (RGPD art. 7.2).
 */

const CONFIRMACIONES: Record<string, string> = {
  pedido: 'Listo. La responsable del ministerio tiene que aceptarlo, y antes querrá saludarte en persona. Hasta entonces no verás nada.',
  retirada: 'Petición retirada. No queda nada de ella.',
  'fotos-si': 'Hecho. Desde ahora puede salir en las fotos y vídeos del ministerio.',
  'fotos-no': 'Hecho. Desde ahora no saldrá en fotos nuevas. Hemos avisado a la responsable para que quite las que ya estén publicadas.',
  desvinculado: 'Ya no ves lo de Niños de este hijo. Si nadie más de tu familia estaba vinculado, se han borrado su nombre y su año.',
};

const PARENTESCOS: Record<string, string> = {
  madre: 'Eres su madre',
  padre: 'Eres su padre',
  tutor_legal: 'Eres su tutor legal',
};

export function VistaHijos({
  cabecera,
  datos,
  error,
  guardado,
}: {
  cabecera: ReactNode;
  datos: DatosDeMisHijos;
  error?: string;
  guardado?: string;
}) {
  const { ministerios, hijos, solicitudes, tieneFicha } = datos;
  const puedePedir = tieneFicha && ministerios.length > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {ministerios.length === 0 ? (
          <Aviso tipo="info">Tu iglesia no usa todavía el tablón de familias del ministerio de Niños.</Aviso>
        ) : !tieneFicha ? (
          <Aviso tipo="info">
            Tu cuenta todavía no tiene ficha en la iglesia. Pídele a tu iglesia que te dé de alta en su
            fichero, y después podrás pedirlo aquí.
          </Aviso>
        ) : null}

        {hijos.length > 0 && (
          <Link
            href="/mi/hijos/tablon"
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline"
          >
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Newspaper className="size-5" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-bold">El tablón</span>
              <span className="text-[13px] text-muted-foreground">Lo que hacen en el ministerio, con sus fotos</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
          </Link>
        )}

        {hijos.map((h) => (
          <section key={h.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[17px] font-bold tracking-[-0.02em]">{h.nombre}</h2>
              <span className="text-[13.5px] text-muted-foreground">
                {h.ministerio.nombre} · nació en {h.anioNacimiento} · {PARENTESCOS[h.parentesco] ?? ''}
              </span>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                {h.fotos ? (
                  <Camera className="size-4 text-badge-success-fg" strokeWidth={1.9} aria-hidden />
                ) : (
                  <CameraOff className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
                )}
                {h.fotos ? 'Puede salir en fotos y vídeos' : 'No sale en fotos ni vídeos'}
              </span>
              {h.fotos ? (
                <form action={quitarPermisoFotos.bind(null, h.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Quitar el permiso de fotos
                  </Button>
                </form>
              ) : (
                <form action={darPermisoFotos.bind(null, h.id)} className="flex flex-col gap-2">
                  <p className="text-pretty text-[13px] leading-snug text-muted-foreground">
                    {TEXTO_NINOS_CASILLA_IMAGEN}
                  </p>
                  <Button type="submit" variant="outline" size="sm" className="self-start">
                    Dar el permiso de fotos
                  </Button>
                </form>
              )}
            </div>

            <form action={desvincularme.bind(null, h.id)} className="flex flex-col gap-1.5 border-t border-border pt-3">
              <p className="text-pretty text-[13px] leading-snug text-muted-foreground">
                Dejarás de ver el tablón de este hijo. Si nadie más de su familia está vinculado, se borran su
                nombre y su año.
              </p>
              <Button type="submit" variant="ghost" size="sm" className="self-start text-muted-foreground">
                Dejar de ver lo de Niños
              </Button>
            </form>
          </section>
        ))}

        {solicitudes.map((s) => (
          <section key={s.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <span className="flex items-center gap-2 text-[15px] font-bold">
              <Clock className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
              {s.nombre}
            </span>
            <span className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
              Esperando a que la responsable de {s.ministerio.nombre} lo acepte. Antes querrá saludarte en
              persona.
            </span>
            <form action={retirarSolicitud.bind(null, s.id)}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                Retirar la petición
              </Button>
            </form>
          </section>
        ))}

        {puedePedir && (
          <Link
            href="/mi/hijos/pedir"
            className={buttonVariants({ className: 'self-start no-underline hover:no-underline' })}
          >
            <Plus strokeWidth={1.9} aria-hidden />
            Tengo un hijo en Niños
          </Link>
        )}

        {puedePedir && hijos.length === 0 && solicitudes.length === 0 && (
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Si tu hijo o hija va al ministerio de Niños, pídelo aquí. Cuando la responsable lo acepte, verás lo
            que hacen cada día, con sus fotos.
          </p>
        )}
      </main>
    </div>
  );
}
