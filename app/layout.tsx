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
  metadataBase: new URL('https://www.betterprompt.sh'),
  title: 'BetterPrompt - AI Session Intelligence for Builders',
  description: 'See what is going wrong in your AI workflow. Analyze behavior patterns, risk blind spots, and practical next steps.',
  openGraph: {
    title: 'BetterPrompt - AI Session Intelligence for Builders',
    description: 'See what is going wrong in your AI workflow and how to improve with clear, behavior-based feedback.',
    type: 'website',
    siteName: 'BetterPrompt',
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
