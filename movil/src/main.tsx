import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';

import './estilos.css';
import { clienteQuery } from './lib/cliente-query';
import { ProveedorSesion } from './lib/sesion';
import { enrutador } from './rutas';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <ProveedorSesion>
        <RouterProvider router={enrutador} />
      </ProveedorSesion>
    </QueryClientProvider>
  </StrictMode>,
);
