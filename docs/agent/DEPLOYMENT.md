# Deployment (Agent Reference)

## Lambda vs Vercel

| Feature | Vercel Pro | AWS Lambda (SST) |
|---------|------------|-------------------|
| Payload limit | 4.5MB (hard) | 6MB (bypassed via S3 presigned URL) |
| Timeout | 5 minutes | 15 minutes |
| Streaming | SSE via Edge | Lambda Response Streaming |
| Deploy | Push to `main` | GitHub Actions (changes in `lambda/`, `infra/`, `sst.config.ts`) |

## Hybrid Setup

- **Vercel**: Web frontend + light API routes (`/`, `/r/[id]`, `/api/*`)
- **Lambda**: Heavy analysis endpoint (called via `NOSLOP_LAMBDA_URL`)

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + Lambda | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + Lambda | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + Lambda | Supabase service role key |
| `GOOGLE_GEMINI_API_KEY` | Lambda | Gemini 3 Flash API key |
| `AWS_PROFILE` | Local only | AWS credentials profile |
| `NOSLOP_LAMBDA_URL` | Vercel | Lambda endpoint URL (set after deployment) |

## Deploy Commands

```bash
npm run sst:dev       # Development (live reload)
npm run sst:deploy    # Production deployment
npm run sst:remove    # Remove deployment (cleanup)
```

> WARNING: NEVER use local SST deployment (`npx sst deploy`). Local SST has critical bugs causing routing failures. Always use GitHub Actions for Lambda deployment.

## Troubleshooting

| Error | Solution |
|-------|---------|
| `Could not load credentials from any providers` | Run `aws sts get-caller-identity` to verify credentials |
| `Task timed out after 15.00 seconds` | Increase timeout in `infra/api.ts` (max 15 minutes) |
| `Access blocked by CORS policy` | Check CORS settings in `infra/api.ts` |

## Cost Estimate (ap-northeast-2)

- Requests: $0.20 / 1M requests
- Execution: $0.0000166667 / GB-second
- ~1,000 analyses/month at 30s each: **less than $1/month**
- AWS Free Tier: 1M requests + 400K GB-seconds/month free (12 months)

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `deploy-lambda.yml` | Push to `main` (changes in `lambda/`, `infra/`, `sst.config.ts`) | Auto-deploy Lambda via SST |
| `build-desktop.yml` | Manual / push | Desktop app build |
| `publish-cli.yml` | Manual / push | CLI package publish to npm |

## Key Files

| File | Purpose |
|------|---------|
| `lambda/analysis.ts` | Lambda handler for analysis endpoint |
| `infra/api.ts` | SST API infrastructure config |
| `sst.config.ts` | SST project configuration |
| `.github/workflows/deploy-lambda.yml` | Lambda CI/CD pipeline |
| `.github/workflows/build-desktop.yml` | Desktop build pipeline |
| `.github/workflows/publish-cli.yml` | CLI publish pipeline |
