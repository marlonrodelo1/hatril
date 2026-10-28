import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { resumenPlataforma } from '@/lib/admin/consultas';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from './_components/cabecera';
import { Cifra, FilaEnlace, Insignia, fecha, plural } from './_components/piezas';

export const metadata: Metadata = { title: 'Inicio' };

/**
 * Inicio del super admin: cómo está la plataforma y a quién hay que llamar.
 *
 * Lo de arriba son recuentos y lo de abajo, iglesias con nombre. El orden
 * responde a la pregunta con la que se abre esta pantalla cada mañana —«¿hay
 * algo que hacer hoy?»—: lo que pide atención va antes que la lista de altas.
 */
export default async function AdminInicioPage() {
  await requireSuperAdmin();
  const r = await resumenPlataforma();

  // Atención: pruebas que acaban esta semana, vencidas y bloqueadas. Las
  // suspendidas NO: las suspendió alguien de aquí a propósito, y meterlas en la
  // lista de pendientes las tendría ahí para siempre.
  const atencion = r.iglesias.filter(
    (i) =>
      i.situacion.grupo !== 'suspendidas' &&
      (i.situacion.tono === 'aviso' || i.situacion.tono === 'peligro'),
  );
  const ultimas = r.iglesias.slice(0, 5);

  const desglose = [
    plural(r.porGrupo.prueba, 'en prueba', 'en prueba'),
    plural(r.porGrupo.pagan, 'paga', 'pagan'),
    r.porGrupo.vencidas > 0 && plural(r.porGrupo.vencidas, 'vencida', 'vencidas'),
    r.porGrupo.suspendidas > 0 &&
      plural(r.porGrupo.suspendidas, 'suspendida', 'suspendidas'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <CabeceraAdmin titulo="Inicio" subtitulo="Cómo está Hatril hoy" />

      <Contenedor>
        <section className="flex flex-col gap-3">
          <h2 className="t-micro px-1">La plataforma</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Cifra
              rotulo="Iglesias"
              valor={r.iglesias.length}
              detalle={desglose}
              href="/admin/iglesias"
            />
            <Cifra
              rotulo="Personas en fichas"
              valor={r.personas}
              detalle="Sin contar las archivadas"
            />
            <Cifra
              rotulo="Cuentas"
              valor={r.cuentas}
              detalle="Todas, con iglesia o sin ella"
              href="/admin/cuentas"
            />
            <Cifra
              rotulo="Solicitudes sin contestar"
              valor={r.solicitudesPendientes}
              detalle="Las contesta cada iglesia"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="t-micro px-1">Requieren atención</h2>
          {atencion.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
              Ninguna prueba acaba esta semana y no hay iglesias vencidas.
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {atencion.map((i) => (
                <li key={i.id} className="border-b border-border last:border-b-0">
                  <FilaEnlace
                    href={`/admin/iglesias/${i.id}`}
                    titulo={i.nombre}
                    datos={[i.ciudad, i.pais].filter(Boolean).join(', ')}
                  >
                    <Insignia tono={i.situacion.tono}>{i.situacion.etiqueta}</Insignia>
                  </FilaEnlace>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="t-micro px-1">Últimas altas</h2>
          {ultimas.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
              Todavía no se ha registrado ninguna iglesia.
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {ultimas.map((i) => (
                <li key={i.id} className="border-b border-border last:border-b-0">
                  <FilaEnlace
                    href={`/admin/iglesias/${i.id}`}
                    titulo={i.nombre}
                    datos={`Alta el ${fecha(i.createdAt)} · ${plural(i.personas, 'persona', 'personas')}`}
                  >
                    <Insignia tono={i.situacion.tono}>{i.situacion.etiqueta}</Insignia>
                  </FilaEnlace>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Contenedor>
    </>
  );
}
