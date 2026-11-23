import Link from 'next/link';
import { CalendarDays, HouseHeart, MapPin, TriangleAlert, User } from 'lucide-react';

import type { VistaDeMiGrupo } from '@/lib/grupos/vista';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { buttonVariants } from '@/components/ui/button';

/**
 * La tarjeta de la célula de alguien, en `/mi/cuenta`.
 *
 * Es la vista del participante del contrato (`vistaDeMisGrupos`), puesta donde
 * la ve quien no está en el equipo de la red, que es casi todo el que va a una
 * célula: no tiene pestaña «Equipo», y su sitio es su cuenta, junto a «Tus
 * ministerios».
 *
 * Quién la lleva, cuándo, dónde por encima y el próximo tema. Nada de los
 * demás: lo esconde la base (`0047`), y esta tarjeta no tendría de dónde
 * sacarlo. A quien la lleva, además, la entrada a su pantalla.
 */
export function TarjetaMiGrupo({
  grupo: g,
  hoy,
  salir,
}: {
  grupo: VistaDeMiGrupo;
  hoy: string;
  /** «Salir de esta célula», que pone Mi cuenta con su action. */
  salir?: React.ReactNode;
}) {
  const lider = g.lideres.find((l) => l.rol === 'lider');

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <HouseHeart className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body font-bold">{g.nombre}</span>
          {/* Solo la red: «Célula de Células» se lee mal, y el ministerio ya
              dice de qué es. */}
          <span className="truncate text-label text-muted-foreground">{g.ministerioNombre}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-label">
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
          <span>
            {g.cuando}
            <span className="text-muted-foreground">
              {' · '}la próxima, {diaCorto(g.proxima.fecha, hoy).toLocaleLowerCase('es')}
            </span>
          </span>
        </li>
        {g.zona && (
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
            <span>{g.zona}</span>
          </li>
        )}
        {lider && (
          <li className="flex items-start gap-2">
            <User className="mt-0.5 size-4 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
            <span>
              {lider.nombre}
              <span className="text-muted-foreground"> · líder</span>
            </span>
          </li>
        )}
      </ul>

      <div className="flex flex-col gap-1 rounded-lg bg-surface-alt p-3">
        <span className="t-micro">Próximo tema</span>
        <p className="text-pretty text-body">
          {g.proxima.tema ?? <span className="text-muted-foreground">Sin tema todavía</span>}
        </p>
      </div>

      {g.llevo && (
        <>
          {g.reunion.estado === 'sin_reportar' && (
            <p className="flex items-center gap-2 text-label font-semibold text-badge-warning-fg">
              <TriangleAlert className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
              La reunión del {diaCorto(g.reunion.fecha, hoy).toLocaleLowerCase('es')} está sin reportar
            </p>
          )}
          <Link
            href={rutaApp(g.ministerioId, 'grupos', g.grupoId)}
            className={buttonVariants({ variant: 'outline', className: 'self-start' })}
          >
            <HouseHeart strokeWidth={1.8} />
            Abrir tu {g.etiquetas.uno}
          </Link>
        </>
      )}

      {salir}
    </li>
  );
}
