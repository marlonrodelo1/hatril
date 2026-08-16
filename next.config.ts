import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * Salida autocontenida para el contenedor de producción.
   *
   * Next copia a `.next/standalone` un `server.js` con SOLO los módulos de
   * `node_modules` que la aplicación usa de verdad. La imagen final pasa de
   * arrastrar el árbol entero de dependencias (~1 GB, con drizzle-kit, eslint,
   * typescript y todo lo de desarrollo dentro) a unos 150 MB.
   *
   * No es solo tamaño: en el VPS, cada despliegue descarga y guarda esa imagen,
   * y las capas viejas se acumulan hasta llenar el disco.
   */
  output: 'standalone',

  // Sin esto, Turbopack busca la raíz del proyecto hacia arriba y encuentra el
  // `package.json` de otra carpeta del escritorio. Fijarla evita el aviso y que
  // resuelva módulos desde el sitio equivocado.
  turbopack: {
    root: __dirname,
  },

  images: {
    remotePatterns: [
      // Logos y fotos de las iglesias, servidos desde Supabase Storage.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
