import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

/**
 * La única familia del sistema de diseño. Se cargan los cinco pesos que usa la
 * escala tipográfica (400 cuerpo, 500 labels, 600 subtítulos, 700 títulos y
 * cifras, 800 display) y ninguno más: cada peso extra es una descarga que
 * retrasa el primer render, y en Colombia buena parte del tráfico llega por
 * datos móviles.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Hatril · Software de gestión para iglesias',
    template: '%s · Hatril',
  },
  description:
    'Miembros, ministerios y comunidad en un solo sitio. Para que el equipo pastoral dedique el tiempo a las personas.',
};

export const viewport: Viewport = {
  // El color de `bg-base`: sin esto, la barra del navegador en móvil se pinta
  // blanca y corta la superficie crema justo por arriba.
  themeColor: '#F0ECE3',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
