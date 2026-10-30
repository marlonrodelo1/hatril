import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RotateCcw } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { bajaPendiente } from '@/lib/cuenta/baja';
import { Logo } from '@/components/marca/logo';
import { Button } from '@/components/ui/button';
import { salir } from '../(auth)/actions';
import { recuperar } from '../mi/cuenta/borrar/actions';

export const metadata: Metadata = { title: 'Tu cuenta se va a borrar' };

/**
 * Lo que ve quien pidió borrar su cuenta y vuelve a entrar antes del plazo.
 *
 * Llega aquí desde `/mi`: sus membresías están en `baja`, así que no tiene
 * contexto de iglesia, y `/mi` pregunta si es por una baja antes de contarle
 * nada sobre solicitudes. No se recupera sola al entrar: entrar puede ser
 * mirar, y la decisión de quedarse se toma con un botón.
 */
export default async function CuentaEnBajaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/acceso');

  const baja = await bajaPendiente(user.id);
  if (!baja) redirect('/mi');

  const dia = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(baja.borrarDesde);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-5">
        <Logo variante="logotipo" tamano={24} />

        <h1 className="text-[24px] font-extrabold tracking-[-0.025em]">
          Tu cuenta se borra el {dia}
        </h1>
        <p className="text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
          Pediste borrarla, así que está desactivada. Si la recuperas, vuelves a
          tu iglesia tal y como la dejaste. Los turnos que tenías siguen sin
          cubrir: habla con tu equipo si puedes volver a servir.
        </p>

        <form action={recuperar}>
          <Button type="submit" size="lg" className="w-full">
            <RotateCcw strokeWidth={1.8} />
            Recuperar mi cuenta
          </Button>
        </form>

        <form action={salir}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Cerrar sesión y dejar que se borre
          </Button>
        </form>
      </div>
    </div>
  );
}
