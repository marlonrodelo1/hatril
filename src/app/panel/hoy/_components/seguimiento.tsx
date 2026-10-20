import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import {
  DIAS_EN_NUEVOS,
  type CifrasSeguimiento,
} from '@/lib/seguimiento/consultas';
import { Button } from '@/components/ui/button';

/**
 * Quién llega y quién falta, en cuatro cifras.
 *
 * SOLO NÚMEROS
 * ------------
 * Los nombres siguen detrás de las tres llaves del seguimiento: `ver_seguimiento`,
 * llevar el ministerio y el módulo encendido. Este bloque solo existe para quien
 * las tiene en al menos un ministerio (`cifrasDeSeguimiento()` devuelve `null`
 * si no), así que el enlace siempre abre.
 *
 * Cuatro preguntas que el pastor se hace el lunes, y no más: cuánta gente nueva,
 * si vuelve, si alguien la ha llamado, y a quién se le está perdiendo.
 *
 * COPIA A «LA CAJA», A PROPÓSITO
 * ------------------------------
 * La misma tarjeta entera como enlace, la misma etiqueta `t-micro` y la misma
 * cifra a 22 px. Dos tarjetas de cifras con dos estilos en la misma pantalla
 * se leen como dos productos.
 */
export function BloqueSeguimiento({ cifras }: { cifras: CifrasSeguimiento }) {
  // Con un solo ministerio con seguimiento —lo normal: Consolidación— la
  // tarjeta entera lleva a su lista de nuevos. Con dos (Consolidación y
  // Evangelismo) no hay una lista única a la que mandar: la tarjeta se queda
  // quieta y debajo va un enlace por ministerio.
  const unico = cifras.ministerios.length === 1 ? cifras.ministerios[0]! : null;

  const contenido = (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Cifra etiqueta="Llegaron este mes" valor={cifras.llegaronEsteMes} />
        <Cifra
          etiqueta="Han vuelto"
          // Sin lista no es cero, es que no se sabe. Un cero aquí diría que no
          // ha vuelto nadie.
          valor={cifras.hayListas ? cifras.volvieron : null}
          detalle={
            cifras.hayListas
              ? `de ${cifras.enNuevos} en nuevos`
              : 'sin lista, no se sabe'
          }
        />
        <Cifra etiqueta="Nuevos sin llamar" valor={cifras.sinLlamar} />
        {/* «Reuniones» y no «semanas» ni «cultos», como en la lista de
            ausentes: cuenta reuniones de la congregación con lista. La
            etiqueta corta y el resto debajo: en dos líneas, su cifra quedaba
            más baja que las otras tres. */}
        <Cifra
          etiqueta="Faltan 3 o más"
          valor={cifras.ausentesTresOMas}
          detalle="reuniones seguidas"
        />
      </div>

      {!cifras.hayListas && (
        <p className="text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          En los últimos {DIAS_EN_NUEVOS} días no se ha pasado lista en ningún
          culto. Sin lista no se sabe quién ha vuelto, y las faltas solo cuentan
          los cultos en los que sí se pasó.
        </p>
      )}
    </>
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-micro">Quién llega y quién falta</h2>

      {unico ? (
        <Link
          href={`/panel/ministerios/${unico.id}/seguimiento/nuevos`}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 text-foreground no-underline transition-colors hover:bg-surface-alt hover:no-underline"
        >
          {contenido}
        </Link>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          {contenido}
          <div className="flex flex-wrap gap-2">
            {cifras.ministerios.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                size="sm"
                render={<Link href={`/panel/ministerios/${m.id}/seguimiento/nuevos`} />}
              >
                {m.nombre}
                <ArrowRight strokeWidth={1.9} />
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Cifra({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: number | null;
  detalle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="t-micro">{etiqueta}</span>
      <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">
        {valor ?? '—'}
      </span>
      {detalle && (
        <span className="text-[13px] text-muted-foreground">{detalle}</span>
      )}
    </div>
  );
}
