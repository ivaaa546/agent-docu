import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Docu AI — Asistente de Documentos Markdown',
  description: 'Sube tus archivos Markdown y chatea con Docu AI sobre su contenido en tiempo real con respuestas en streaming.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
