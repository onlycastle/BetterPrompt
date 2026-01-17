/**
 * API Infrastructure
 *
 * Configures Lambda function with:
 * - Response streaming for SSE
 * - 10MB payload support
 * - 15 minute timeout
 */

// Create the analysis Lambda function with streaming and URL
export const api = new sst.aws.Function("AnalysisFunction", {
  handler: "lambda/analysis.handler",
  runtime: "nodejs20.x",
  timeout: "15 minutes",
  memory: "1024 MB",
  streaming: true, // Enable Lambda Response Streaming for SSE
  environment: {
    // These will be set via SST secrets or environment
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  nodejs: {
    // Bundle shared lib code
    install: ["@google/genai", "@supabase/supabase-js", "zod", "zod-to-json-schema"],
  },
  // Enable Function URL for direct invocation (no API Gateway)
  url: {
    cors: {
      allowOrigins: ["*"],
      allowMethods: ["*"],
      allowHeaders: ["*"],
    },
  },
});
