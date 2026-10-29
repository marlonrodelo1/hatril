import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { leerRegistro } from '@/lib/admin/registro';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../_components/cabecera';
import { ListaRegistro } from '../_components/registro';

export const metadata: Metadata = { title: 'Registro' };

const LIMITE = 200;

/**
 * Todo lo que se ha hecho desde `/admin`, lo último arriba.
 *
 * Sin filtros todavía: con un solo super admin y unas pocas palancas, doscientos
 * apuntes son meses. El de cada iglesia y cada cuenta ya está en su ficha.
 */
export default async function AdminRegistroPage() {
  await requireSuperAdmin();
  const apuntes = await leerRegistro({}, LIMITE);

  return (
    <>
      <CabeceraAdmin
        titulo="Registro"
        subtitulo="Lo que se ha hecho desde aquí, quién y cuándo"
      />

      <Contenedor>
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
          Cada cambio hecho desde esta administración queda apuntado aquí en el
          mismo momento, y no se puede editar ni borrar: ni desde la pantalla ni
          desde la base de datos. Las contraseñas no se guardan nunca, solo que
          se pusieron.
        </p>

        <ListaRegistro apuntes={apuntes} vacio="Todavía no se ha hecho nada desde aquí." />

        {apuntes.length === LIMITE && (
          <p className="text-label text-muted-foreground">
            Se ven los {LIMITE} últimos.
          </p>
        )}
      </Contenedor>
    </>
  );
}
