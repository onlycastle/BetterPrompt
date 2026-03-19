import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable server external packages for LLM SDKs
  serverExternalPackages: ['@anthropic-ai/sdk'],

  // Experimental features
  experimental: {
    // Enable 50MB body size for server actions (web-based uploads)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Image optimization
  images: {
    remotePatterns: [],
  },

  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
