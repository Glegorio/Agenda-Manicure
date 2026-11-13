import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { siteUrl } from '../lib/env';
import { SwRegister } from './_components/SwRegister';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'Agende',
  description: 'Agende seu horário em poucos toques.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
