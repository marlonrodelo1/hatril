'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { campo } from '@/lib/api/formulario';
import { traducirErrorAuth, validarPassword } from '@/lib/auth/password';
import { createAdminClient } from '@/lib/supabase/admin';

const Id = z.uuid('Cuenta no válida.');

/**
 * Pone una contraseña provisional a una cuenta.
 *
 * EXISTE POR UN CASO REAL
 * -----------------------
 * El pastor de Cuerpo de Cristo tiene la cuenta con un correo de un dominio sin
 * buzón: «recuperar contraseña» le manda un enlace que no llega a ninguna parte,
 * y no hay otra forma de que vuelva a entrar. Y mientras Resend no esté
 * configurado, eso le pasa a cualquiera.
 *
 * La contraseña se le dice a la persona por otro canal (teléfono, en persona) y
 * ella la cambia desde «Cambiar la contraseña». Nunca se guarda ni se pinta de
 * vuelta: si se olvida al dictarla, se pone otra.
 */
export async function ponerContrasena(formData: FormData) {
  await requireSuperAdmin();

  const r = Id.safeParse(campo(formData, 'id'));
  if (!r.success) {
    redirect('/admin/cuentas?error=' + encodeURIComponent('Cuenta no válida.'));
  }
  const id = r.data;
  const volver = (clave: 'error' | 'ok', valor: string): never =>
    redirect(`/admin/cuentas/${id}?${clave}=${encodeURIComponent(valor)}`);

  // `campo()` recorta los espacios, y en una contraseña un espacio al final es
  // un carácter. Se lee el valor tal cual, comprobando solo que sea texto.
  const crudo = formData.get('password');
  const password = typeof crudo === 'string' ? crudo : '';

  const fallo = validarPassword(password);
  if (fallo) volver('error', fallo);

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(id, { password });
  if (error) volver('error', traducirErrorAuth(error.message));

  volver('ok', 'contrasena');
}
