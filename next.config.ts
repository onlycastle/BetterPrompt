import type { NextConfig } from 'next';

const isStaticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(isStaticExport && { output: 'export' }),

  ...(!isStaticExport && { serverExternalPackages: ['@anthropic-ai/sdk'] }),

  ...(!isStaticExport && {
    experimental: {
      serverActions: {
        bodySizeLimit: '50mb',
      },
    },
  }),

  images: {
    ...(isStaticExport ? { unoptimized: true } : { remotePatterns: [] }),
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
