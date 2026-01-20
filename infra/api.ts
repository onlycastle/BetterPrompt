/**
 * API Infrastructure
 *
 * Configures Lambda function with:
 * - Response streaming for SSE
 * - S3 bucket for large payload uploads
 * - 15 minute timeout
 */

// S3 bucket for session uploads (large payloads bypass Lambda payload limits)
export const uploadBucket = new sst.aws.Bucket("UploadBucket", {
  // Auto-delete uploaded files after 1 day (they're processed immediately)
  transform: {
    bucket: {
      lifecycleRules: [
        {
          enabled: true,
          expiration: { days: 1 },
          id: "auto-cleanup",
        },
      ],
    },
  },
});

// Create the analysis Lambda function with streaming and URL
export const api = new sst.aws.Function("AnalysisFunction", {
  handler: "lambda/analysis.handler",
  runtime: "nodejs20.x",
  timeout: "15 minutes",
  memory: "1024 MB",
  streaming: true, // Enable Lambda Response Streaming for SSE
  // Link S3 bucket for large payload uploads
  link: [uploadBucket],
  environment: {
    // These will be set via SST secrets or environment
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY || "",
    // S3 bucket name injected by SST link
    UPLOAD_BUCKET_NAME: uploadBucket.name,
  },
  nodejs: {
    // Bundle shared lib code
    install: [
      "@google/genai",
      "@supabase/supabase-js",
      "zod",
      "zod-to-json-schema",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
    ],
  },
  // Enable Function URL for direct invocation (no API Gateway)
  url: {
    authorization: "none", // Public access (no IAM auth required)
    cors: {
      allowOrigins: ["*"],
      allowMethods: ["*"],
      allowHeaders: ["*"],
    },
  },
});
