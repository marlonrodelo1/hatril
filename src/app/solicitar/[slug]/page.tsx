import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { iglesiaParaSolicitar } from '@/lib/iglesias/directorio';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { createClient } from '@/lib/supabase/server';
import { crearCuentaYSolicitar, solicitarIngreso } from '../actions';
import { PasosSolicitud } from './_components/pasos-solicitud';
import { Permisos } from './_components/permisos';

export const metadata: Metadata = { title: 'Pedir entrar' };

/**
 * Pedir entrar en una iglesia.
 *
 * Sin sesión, el formulario lleva también la cuenta —correo y contraseña— y se
 * envía todo de una vez (`crearCuentaYSolicitar`). Con sesión, solo lo de la
 * solicitud. Es la pantalla «Cuenta» del diseño de la bienvenida: la cuenta se
 * pide aquí, al final, y no antes de dejar mirar.
 *
 * Desde el 17-nov va en pasos (pieza «Unirse» del rediseño): «Tus datos», «Tu
 * contraseña» y «Los permisos». Pide lo mismo que antes, en el mismo
 * formulario y a la misma action; el porqué y cómo funciona sin JavaScript,
 * en `_components/pasos-solicitud.tsx`.
 *
 * Lo obligatorio no lleva asterisco; lo opcional dice «opcional».
 */
export default async function SolicitarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const iglesia = await iglesiaParaSolicitar(slug);
  if (!iglesia) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión y con iglesia activa no hay nada que solicitar: esta persona ya
  // está dentro de alguna congregación. Y con una solicitud pendiente, a verla.
  if (user) {
    const ctx = await getCurrentUserContext();
    if (ctx) redirect('/mi');

    const solicitud = await solicitudDeUsuario(user.id);
    if (solicitud?.estado === 'pendiente') redirect('/mi');
  }

  // La ficha cuenta por qué no se puede: aquí no se repite.
  if (!iglesia.aceptaSolicitudes) redirect(`/iglesia/${slug}`);

  const nombreSugerido = (user?.user_metadata?.nombre as string | undefined) ?? '';

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {/* `key` con el error: si la action vuelve con uno, los pasos empiezan
          de cero, como el formulario que React acaba de vaciar. */}
      <PasosSolicitud
        key={error ?? ''}
        slug={slug}
        nombreIglesia={iglesia.nombre}
        paisIglesia={iglesia.pais}
        conSesion={Boolean(user)}
        nombreSugerido={nombreSugerido}
        error={error}
        accion={user ? solicitarIngreso : crearCuentaYSolicitar}
        permisos={<Permisos />}
      />
    </div>
  );
}
