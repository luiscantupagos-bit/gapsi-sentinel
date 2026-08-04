import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GAPSI Sentinel',
  description: 'Diagnóstico Digital de calidad e inocuidad alimentaria.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
