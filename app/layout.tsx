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
  title: 'NoMoreAISlop - See Your Anti-Patterns. Stop Making AI Slop.',
  description: 'See your AI anti-patterns. Stop making slop. Get a brutally honest analysis of your coding sessions.',
  openGraph: {
    title: 'NoMoreAISlop - See Your Anti-Patterns. Stop Making AI Slop.',
    description: 'See your anti-patterns. Stop making AI slop.',
    type: 'website',
    siteName: 'NoMoreAISlop',
  },
  twitter: {
    card: 'summary_large_image',
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
