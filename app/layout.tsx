import type { Metadata } from 'next';
import { Fira_Code, Noto_Sans_KR, Instrument_Serif } from 'next/font/google';
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

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  weight: ['400'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTERPROMPT_BASE_URL || 'https://betterprompt.sh'),
  title: 'BetterPrompt - Self-Hosted AI Session Intelligence',
  description: 'Analyze Claude Code and Cursor sessions locally inside Claude Code, then optionally sync results to your BetterPrompt dashboard.',
  openGraph: {
    title: 'BetterPrompt - Self-Hosted AI Session Intelligence',
    description: 'Analyze Claude Code and Cursor sessions locally inside Claude Code, then optionally sync results to your BetterPrompt dashboard.',
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
    <html lang="en" className={`${firaCode.variable} ${notoSansKR.variable} ${instrumentSerif.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
