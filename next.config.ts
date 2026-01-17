import type { NextConfig } from 'next';

// Lambda URL for heavy analysis API (bypasses Vercel's 4.5MB limit)
const LAMBDA_API_URL = process.env.LAMBDA_API_URL || 'https://kgdby5xqjypfnlihknmcllqwgq0labzp.lambda-url.ap-northeast-2.on.aws';

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

  // Rewrite /api/lambda/* to Lambda Function URL
  // This bypasses Vercel's 4.5MB payload limit and 5-minute timeout
  async rewrites() {
    return [
      {
        source: '/api/lambda/:path*',
        destination: `${LAMBDA_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
