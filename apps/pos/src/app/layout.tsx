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
  title: 'Nom Nom OS — POS',
  description: 'Offline-first point of sale for Nom Nom OS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // POS uses the light `theme-pos` token set for counter/kitchen legibility.
  return (
    <html
      lang="en"
      className={`theme-pos ${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-fg">{children}</body>
    </html>
  );
}
