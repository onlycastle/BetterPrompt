import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { Providers } from '@/components/providers';
import '@/styles/global.css';
import '@/styles/variables.css';
import '@/styles/terminal-theme.css';
import '@/styles/terminal-variables.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'NoMoreAISlop - AI Coding Style Analysis',
  description: 'Analyze your AI-assisted coding style and discover your unique collaboration patterns',
  openGraph: {
    title: 'NoMoreAISlop - AI Coding Style Analysis',
    description: 'Discover your AI collaboration style',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
