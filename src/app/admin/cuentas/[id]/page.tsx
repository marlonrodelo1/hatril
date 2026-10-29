import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { ETIQUETAS_ROLES } from '@/lib/auth/permisos';
import { PASSWORD_PISTA } from '@/lib/auth/password';
import { fichaCuenta } from '@/lib/admin/consultas';
import { leerRegistro } from '@/lib/admin/registro';
import { haceCuanto } from '@/lib/format/hace-cuanto';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../../_components/cabecera';
import { Dato, Insignia, fecha } from '../../_components/piezas';
import { ListaRegistro } from '../../_components/registro';
import { ponerContrasena } from '../actions';

export const metadata: Metadata = { title: 'Cuenta' };

const CONFIRMACIONES: Record<string, string> = {
  contrasena:
    'Contraseña cambiada. Díctasela por teléfono y pídele que la cambie al entrar.',
};

const ESTADOS_MEMBRESIA: Record<string, string> = {
  activo: 'Activa',
  pendiente: 'Solicitud pendiente',
  rechazado: 'Rechazada',
  baja: 'De baja',
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

        <div className="grid items-start gap-4 lg:grid-cols-2">
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

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">Sus iglesias</h2>
            {cuenta.membresias.length === 0 ? (
              <p className="text-label text-muted-foreground">
                No pertenece a ninguna iglesia ni ha pedido entrar en ninguna.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {cuenta.membresias.map((m) => (
                  <li key={m.iglesiaId} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/admin/iglesias/${m.iglesiaId}`}
                        className="truncate text-body font-semibold text-foreground"
                      >
                        {m.iglesiaNombre}
                      </Link>
                      <span className="text-label text-muted-foreground">
                        {ETIQUETAS_ROLES[m.rol].titulo}
                      </span>
                    </span>
                    <Insignia tono={m.estado === 'activo' ? 'exito' : 'neutro'}>
                      {ESTADOS_MEMBRESIA[m.estado] ?? m.estado}
                    </Insignia>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-span-2">
            <div className="flex flex-col gap-1">
              <h2 className="t-subtitulo">Poner una contraseña provisional</h2>
              <p className="max-w-[70ch] text-label text-muted-foreground">
                Para quien no puede recuperarla por correo. Escríbela, díctasela
                por teléfono y pídele que la cambie en cuanto entre. Su contraseña
                de ahora deja de valer.
              </p>
            </div>
            <form action={ponerContrasena} className="flex flex-col gap-3 sm:max-w-[520px]">
              <input type="hidden" name="id" value={cuenta.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Contraseña nueva</Label>
                <Input
                  id="password"
                  name="password"
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  minLength={8}
                />
                <p className="t-label text-muted-foreground">{PASSWORD_PISTA}.</p>
              </div>
              <div>
                <Button type="submit">
                  <KeyRound strokeWidth={1.8} /> Cambiar la contraseña
                </Button>
              </div>
            </form>
          </section>
        </div>

        <section className="flex flex-col gap-2.5">
          <h2 className="t-micro px-1">Lo que se ha hecho con esta cuenta</h2>
          <ListaRegistro
            apuntes={historial}
            vacio="Nadie ha tocado esta cuenta desde la administración."
          />
        </section>
      </Contenedor>
    </>
  );
}
