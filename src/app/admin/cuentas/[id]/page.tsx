import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { fichaCuenta, type Tono } from '@/lib/admin/consultas';
import { leerRegistro } from '@/lib/admin/registro';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import { Aviso } from '@/components/aviso';
import { Insignia } from '@/components/ui/insignia';
import { Fila } from '@/components/ui/fila';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../../_components/cabecera';
import { Dato, fecha } from '../../_components/piezas';
import { ListaRegistro } from '../../_components/registro';
import { VentanaContrasena } from './_components/cuentas-contrasena';

export const metadata: Metadata = { title: 'Cuenta' };

const CONFIRMACIONES: Record<string, string> = {
  contrasena:
    'Contraseña cambiada. Díctasela por teléfono y pídele que la cambie al entrar.',
};

const ESTADOS_MEMBRESIA: Record<string, { texto: string; tono: Tono }> = {
  activo: { texto: 'Activa', tono: 'exito' },
  pendiente: { texto: 'Solicitud pendiente', tono: 'aviso' },
  rechazado: { texto: 'Rechazada', tono: 'peligro' },
  baja: { texto: 'De baja', tono: 'neutro' },
};

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function AdminCuentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const { id: crudo } = await params;
  const sp = await searchParams;

  const id = z.uuid().safeParse(crudo);
  if (!id.success) {
    redirect('/admin/cuentas?error=' + encodeURIComponent('Esa cuenta no existe.'));
  }

  const [cuenta, historial] = await Promise.all([
    fichaCuenta(id.data),
    leerRegistro({ cuentaAuthUserId: id.data }, 20),
  ]);
  if (!cuenta) {
    redirect('/admin/cuentas?error=' + encodeURIComponent('Esa cuenta no existe.'));
  }

  const error = primero(sp.error)?.slice(0, 300);
  const okClave = primero(sp.ok);
  const ok =
    okClave && Object.hasOwn(CONFIRMACIONES, okClave)
      ? CONFIRMACIONES[okClave]
      : null;

  return (
    <>
      <CabeceraAdmin
        titulo={cuenta.nombre}
        subtitulo={cuenta.email ?? 'Sin correo'}
        volver={{ href: '/admin/cuentas', texto: 'Cuentas' }}
      />

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}

        {/* Dos columnas como la ficha de una iglesia: a la izquierda lo que se
            hace (la palanca y lo que ya se hizo), a la derecha lo que se
            consulta. En el móvil, en ese orden. */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <h2 className="t-subtitulo">Lo que puedes hacer</h2>
              <div className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:grid-cols-[34px_minmax(0,1fr)_auto]">
                <span className="flex size-[34px] items-center justify-center rounded-lg bg-surface-active">
                  <KeyRound className="size-4" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body font-semibold">
                    Poner una contraseña provisional
                  </span>
                  <span className="text-label text-pretty text-muted-foreground">
                    Para quien no puede recuperarla por correo. Su contraseña de
                    ahora deja de valer.
                  </span>
                </span>
                <span className="col-start-2 sm:col-start-auto">
                  <VentanaContrasena
                    id={cuenta.id}
                    para={cuenta.email?.split('@')[0] ?? cuenta.nombre}
                  />
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="t-micro px-1">Lo que se ha hecho con esta cuenta</h2>
              <ListaRegistro
                apuntes={historial}
                dentroDe="cuenta"
                vacio="Nadie ha tocado esta cuenta desde la administración."
              />
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="t-subtitulo">La cuenta</h2>
                {cuenta.esSuperAdmin && <Insignia tono="marca">Super admin</Insignia>}
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Dato etiqueta="Correo">{cuenta.email ?? '—'}</Dato>
                <Dato etiqueta="Creada">{fecha(cuenta.createdAt)}</Dato>
                <Dato etiqueta="Último acceso">
                  {cuenta.ultimoAcceso ? haceCuanto(cuenta.ultimoAcceso) : 'Nunca ha entrado'}
                </Dato>
              </dl>
            </section>

            {/* Sin relleno en la tarjeta: las filas llegan de borde a borde,
                como en cualquier lista, y el título lleva el suyo. */}
            <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              <h2 className="t-subtitulo px-5 pt-5 pb-3">Sus iglesias</h2>
              {cuenta.membresias.length === 0 ? (
                <p className="px-5 pb-5 text-label text-muted-foreground">
                  No pertenece a ninguna iglesia ni ha pedido entrar en ninguna.
                </p>
              ) : (
                <ul className="flex flex-col border-t border-border">
                  {cuenta.membresias.map((m) => {
                    const estado = ESTADOS_MEMBRESIA[m.estado] ?? {
                      texto: m.estado,
                      tono: 'neutro' as const,
                    };
                    return (
                      <Fila
                        key={m.iglesiaId}
                        href={`/admin/iglesias/${m.iglesiaId}`}
                        titulo={m.iglesiaNombre}
                        detalle={ETIQUETAS_ROLES[m.rol].titulo}
                        fin={<Insignia tono={estado.tono}>{estado.texto}</Insignia>}
                      />
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </Contenedor>
    </>
  );
}
