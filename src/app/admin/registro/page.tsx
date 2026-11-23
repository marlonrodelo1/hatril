import type { Metadata } from 'next';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { leerRegistro } from '@/lib/admin/registro';
import type { AccionAdmin } from '@/lib/db/schema';
import { Contenedor } from '@/app/panel/_components/contenedor';
import { CabeceraAdmin } from '../_components/cabecera';
import { ListaRegistro } from '../_components/registro';
import { Filtros } from '../_components/cuentas-filtros';

export const metadata: Metadata = { title: 'Registro' };

const LIMITE = 200;

/*
 * Los filtros juntan acciones por la pregunta que se hace al leer el
 * registro, no una a una: suspender y reactivar van juntas porque la pregunta
 * es «¿qué ha pasado con el acceso de esta iglesia?».
 */
const TIPOS = {
  pruebas: 'Pruebas',
  acceso: 'Suspender y reactivar',
  directorio: 'Directorio',
  contrasenas: 'Contraseñas',
} as const;

type Tipo = keyof typeof TIPOS;

// Un `Record` y no una lista: una palanca nueva en `accion_admin_enum` no
// compila hasta que alguien decida en qué filtro sale.
const TIPO_DE: Record<AccionAdmin, Tipo> = {
  ampliar_prueba: 'pruebas',
  suspender_iglesia: 'acceso',
  reactivar_iglesia: 'acceso',
  sacar_del_directorio: 'directorio',
  poner_contrasena: 'contrasenas',
};

const Params = z.object({
  tipo: z
    .enum(Object.keys(TIPOS) as [Tipo, ...Tipo[]])
    .optional()
    .catch(undefined),
});

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Todo lo que se ha hecho desde `/admin`, lo último arriba y agrupado por día.
 *
 * EL FILTRO SE HACE SOBRE LOS DOSCIENTOS ÚLTIMOS
 * ----------------------------------------------
 * `leerRegistro` no filtra por acción, y con un solo super admin y unas pocas
 * palancas doscientos apuntes son meses. Así que se leen los últimos y el
 * filtro y sus números se calculan sobre ellos, en el servidor: lista y
 * números salen siempre del mismo montón y no se contradicen. El día que se
 * llegue al tope, la pantalla lo dice; entonces tocará filtrar en la consulta.
 * El de cada iglesia y cada cuenta ya está en su ficha.
 */
export default async function AdminRegistroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const leidos = Params.safeParse({ tipo: primero(sp.tipo) || undefined });
  const tipo = leidos.success ? leidos.data.tipo : undefined;

  const apuntes = await leerRegistro({}, LIMITE);

  const cuantos = { pruebas: 0, acceso: 0, directorio: 0, contrasenas: 0 } satisfies Record<
    Tipo,
    number
  >;
  for (const a of apuntes) cuantos[TIPO_DE[a.accion]] += 1;

  const visibles = tipo ? apuntes.filter((a) => TIPO_DE[a.accion] === tipo) : apuntes;

  return (
    <>
      <CabeceraAdmin
        titulo="Registro"
        subtitulo="Lo que se ha hecho desde aquí. Solo se añade: no se edita ni se borra."
      />

      <Contenedor>
        {/* Una línea de tiempo no se lee a 1600 px: la hora quedaría a un
            palmo de la frase. Se queda en el ancho de lectura. */}
        <div className="flex w-full max-w-3xl flex-col gap-5">
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
            Cada cambio hecho desde esta administración queda apuntado aquí en
            el mismo momento, y no se puede editar ni borrar: ni desde la
            pantalla ni desde la base de datos. Las contraseñas no se guardan
            nunca, solo que se pusieron.
          </p>

          <Filtros
            etiqueta="Filtrar por tipo de acción"
            opciones={[
              {
                href: '/admin/registro',
                texto: 'Todo',
                n: apuntes.length,
                activa: !tipo,
              },
              ...(Object.keys(TIPOS) as Tipo[]).map((t) => ({
                href: `/admin/registro?tipo=${t}`,
                texto: TIPOS[t],
                n: cuantos[t],
                activa: tipo === t,
              })),
            ]}
          />

          {visibles.length === 0 ? (
            // Aquí la lista va sin tarjeta, y su vacío sin tarjeta se perdería
            // sobre el fondo: este lleva la suya.
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
              {tipo
                ? `Nada de «${TIPOS[tipo]}» ${apuntes.length === LIMITE ? `entre los ${LIMITE} últimos` : 'todavía'}.`
                : 'Todavía no se ha hecho nada desde aquí.'}
            </p>
          ) : (
            <ListaRegistro
              apuntes={visibles}
              porDia
              marco={false}
              vacio="Todavía no se ha hecho nada desde aquí."
            />
          )}

          {apuntes.length === LIMITE && (
            <p className="text-label text-muted-foreground">
              Se ven los {LIMITE} últimos, y los filtros cuentan solo esos.
            </p>
          )}
        </div>
      </Contenedor>
    </>
  );
}
