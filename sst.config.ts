/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST Configuration
 *
 * Deploys heavy analysis API to AWS Lambda with:
 * - 10MB payload limit (vs Vercel's 4.5MB)
 * - 15 minute timeout (vs Vercel's 5 minutes)
 * - Lambda Response Streaming for SSE
 */
export default $config({
  app(input) {
    return {
      name: "nomoreaislop",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "ap-northeast-2", // Seoul region for low latency
        },
      },
    };
  },
  async run() {
    // Import infrastructure
    const { api } = await import("./infra/api");

    return {
      apiUrl: api.url,
    };
  },
});
