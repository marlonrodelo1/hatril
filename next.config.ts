import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
