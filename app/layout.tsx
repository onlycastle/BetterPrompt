import type { Metadata } from 'next';
import { Fira_Code, Noto_Sans_KR } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { Providers } from '@/components/providers';
import '@/styles/global.css';
import '@/styles/variables.css';
import '@/styles/terminal-theme.css';
import '@/styles/terminal-variables.css';

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira',
  weight: ['300', '400', '500', '600', '700'],
});

const notoSansKR = Noto_Sans_KR({
  preload: false,
  variable: '--font-noto-kr',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.nomoreaislop.app'),
  title: 'NoMoreAISlop - AI Coding Style Analysis',
  description: 'Analyze your AI-assisted coding style and discover your unique collaboration patterns',
  openGraph: {
    title: 'NoMoreAISlop - AI Coding Style Analysis',
    description: 'Discover your AI collaboration style',
    type: 'website',
    siteName: 'NoMoreAISlop',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'NoMoreAISlop - AI Coding Style Analysis',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${firaCode.variable} ${notoSansKR.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
