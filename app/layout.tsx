import type { Metadata } from 'next';
import { Fira_Code, Noto_Sans_KR } from 'next/font/google';
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
  metadataBase: new URL(process.env.NOSLOP_BASE_URL || 'http://localhost:3000'),
  title: 'NoMoreAISlop - Self-Hosted AI Session Intelligence',
  description: 'Analyze Claude Code and Cursor sessions on your own server with local auth, SQLite storage, and Gemini-powered workers.',
  openGraph: {
    title: 'NoMoreAISlop - Self-Hosted AI Session Intelligence',
    description: 'Analyze Claude Code and Cursor sessions on your own server with local auth, SQLite storage, and Gemini-powered workers.',
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
      </body>
    </html>
  );
}
