'use client';

import { useState } from 'react';
import { CirclePause, CirclePlay, EyeOff, TriangleAlert } from 'lucide-react';

import { BotonEnviar } from '@/components/ui/boton-enviar';
import { reactivarIglesia, sacarDelDirectorio, suspenderIglesia } from '../../actions';
import { CabeceraVentana, PieVentana, Ventana } from './ventana';

/**
 * Las tres palancas de sí o no: sacar del directorio, suspender y reactivar.
 * Cada una con su ventana y el texto de lo que va a pasar; las reglas siguen
 * en la action, que vuelve a leer la iglesia antes de tocar nada.
 */

const ICONO = 'size-[18px]';

export function VentanaDirectorio({
  id,
  nombre,
  activa,
  webPublica,
  describidoPor,
}: {
  id: string;
  nombre: string;
  activa: boolean;
  webPublica: boolean;
  describidoPor: string;
}) {
  return (
    <Ventana
      id={id}
      accion={sacarDelDirectorio}
      disparador={{ texto: 'Sacar', describidoPor }}
    >
      <CabeceraVentana
        icono={<EyeOff className={ICONO} strokeWidth={1.8} />}
        titulo={`¿Sacar a ${nombre} del directorio?`}
      >
        Deja de salir en el buscador de iglesias.
        {webPublica && activa && ' Su web sigue abierta para quien tenga el enlace.'}
        {/* Suspendida no sale aunque la casilla siga marcada (el directorio
            filtra también por `activa`), y es justo cuando conviene decir qué
            cambia: que al reactivarla no vuelve. */}
        {!activa && ' Ahora no sale porque está suspendida; así tampoco volverá al reactivarla.'}{' '}
        Volver a salir lo decide la propia iglesia desde sus ajustes.
      </CabeceraVentana>

      <PieVentana>
        {/* Carbón y no naranja: retira algo, y la ficha no tiene acción
            principal que destacar. */}
        <BotonEnviar variant="secondary" pendiente="Sacándola…">
          <EyeOff strokeWidth={1.8} /> Sacar del directorio
        </BotonEnviar>
      </PieVentana>
    </Ventana>
  );
}

export function VentanaSuspender({
  id,
  nombre,
  describidoPor,
}: {
  id: string;
  nombre: string;
  describidoPor: string;
}) {
  return (
    <Ventana
      id={id}
      accion={suspenderIglesia}
      disparador={{
        texto: 'Suspender',
        icono: <CirclePause strokeWidth={1.8} />,
        variante: 'destructive',
        describidoPor,
      }}
    >
      <FormularioSuspender nombre={nombre} />
    </Ventana>
  );
}

/**
 * Lo de dentro va aparte para que la casilla viva DENTRO de la ventana: se
 * monta al abrir y se desmonta al cerrar, así que siempre empieza sin marcar.
 */
function FormularioSuspender({ nombre }: { nombre: string }) {
  const [entendido, setEntendido] = useState(false);

  return (
    <>
      <CabeceraVentana
        icono={<TriangleAlert className={ICONO} strokeWidth={1.8} />}
        titulo={`¿Suspender ${nombre}?`}
        peligro
      >
        Nadie de la congregación podrá entrar, ni al panel ni a la app, y su
        web y su ficha del directorio dejarán de verse. No se borra nada: al
        reactivarla, todo vuelve como estaba.
      </CabeceraVentana>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-danger-border bg-danger-soft px-3.5 py-3 text-body">
        {/* `required` además del botón apagado y de la comprobación de la
            action: es la que manda (`casilla(formData, 'confirmar')`), y si el
            botón se encendiera por lo que sea, el navegador seguiría avisando
            junto a la casilla. */}
        <input
          type="checkbox"
          name="confirmar"
          required
          checked={entendido}
          onChange={(e) => setEntendido(e.target.checked)}
          className="mt-0.5 size-4 flex-none accent-destructive"
        />
        <span className="min-w-0 text-pretty">
          Entiendo que {nombre} se queda sin acceso
        </span>
      </label>

      <PieVentana>
        {/* Relleno de rojo, no el contorno del `destructive` de siempre: ese
            espera a que se pulse para no competir con un botón naranja, y en
            esta ventana no hay otro. Lo aprobado es el rojo lleno. */}
        <BotonEnviar
          variant="destructive"
          pendiente="Suspendiendo…"
          disabled={!entendido}
          className="border-danger bg-danger text-destructive-foreground hover:bg-danger active:bg-danger"
        >
          <CirclePause strokeWidth={1.8} /> Suspender
        </BotonEnviar>
      </PieVentana>
    </>
  );
}

export function VentanaReactivar({
  id,
  nombre,
  alReactivar,
  describidoPor,
}: {
  id: string;
  nombre: string;
  /** La situación en que queda al volver: «Vencida · solo lectura». */
  alReactivar: string;
  describidoPor: string;
}) {
  return (
    <Ventana
      id={id}
      accion={reactivarIglesia}
      disparador={{ texto: 'Reactivar', describidoPor }}
    >
      <CabeceraVentana
        icono={<CirclePlay className={ICONO} strokeWidth={1.8} />}
        titulo={`¿Reactivar ${nombre}?`}
      >
        La congregación vuelve a entrar al panel y a la app, y su web y su ficha
        del directorio se ven otra vez si las tenía publicadas. Todo está como lo
        dejó. Al reactivarla queda en «{alReactivar}».
      </CabeceraVentana>

      <PieVentana>
        <BotonEnviar pendiente="Reactivando…">
          <CirclePlay strokeWidth={1.8} /> Reactivar
        </BotonEnviar>
      </PieVentana>
    </Ventana>
  );
}
