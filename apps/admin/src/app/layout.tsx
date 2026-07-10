import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

const instrument = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Nom Nom OS — Admin',
  description: 'Owner/manager portal for Nom Nom OS: menu, tables, expenses, reports, licensing.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Admin carries the SPOTO dark identity (default :root tokens).
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-fg">{children}</body>
    </html>
  );
}
