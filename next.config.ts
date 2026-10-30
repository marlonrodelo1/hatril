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

  /*
   * Hasta 21 MB por server action: las cuatro fotos de una publicación del
   * muro, de 5 MB cada una como mucho (`comunidad/limites.ts`), más el texto.
   *
   * El defecto de Next es 1 MB, y nadie lo había subido: una foto normal de
   * móvil (2-5 MB) fallaba al publicarla con «Body exceeded 1 MB limit» antes de
   * llegar a la action, sin mensaje en castellano. Se vio el 30-oct al hacer la
   * foto de perfil, que pasa por el mismo camino. Los límites de verdad, por
   * foto y por tipo, siguen en el código que las recibe.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '21mb',
    },
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
          /*
           * La ubicación, solo para la propia web (`self`): la piden «iglesias
           * cerca de mí» y el botón de Ajustes que pone el pin de la iglesia.
           * Con `geolocation=()` el navegador la negaba siempre, sin preguntar.
           * Cámara y micrófono siguen cerrados: la foto se elige con el
           * selector de ficheros, que no los necesita.
           */
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
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
