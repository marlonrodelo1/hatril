import Link from 'next/link';

import type { Apunte } from '@/lib/admin/registro';
import { ZONA_ADMIN } from './piezas';

/**
 * Una lista de apuntes del registro. La usan la pantalla Registro y el
 * historial de cada ficha.
 *
 * Cada fila es una frase —«Suspendió Iglesia Sion»— y no una tabla de columnas
 * (acción, objeto, actor): el registro se lee para contestar una pregunta
 * concreta, y una frase la contesta sin tener que cruzar columnas.
 */
export function ListaRegistro({
  apuntes,
  vacio,
}: {
  apuntes: Apunte[];
  /** Qué decir cuando no hay nada, que depende de dónde se pinte. */
  vacio: string;
}) {
  if (apuntes.length === 0) {
    return <p className="text-label text-muted-foreground">{vacio}</p>;
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {apuntes.map((a) => (
        <li
          key={a.id}
          className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
        >
          <span className="text-body">
            <Frase apunte={a} />
          </span>
          <span className="text-label text-muted-foreground">
            {[a.actor, cuando(a.createdAt), a.ip ? `IP ${a.ip}` : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Frase({ apunte: a }: { apunte: Apunte }) {
  const iglesia = a.iglesia ? (
    <Link href={`/admin/iglesias/${a.iglesia.id}`} className="font-semibold text-foreground">
      {a.iglesia.nombre}
    </Link>
  ) : null;

  switch (a.accion) {
    case 'ampliar_prueba': {
      const hasta = dia(a.detalle.despuesDia);
      const antes = dia(a.detalle.antesDia);
      return (
        <>
          Amplió la prueba de {iglesia}
          {hasta && <> hasta el {hasta}</>}
          {antes && <span className="text-muted-foreground"> (acababa el {antes})</span>}
        </>
      );
    }
    case 'suspender_iglesia':
      return <>Suspendió {iglesia}</>;
    case 'reactivar_iglesia':
      return <>Reactivó {iglesia}</>;
    case 'sacar_del_directorio':
      return <>Sacó {iglesia} del directorio</>;
    case 'poner_contrasena':
      return (
        <>
          Puso una contraseña provisional a{' '}
          {a.cuenta ? (
            <Link href={`/admin/cuentas/${a.cuenta.id}`} className="font-semibold text-foreground">
              {a.cuenta.email}
            </Link>
          ) : (
            'una cuenta'
          )}
        </>
      );
  }
}

/** «30 nov 2026» desde el `YYYY-MM-DD` guardado, sin pasar por ninguna zona. */
function dia(valor: unknown): string | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  return new Date(`${valor}T12:00:00Z`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function cuando(d: Date): string {
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA_ADMIN,
  });
}
