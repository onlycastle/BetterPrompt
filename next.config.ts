import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable server external packages for LLM SDKs
  serverExternalPackages: ['@anthropic-ai/sdk', '@google/genai'],

  // Experimental features
  experimental: {
    // Enable 50MB body size for session uploads
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Middleware body size limit for large API requests (default: 10MB)
    // https://nextjs.org/docs/app/api-reference/config/next-config-js/middlewareClientMaxBodySize
    middlewareClientMaxBodySize: '50mb',
  },

  // Image optimization
  images: {
    remotePatterns: [],
  },

  // TypeScript strict mode
  typescript: {
    // Allow build to succeed even with type errors during migration
    ignoreBuildErrors: false,
  },

  // ESLint during build
  eslint: {
    // Allow build to succeed even with lint errors during migration
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
