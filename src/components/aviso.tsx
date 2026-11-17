import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

/**
 * Aviso dentro de la página: el error de un formulario, la confirmación de que
 * algo se ha guardado, una advertencia o un dato que conviene saber.
 *
 * SIEMPRE CON ICONO
 * -----------------
 * Regla 2 del sistema de diseño: el rojo de error (#B53333) y el naranja de
 * marca son vecinos de tono, y un error que se distingue solo por el color no
 * lo ve quien no distingue bien los colores. Cada tipo lleva el suyo.
 *
 * CUATRO TIPOS (17-nov)
 * ---------------------
 * Eran dos, `error` y `ok`. La base común añadió `aviso` (algo que conviene
 * arreglar pero no ha fallado: un ministerio sin responsable) e `info` (un
 * dato neutro: cuándo acaba la prueba), con los tonos de las insignias.
 *
 * `role="alert"` solo en el error: es lo único que tiene que interrumpir a un
 * lector de pantalla. Los demás se leen en su sitio.
 */
const TIPOS = {
  error: {
    Icono: CircleAlert,
    clases: 'border-danger-border bg-danger-soft text-danger',
  },
  ok: {
    Icono: CircleCheck,
    clases: 'border-badge-success-border bg-badge-success-bg text-badge-success-fg',
  },
  aviso: {
    Icono: TriangleAlert,
    clases: 'border-border bg-badge-warning-bg text-badge-warning-fg',
  },
  info: {
    Icono: Info,
    clases: 'border-border bg-surface text-foreground',
  },
} as const;

export function Aviso({
  tipo = 'error',
  children,
}: {
  tipo?: keyof typeof TIPOS;
  children: React.ReactNode;
}) {
  const { Icono, clases } = TIPOS[tipo];

  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] leading-snug ' +
        clases
      }
    >
      <Icono
        className={'mt-px size-4 shrink-0 ' + (tipo === 'info' ? 'text-support' : '')}
        strokeWidth={1.9}
      />
      <span>{children}</span>
    </div>
  );
}
