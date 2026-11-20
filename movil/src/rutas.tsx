import { createBrowserRouter } from 'react-router';

import { ConSesion, Raiz } from './raiz';
import { Arranque } from './pantallas/arranque';
import { Acceso } from './pantallas/acceso/acceso';
import { CrearCuenta } from './pantallas/acceso/crear-cuenta';
import { Recuperar } from './pantallas/acceso/recuperar';
import { Bienvenida, Buscar, BuscarCerca, BuscarCiudad, Empezar } from './pantallas/bienvenida';
import { FichaIglesia, Solicitar } from './pantallas/iglesia';
import { NoExiste } from './pantallas/en-obras';
import { MarcoMiembro } from './componentes/marco-miembro';
import { Devocional } from './pantallas/mi/devocional';
import { Agenda } from './pantallas/mi/agenda';
import { Reunion, Turno } from './pantallas/mi/agenda-fichas';
import { Avisos } from './pantallas/mi/avisos';
import { Comunidad, DenunciaEnviada, Denuncias } from './pantallas/mi/comunidad';
import { Acepta, CuentaEnBaja } from './pantallas/mi/acepta';
import { Biblia, Bloqueados, Borrar, Cuenta, Donativos } from './pantallas/mi/cuenta';
import { Equipo } from './pantallas/mi/equipo';

/**
 * Las rutas de la app son LAS MISMAS que las de la web.
 *
 * No es estética: el `enlace` de cada aviso y de cada push es una ruta de la
 * web (`/mi/comunidad#…`, `/mi/agenda/turno/…`), y con las mismas rutas vale
 * sin traducir nada. Una pantalla nueva aquí va con la ruta que tenga en la
 * web, o con la que tendría.
 */
export const enrutador = createBrowserRouter([
  {
    element: <Raiz />,
    children: [
      { path: '/', element: <Arranque /> },

      // La bienvenida y el directorio: sin sesión.
      { path: '/bienvenida', element: <Bienvenida /> },
      { path: '/empezar', element: <Empezar /> },
      { path: '/buscar', element: <Buscar /> },
      { path: '/buscar/ciudad', element: <BuscarCiudad /> },
      { path: '/buscar/cerca', element: <BuscarCerca /> },
      { path: '/iglesia/:slug', element: <FichaIglesia /> },
      { path: '/solicitar/:slug', element: <Solicitar /> },

      // Entrar.
      { path: '/acceso', element: <Acceso /> },
      { path: '/crear-cuenta', element: <CrearCuenta /> },
      { path: '/recuperar', element: <Recuperar /> },

      {
        element: <ConSesion />,
        children: [
          { path: '/mi', element: <Arranque /> },
          // Fuera del marco del miembro: la sala de espera también enlaza aquí,
          // y quien no tiene iglesia no tiene barra de abajo.
          { path: '/mi/cuenta/borrar', element: <Borrar /> },
          {
            // La barra de abajo y la radio: `src/app/mi/layout.tsx`.
            element: <MarcoMiembro />,
            children: [
              { path: '/mi/devocional', element: <Devocional /> },
              { path: '/mi/agenda', element: <Agenda /> },
              { path: '/mi/agenda/turno/:id', element: <Turno /> },
              { path: '/mi/agenda/reunion/:id', element: <Reunion /> },
              { path: '/mi/comunidad', element: <Comunidad /> },
              { path: '/mi/comunidad/denuncias', element: <Denuncias /> },
              { path: '/mi/comunidad/denuncia-enviada', element: <DenunciaEnviada /> },
              { path: '/mi/biblia', element: <Biblia /> },
              { path: '/mi/cuenta', element: <Cuenta /> },
              { path: '/mi/cuenta/bloqueados', element: <Bloqueados /> },
              { path: '/mi/cuenta/donativos', element: <Donativos /> },
              { path: '/mi/avisos', element: <Avisos /> },
              { path: '/mi/equipo/*', element: <Equipo /> },
            ],
          },
          { path: '/acepta', element: <Acepta /> },
          { path: '/cuenta-en-baja', element: <CuentaEnBaja /> },
        ],
      },

      { path: '*', element: <NoExiste /> },
    ],
  },
]);
