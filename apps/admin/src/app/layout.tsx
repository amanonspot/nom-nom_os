import type { Metadata } from 'next';
import { Montserrat, Open_Sans } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const openSans = Open_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Nom Nom OS — Admin',
  description: 'Owner/manager portal for Nom Nom OS: menu, tables, expenses, reports, licensing.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${openSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-spoto-bg text-spoto-ink">{children}</body>
    </html>
  );
}
