import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarPlus, EyeOff, ExternalLink, Power, PowerOff } from 'lucide-react';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { fichaIglesia } from '@/lib/admin/consultas';
import { leerRegistro } from '@/lib/admin/registro';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { timestampAFechaHoraLocal } from '@/lib/fecha/zona';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../../_components/cabecera';
import { Cifra, Dato, Insignia, fecha } from '../../_components/piezas';
import { ListaRegistro } from '../../_components/registro';
import {
  ampliarPrueba,
  reactivarIglesia,
  sacarDelDirectorio,
  suspenderIglesia,
} from '../actions';

export const metadata: Metadata = { title: 'Iglesia' };

/**
 * Los textos de confirmación, por clave. `Object.hasOwn` al leerlos: con
 * `CONFIRMACIONES[ok]` a secas, `?ok=constructor` pinta una función (lo cuenta
 * `ESTADO.md` de las pantallas de `/mi/equipo`).
 */
const CONFIRMACIONES: Record<string, string> = {
  prueba: 'Prueba ampliada.',
  suspendida: 'Iglesia suspendida. Nadie de ella puede entrar y su web ya no se ve.',
  reactivada: 'Iglesia reactivada.',
  directorio: 'Ya no sale en el directorio.',
};

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function AdminIglesiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const { id: crudo } = await params;
  const sp = await searchParams;

  // Un id que no es uuid haría reventar la consulta con un 500. Se vuelve al
  // listado con el porqué, que es lo que la guía pide en vez de un 404 en negro.
  const id = z.uuid().safeParse(crudo);
  if (!id.success) {
    redirect('/admin/iglesias?error=' + encodeURIComponent('Esa iglesia no existe.'));
  }

  const [ficha, historial] = await Promise.all([
    fichaIglesia(id.data),
    leerRegistro({ iglesiaId: id.data }, 20),
  ]);
  if (!ficha) {
    redirect('/admin/iglesias?error=' + encodeURIComponent('Esa iglesia no existe.'));
  }

  const { iglesia, situacion } = ficha;
  const error = primero(sp.error)?.slice(0, 300);
  const okClave = primero(sp.ok);
  const ok =
    okClave && Object.hasOwn(CONFIRMACIONES, okClave)
      ? CONFIRMACIONES[okClave]
      : null;

  const accesoHasta = iglesia.trialUntil
    ? fecha(iglesia.trialUntil, iglesia.timezone)
    : 'Sin fecha';
  // Lo que viene puesto en el campo: la fecha que ya tiene, para corregirla
  // desde ahí, o nada si no tiene.
  const fechaActual = iglesia.trialUntil
    ? timestampAFechaHoraLocal(iglesia.trialUntil, iglesia.timezone).fecha
    : '';
  const hoy = hoyEnLaIglesia(iglesia.timezone);
  const esPrueba = iglesia.plan === 'trial';
  const enDirectorio = iglesia.visibleEnDirectorio && iglesia.activa;

  return (
    <>
      <CabeceraAdmin
        titulo={iglesia.nombre}
        subtitulo={[iglesia.ciudad, iglesia.pais].filter(Boolean).join(', ')}
        volver={{ href: '/admin/iglesias', texto: 'Iglesias' }}
      >
        {iglesia.webPublica && iglesia.activa && (
          <a
            href={`/i/${iglesia.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            <ExternalLink strokeWidth={1.8} /> Ver su web
          </a>
        )}
      </CabeceraAdmin>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra rotulo="Personas" valor={ficha.personas} detalle="En su fichero" />
          <Cifra rotulo="Ministerios" valor={ficha.ministeriosActivos} detalle="Activos" />
          <Cifra rotulo="Cuentas" valor={ficha.cuentas} detalle="Con acceso a la iglesia" />
          <Cifra
            rotulo="Solicitudes"
            valor={ficha.solicitudesPendientes}
            detalle="Sin contestar"
          />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          {/* ---------- Suscripción ---------- */}
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="t-subtitulo">Suscripción</h2>
              <Insignia tono={situacion.tono}>{situacion.etiqueta}</Insignia>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Dato etiqueta={esPrueba ? 'La prueba acaba' : 'Acceso pagado hasta'}>
                {iglesia.plan === 'trial' || iglesia.plan === 'cancelado'
                  ? accesoHasta
                  : 'Lo lleva Stripe'}
              </Dato>
              <Dato etiqueta="Cliente de Stripe">
                {iglesia.stripeCustomerId ? (
                  <code className="text-label">{iglesia.stripeCustomerId}</code>
                ) : (
                  'Todavía no ha pasado por el pago'
                )}
              </Dato>
            </dl>

            {esPrueba ? (
              <form
                action={ampliarPrueba}
                className="flex flex-col gap-3 rounded-lg bg-surface-alt p-4"
              >
                <input type="hidden" name="id" value={iglesia.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hasta">Ampliar la prueba hasta</Label>
                  <p className="t-label text-muted-foreground">
                    Hasta las 23:59 de ese día en su hora ({iglesia.timezone}).
                  </p>
                </div>
                {/* Apilados siempre: la tarjeta va a media pantalla, y en fila
                    el campo se quedaba en 69 px a 1024 con el día cortado. */}
                <div className="flex flex-col items-start gap-3">
                  <Input
                    id="hasta"
                    name="hasta"
                    type="date"
                    required
                    min={hoy}
                    defaultValue={fechaActual >= hoy ? fechaActual : ''}
                    className="w-full max-w-[220px]"
                  />
                  <Button type="submit">
                    <CalendarPlus strokeWidth={1.8} /> Guardar la fecha
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-label text-muted-foreground">
                Esta iglesia ya pasó por Stripe. Su acceso se cambia allí, no
                aquí.
              </p>
            )}
          </section>

          {/* ---------- Con quién hablar ---------- */}
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">Con quién hablar</h2>

            {ficha.pastores.length === 0 ? (
              <p className="text-label text-muted-foreground">
                Ninguna cuenta tiene el rol de pastor en esta iglesia.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {ficha.pastores.map((p) => (
                  <li key={p.authUserId} className="flex flex-col gap-0.5">
                    <Link
                      href={`/admin/cuentas/${p.authUserId}`}
                      className="w-fit text-body font-semibold text-foreground"
                    >
                      {p.nombre}
                    </Link>
                    <span className="text-label text-muted-foreground">
                      Pastor · {p.email ?? 'sin correo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Dato etiqueta="Correo de la iglesia">{iglesia.email ?? '—'}</Dato>
              <Dato etiqueta="Teléfono">{iglesia.telefono ?? '—'}</Dato>
            </dl>
          </section>

          {/* ---------- Datos ---------- */}
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">Datos</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Dato etiqueta="Dirección en Hatril">/i/{iglesia.slug}</Dato>
              <Dato etiqueta="Alta">{fecha(iglesia.createdAt)}</Dato>
              <Dato etiqueta="Denominación">{iglesia.denominacion ?? '—'}</Dato>
              <Dato etiqueta="Zona horaria y moneda">
                {iglesia.timezone} · {iglesia.moneda}
              </Dato>
              <Dato etiqueta="Web pública">
                {iglesia.webPublica ? 'Publicada' : 'Sin publicar'}
              </Dato>
              <Dato etiqueta="Dominio propio">{iglesia.dominioPropio ?? '—'}</Dato>
            </dl>
          </section>

          {/* ---------- Directorio ---------- */}
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="t-subtitulo">Directorio</h2>
              {/* Suspendida no sale aunque la casilla siga marcada: el
                  directorio filtra también por `activa`. */}
              <Insignia tono={enDirectorio ? 'exito' : 'neutro'}>
                {enDirectorio ? 'Sale' : 'No sale'}
              </Insignia>
            </div>
            <p className="text-label text-muted-foreground">
              Salir en el buscador de iglesias lo decide la propia iglesia desde
              sus ajustes. Desde aquí solo se puede retirar una ficha que no
              debería estar.
            </p>
            {iglesia.visibleEnDirectorio && (
              <form action={sacarDelDirectorio}>
                <input type="hidden" name="id" value={iglesia.id} />
                <Button type="submit" variant="outline">
                  <EyeOff strokeWidth={1.8} /> Sacar del directorio
                </Button>
              </form>
            )}
          </section>
        </div>

        {/* ---------- Suspender ---------- */}
        {iglesia.activa ? (
          <section className="flex flex-col gap-3 rounded-xl border border-danger-border bg-danger-soft p-5">
            <h2 className="t-subtitulo">Suspender la iglesia</h2>
            <p className="max-w-[70ch] text-label text-muted-foreground">
              Nadie de la congregación podrá entrar, ni al panel ni a la app, y su
              web y su ficha del directorio dejarán de verse. No se borra nada:
              al reactivarla todo vuelve como estaba.
            </p>
            <form action={suspenderIglesia} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={iglesia.id} />
              <label className="flex cursor-pointer items-center gap-2.5 text-body">
                {/* `required` además de la comprobación del servidor: el aviso
                    de la action sale arriba de la página, y quien pulsa aquí
                    abajo no lo veía. El navegador avisa junto a la casilla. */}
                <input
                  type="checkbox"
                  name="confirmar"
                  required
                  className="size-4 accent-destructive"
                />
                Entiendo que {iglesia.nombre} se queda sin acceso
              </label>
              <div>
                <Button type="submit" variant="destructive">
                  <PowerOff strokeWidth={1.8} /> Suspender
                </Button>
              </div>
            </form>
          </section>
        ) : (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">Iglesia suspendida</h2>
            <p className="max-w-[70ch] text-label text-muted-foreground">
              Nadie de la congregación puede entrar y su web no se ve. Al
              reactivarla, todo vuelve como estaba.
            </p>
            <form action={reactivarIglesia}>
              <input type="hidden" name="id" value={iglesia.id} />
              <Button type="submit" variant="secondary">
                <Power strokeWidth={1.8} /> Reactivar
              </Button>
            </form>
          </section>
        )}

        {/* ---------- Historial ---------- */}
        <section className="flex flex-col gap-2.5">
          <h2 className="t-micro px-1">Lo que se ha hecho con esta iglesia</h2>
          <ListaRegistro
            apuntes={historial}
            vacio="Nadie ha tocado esta iglesia desde la administración."
          />
        </section>
      </Contenedor>
    </>
  );
}
