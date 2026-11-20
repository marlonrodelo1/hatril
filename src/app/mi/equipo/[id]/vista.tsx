import { CircleCheck, TriangleAlert } from 'lucide-react';
import { RAIZ_APP } from '@/lib/ministerios/en-la-app/rutas';
import type { RolEquipo } from '@/lib/db/schema/enums';
import { AvatarPersona } from '@/components/avatar-persona';
import { Fila, Lista, MarcoEquipo, Seccion, Vacio } from '../_components/marco';
import { Insignia } from '../_components/insignia';
import { TarjetaModulo } from '../_components/tarjeta-modulo';
import type { cargar } from './datos';

/**
 * Lo que pinta esta pantalla de `/mi/equipo`, sin consultar nada. Salió de
 * `./page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export const ROL: Record<RolEquipo, string> = {
  responsable: 'Responsable',
  colider: 'Colíder',
  voluntario: 'Voluntario',
};

export type DatosPortada = Awaited<ReturnType<typeof cargar>>;

export function VistaPortada({ error, ctx, ministerio, modo, tarjetas, total, comoQue, varios }: DatosPortada) {
  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={ministerio.nombre}
      subtitulo={[comoQue, ctx.iglesia.nombre].filter(Boolean).join(' · ')}
      volver={varios ? RAIZ_APP : undefined}
      conLogo
      error={error}
    >
      {tarjetas.length === 0 ? (
        modo === 'lider' ? (
          <Vacio titulo="Sin herramientas encendidas">
            Este ministerio todavía no usa turnos, agenda ni ninguna otra
            herramienta. Las enciende el pastor desde «Módulos», en el panel, y
            en cuanto lo haga aparecerán aquí.
          </Vacio>
        ) : (
          <Vacio titulo="Nada por aquí todavía">
            Tu equipo aún no organiza nada desde Hatril. Cuando quien lo lleva
            ponga turnos o ensayos, los verás aquí y en tu agenda.
          </Vacio>
        )
      ) : (
        <>
          {/* Una línea y no una cifra: lo que se viene a saber es si hay algo
              que hacer, no cuánto suma. */}
          <p
            className={
              'flex items-center gap-2 px-1 text-body font-semibold ' +
              (total > 0 ? 'text-badge-warning-fg' : 'text-badge-success-fg')
            }
          >
            {total > 0 ? (
              <TriangleAlert className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
            ) : (
              <CircleCheck className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
            )}
            {total === 0
              ? 'Nada pendiente'
              : total === 1
                ? 'Una cosa pide atención'
                : `${total} cosas piden atención`}
          </p>

          {tarjetas.map((t) => (
            <TarjetaModulo key={t.modulo.id} tarjeta={t} />
          ))}
        </>
      )}

      {/*
       * El equipo, abajo y sin gestionar —sumar gente y nombrar colíderes sigue
       * en el panel—. Es la pregunta que viene detrás de «falta el bajista»:
       * ¿quién más toca el bajo? Y al voluntario le dice a quién preguntar.
       * Solo nombres y papeles: lo mismo que ya se anuncia desde el púlpito.
       */}
      {ministerio.equipo.length > 0 && (
        <Seccion rotulo="El equipo">
          <Lista>
            {ministerio.equipo.map((p) => {
              const insignia = p.rolEquipo !== 'voluntario' ? ROL[p.rolEquipo] : null;
              // Lo que hace, salvo que diga lo mismo que la insignia: en la
              // demo el responsable tiene escrito «Responsable» como papel.
              const papel =
                p.rolEnMinisterio &&
                p.rolEnMinisterio.toLocaleLowerCase('es') !==
                  insignia?.toLocaleLowerCase('es')
                  ? p.rolEnMinisterio
                  : null;
              const linea = [p.miembroId === ctx.miembroId ? 'Tú' : null, papel]
                .filter(Boolean)
                .join(' · ');

              return (
                <Fila key={p.vinculoId}>
                  <div className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <AvatarPersona nombre={p.nombre} tamano="sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body font-semibold">{p.nombre}</span>
                      {linea && (
                        <span className="truncate text-label text-muted-foreground">
                          {linea}
                        </span>
                      )}
                    </span>
                    {insignia && <Insignia tono="marca">{insignia}</Insignia>}
                  </div>
                </Fila>
              );
            })}
          </Lista>
        </Seccion>
      )}
    </MarcoEquipo>
  );
}
