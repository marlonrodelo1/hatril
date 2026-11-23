import { RotateCcw } from 'lucide-react';

import { Logo } from '@/components/marca/logo';
import { Button } from '@/components/ui/button';
import { salir } from '../../(auth)/actions';
import { recuperar } from '../../mi/cuenta/borrar/actions';

/**
 * Lo que pinta «Tu cuenta se borra el…», sin consultar nada. Salió de
 * `../page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`).
 */
export function VistaCuentaEnBaja({ borrarDesde }: { borrarDesde: Date }) {
  const dia = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(borrarDesde);

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
