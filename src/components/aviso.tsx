import { AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Aviso de error o de confirmación.
 *
 * El error SIEMPRE lleva icono, no solo color: es una de las tres reglas
 * innegociables del sistema de diseño, y además es lo que hace que el mensaje
 * llegue a quien no distingue el rojo del gris.
 *
 * Con `role="alert"` para que un lector de pantalla lo anuncie al aparecer;
 * sin él, quien navega a ciegas envía el formulario, no pasa nada aparente y no
 * tiene forma de saber por qué.
 */
export function Aviso({
  tipo = 'error',
  children,
}: {
  tipo?: 'error' | 'ok';
  children: React.ReactNode;
}) {
  const esError = tipo === 'error';
  const Icono = esError ? AlertCircle : CheckCircle2;

  return (
    <div
      role="alert"
      className={
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] leading-snug ' +
        (esError
          ? 'border-danger-border bg-danger-soft text-danger'
          : 'border-badge-success-border bg-badge-success-bg text-badge-success-fg')
      }
    >
      <Icono className="mt-px size-4 shrink-0" strokeWidth={1.9} />
      <span>{children}</span>
    </div>
  );
}
