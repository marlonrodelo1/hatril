import { AlertCircle } from 'lucide-react';

/**
 * Los ladrillos de las páginas legales.
 *
 * Existen para que privacidad y términos se vean iguales sin repetir cadenas de
 * clases en cada párrafo. No son componentes de `ui/`: solo los usan estas dos
 * páginas, y ponerlos en el sistema de diseño invitaría a usarlos en el panel,
 * donde la tipografía es otra.
 *
 * Prosa un punto más grande que en el panel (16px frente a 15) y con más
 * interlineado. Son textos largos que alguien lee de verdad, no filas de tabla
 * que se escanean.
 */

export function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mb-2 text-[34px] font-extrabold leading-[1.15] tracking-[-0.03em]">
      {children}
    </h1>
  );
}

export function Entradilla({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-10 text-pretty text-[17px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

export function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  // El `id` sale del número y no del título: los títulos se retocan y un ancla
  // que cambia rompe los enlaces que alguien haya guardado o citado en un
  // correo.
  return (
    <section id={`s${numero}`} className="mb-9 scroll-mt-20">
      <h2 className="mb-3 text-[20px] font-bold tracking-[-0.02em]">
        <span className="mr-2 text-muted-foreground">{numero}.</span>
        {titulo}
      </h2>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-pretty text-[16px] leading-[1.7]">{children}</p>
  );
}

export function Lista({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-[16px] leading-[1.7] marker:text-muted-foreground">
      {children}
    </ul>
  );
}

/** Un dato con su etiqueta. Para el bloque de identificación del responsable. */
export function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-[150px] flex-none text-[14px] font-semibold text-muted-foreground">
        {etiqueta}
      </span>
      <span className="text-[16px] leading-[1.6]">{children}</span>
    </div>
  );
}

export function Recuadro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-5">
      {children}
    </div>
  );
}

/**
 * Aviso de que la página está incompleta.
 *
 * Lleva icono además del color, que es la regla 2 del sistema de diseño. Y es
 * deliberadamente feo: está para molestar hasta que alguien rellene el dato, no
 * para convivir con él.
 */
export function AvisoBorrador({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-10 flex items-start gap-2.5 rounded-xl border border-[#E0C4C2] bg-[#F7ECEB] px-4 py-3.5 text-[14.5px] leading-relaxed text-danger"
    >
      <AlertCircle className="mt-0.5 size-[18px] flex-none" strokeWidth={1.9} />
      <span className="text-pretty">{children}</span>
    </div>
  );
}
