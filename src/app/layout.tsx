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
  /**
   * Sin esto, Next avisa por consola en cada build de que no puede resolver las
   * URL relativas de OpenGraph, y la etiqueta que comparte la web de una iglesia
   * sin foto propia sale rota.
   *
   * Ojo: `NEXT_PUBLIC_SITE_URL` se incrusta al COMPILAR, así que en Dokploy
   * tiene que estar además en «Build-time Arguments». Si falta, el respaldo es
   * localhost y las tarjetas de WhatsApp apuntan a ninguna parte.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
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
