import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, Trash2 } from 'lucide-react';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { puedeVerDatosSensibles } from '@/lib/auth/permisos';
import { obtenerMiembro, listarMinisterios } from '@/lib/miembros/consultas';
import { editarMiembro, darDeBaja } from '../../actions';
import { FormularioMiembro } from '../../_components/formulario';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Editar ficha' };

export default async function EditarMiembroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requirePermiso('editar_miembros');
  const { id } = await params;
  const { error } = await searchParams;

  const [miembro, ministerios] = await Promise.all([
    obtenerMiembro(ctx, id),
    listarMinisterios(ctx),
  ]);

  // `notFound()` tanto si no existe como si está fuera del ámbito de quien
  // mira. Distinguir los dos casos ya revelaría que esa persona está en la
  // iglesia, que es justo el dato protegido.
  if (!miembro) notFound();

  const nombreCompleto = [miembro.nombre, miembro.apellidos]
    .filter(Boolean)
    .join(' ');

  // La acción necesita saber a quién edita, y el id no puede venir de un campo
  // del formulario: sería editable desde el navegador. `bind` lo fija en el
  // servidor antes de que el formulario llegue a existir.
  const guardar = editarMiembro.bind(null, miembro.id);
  const baja = darDeBaja.bind(null, miembro.id);

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href={`/panel/miembros?ficha=${miembro.id}`}
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
          {nombreCompleto}
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Editar la ficha
        </h1>
      </header>

      <div className="flex w-full max-w-[760px] flex-col gap-8 px-5 pb-16 pt-6 md:px-8">
        <FormularioMiembro
          accion={guardar}
          miembro={miembro}
          ministerios={ministerios}
          puedeVerSensibles={puedeVerDatosSensibles(ctx)}
          error={error}
        />

        <section className="flex flex-col gap-3 rounded-xl border border-[#E0C4C2] bg-surface p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="t-subtitulo">Dar de baja</h2>
            <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
              Deja de aparecer en el listado y sale de sus ministerios, pero se
              conserva su histórico. Si necesitas borrar sus datos de verdad
              —porque lo ha pedido—, escríbenos: es otra cosa y no tiene vuelta
              atrás.
            </p>
          </div>

          {/*
           * Formulario propio y no un botón dentro del de arriba: dos `submit`
           * en el mismo formulario compiten, y el de la izquierda gana con la
           * tecla Enter. Alguien corrigiendo un apellido y pulsando Enter daría
           * de baja a la persona.
           */}
          <form action={baja} className="w-fit">
            <Button type="submit" variant="destructive">
              <Trash2 strokeWidth={1.7} />
              Dar de baja a {miembro.nombre}
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
