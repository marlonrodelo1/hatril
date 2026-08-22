import Link from 'next/link';
import { Mail, Pencil, Phone, X, Lock } from 'lucide-react';

import { obtenerMiembro } from '@/lib/miembros/consultas';
import { ESTADOS } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { esPastor, puede } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Ficha de una persona, en un panel lateral sobre el listado.
 *
 * POR QUÉ SE ABRE CON UN PARÁMETRO DE URL Y NO CON ESTADO DE REACT
 * ---------------------------------------------------------------
 * `?ficha=<id>`. Así la ficha se puede enviar por WhatsApp a otro líder, el
 * botón atrás la cierra, y todo el contenido se renderiza en el servidor — que
 * es lo que permite lo de abajo.
 *
 * LOS DATOS SENSIBLES NO LLEGAN AL NAVEGADOR
 * ------------------------------------------
 * `obtenerMiembro` no los SELECCIONA si la persona no tiene el permiso. La
 * diferencia con ocultarlos en la plantilla es la que separa un producto que
 * cumple el art. 9 de uno que lo aparenta: traerlos y esconderlos con CSS los
 * deja en el HTML, a la vista de cualquiera que abra el inspector.
 */
export async function FichaMiembroPanel({
  ctx,
  miembroId,
  params,
}: {
  ctx: UserContext;
  miembroId: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const miembro = await obtenerMiembro(ctx, miembroId);

  const cerrar = (() => {
    const limpios = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === 'ficha') continue;
      const valor = Array.isArray(v) ? v[0] : v;
      if (valor) limpios.set(k, valor);
    }
    const cadena = limpios.toString();
    return cadena ? `?${cadena}` : '?';
  })();

  if (!miembro) {
    // Puede pasar de verdad: un enlace viejo a alguien que se dio de baja, o
    // una ficha que está fuera del ámbito de quien mira. Se dice lo mismo en
    // los dos casos — «no existe» y «no puedes verla» no deben distinguirse,
    // porque la diferencia ya revela que esa persona está en la iglesia.
    return (
      <Capa cerrar={cerrar}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[16px] font-semibold">No encontramos esa ficha</p>
          <p className="text-[14px] text-muted-foreground">
            Puede que se haya dado de baja o que no tengas acceso a ella.
          </p>
          <Link href={cerrar} scroll={false} className="text-[14px] font-semibold">
            Volver al listado
          </Link>
        </div>
      </Capa>
    );
  }

  const estilo = ESTADOS[miembro.estado];
  const nombreCompleto = [miembro.nombre, miembro.apellidos]
    .filter(Boolean)
    .join(' ');
  const puedeEditar = esPastor(ctx) || puede(ctx, 'editar_miembros');

  return (
    <Capa cerrar={cerrar}>
      <div className="flex flex-col gap-4.5 border-b border-border px-6 pb-4.5 pt-5">
        <div className="flex items-start gap-4">
          <span
            className={`flex size-16 flex-none items-center justify-center rounded-full text-[20px] font-bold ${estilo.avatar}`}
          >
            {iniciales(nombreCompleto)}
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <h2 className="text-[24px] font-bold leading-tight tracking-[-0.025em]">
              {nombreCompleto}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-[5px] text-[12px] font-semibold ${estilo.badge}`}
              >
                {estilo.etiqueta}
              </span>
              {miembro.numeroMiembro && (
                <span className="text-[13px] text-muted-foreground">
                  Nº {miembro.numeroMiembro}
                </span>
              )}
            </div>
          </div>

          <Link
            href={cerrar}
            scroll={false}
            aria-label="Cerrar la ficha"
            className="flex size-[34px] flex-none items-center justify-center rounded-lg text-muted-foreground no-underline hover:bg-background hover:text-foreground hover:no-underline"
          >
            <X className="size-[18px]" strokeWidth={1.9} />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Los enlaces `tel:` y `mailto:` son el atajo que de verdad usa un
              pastor desde el móvil: abren la llamada o el correo sin copiar
              nada. Solo aparecen si hay dato al que llamar. */}
          {miembro.telefono && (
            <AccionEnlace href={`tel:${miembro.telefono}`} Icono={Phone}>
              Llamar
            </AccionEnlace>
          )}
          {miembro.email && (
            <AccionEnlace href={`mailto:${miembro.email}`} Icono={Mail}>
              Escribir
            </AccionEnlace>
          )}
          {puedeEditar && (
            <AccionEnlace
              href={`/panel/miembros/${miembro.id}/editar`}
              Icono={Pencil}
            >
              Editar
            </AccionEnlace>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-xl border border-border bg-surface-alt">
            <Dato etiqueta="Teléfono" valor={miembro.telefono} />
            <Dato etiqueta="Correo" valor={miembro.email} />
            <Dato
              etiqueta="En la iglesia desde"
              valor={formatearFechaLarga(miembro.fechaIngreso)}
            />
            <Dato
              etiqueta="Bautismo"
              valor={
                miembro.bautizado
                  ? (formatearFechaLarga(miembro.fechaBautismo) ?? 'Sí')
                  : 'Todavía no'
              }
            />

            {miembro.sensibles ? (
              <>
                <Dato
                  etiqueta="Nacimiento"
                  valor={formatearFechaLarga(miembro.sensibles.fechaNacimiento)}
                />
                <Dato
                  etiqueta="Dirección"
                  valor={
                    [miembro.sensibles.direccion, miembro.sensibles.ciudad]
                      .filter(Boolean)
                      .join(' · ') || null
                  }
                />
                <Dato
                  etiqueta="Estado civil"
                  valor={miembro.sensibles.estadoCivil}
                  ultimo
                />
              </>
            ) : (
              <div className="flex items-center gap-2.5 px-4 py-3.5 text-[13.5px] text-muted-foreground">
                <Lock className="size-4 flex-none" strokeWidth={1.7} />
                Los datos personales de esta persona están protegidos y no
                tienes acceso a ellos.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="t-micro">Ministerios</span>
            {miembro.ministerios.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-alt px-4 py-3.5 text-[14px] text-muted-foreground">
                Todavía no sirve en ningún ministerio.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {miembro.ministerios.map((m) => (
                  <span
                    key={m.id}
                    className="rounded-full bg-background px-3 py-1.5 text-[13px] font-semibold text-muted-foreground"
                  >
                    {m.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {miembro.sensibles?.notas && (
            <div className="flex flex-col gap-2.5">
              <span className="t-micro">Nota del pastorado</span>
              <p className="rounded-xl border border-border bg-surface-alt px-4 py-3.5 text-[14.5px] leading-relaxed">
                {miembro.sensibles.notas}
              </p>
            </div>
          )}
        </div>
      </div>
    </Capa>
  );
}

function Capa({
  cerrar,
  children,
}: {
  cerrar: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* El fondo es un enlace y no un div con onClick: sin JavaScript sigue
          cerrando, y el teclado lo alcanza con el tabulador. */}
      <Link
        href={cerrar}
        scroll={false}
        aria-label="Cerrar"
        className="fixed inset-0 z-40 bg-black/45"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[500px] flex-col overflow-hidden border-l border-border bg-surface"
      >
        {children}
      </aside>
    </>
  );
}

function Dato({
  etiqueta,
  valor,
  ultimo,
}: {
  etiqueta: string;
  valor: string | null;
  ultimo?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[130px_1fr] gap-4 px-4 py-3.5 ${ultimo ? '' : 'border-b border-border'}`}
    >
      <span className="t-label text-muted-foreground">{etiqueta}</span>
      <span className="text-[15px] leading-snug">
        {valor ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

function AccionEnlace({
  href,
  Icono,
  children,
}: {
  href: string;
  Icono: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-alt px-3.5 text-[13.5px] font-semibold text-foreground no-underline hover:bg-background hover:no-underline"
    >
      <Icono className="size-4" strokeWidth={1.7} />
      {children}
    </a>
  );
}

function formatearFechaLarga(fecha: string | null): string | null {
  if (!fecha) return null;
  return new Date(`${fecha}T00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
