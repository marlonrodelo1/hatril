import type { IglesiaPublica } from '@/lib/iglesias/publica';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { GruposCarril } from './grupos-carril';

/** Los ministerios que la iglesia enseña al público. */
export function SeccionGrupos({ iglesia }: { iglesia: IglesiaPublica }) {
  return (
    <section
      id="grupos"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
    >
      <div className="mb-7 flex flex-col gap-3">
        <span className="t-micro text-badge-accent-fg">Grupos y ministerios</span>
        <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
          Puedes sumarte a cualquiera
        </h2>
        <p className="max-w-[520px] text-[15px] leading-relaxed text-muted-foreground">
          Se entra probando, sin compromiso.
        </p>
      </div>

      {/* Los colores se resuelven aquí, en el servidor: al carril, que es de
          cliente, le llegan ya como texto y no tiene que cargar la paleta. */}
      <GruposCarril
        grupos={iglesia.grupos.map((g) => {
          const color = colorDeMinisterio(g.colorHex);
          return {
            id: g.id,
            nombre: g.nombre,
            descripcion: g.descripcion,
            fotoUrl: g.fotoUrl,
            suave: color.suave,
            claro: color.claro,
          };
        })}
      />
    </section>
  );
}
