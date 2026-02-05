# AWS Lambda Deployment Guide

This guide covers deploying the heavy analysis API to AWS Lambda using SST.

## Why Lambda?

| Feature | Vercel Pro | AWS Lambda |
|---------|------------|------------|
| Payload Limit | 4.5MB (hard limit) | 10MB |
| Timeout | 5 minutes | 15 minutes |
| Streaming | SSE via Edge | Lambda Response Streaming |

## Prerequisites

1. AWS Account (free tier credits are helpful)
2. Node.js 20+
3. AWS CLI (optional, SST can configure directly)

---

## 1. AWS Account Setup

### 1.1 Create IAM User

1. Log in to [AWS Console](https://console.aws.amazon.com)
2. **IAM** → **Users** → **Create user**
3. User name: `nomoreaislop-deploy`
4. Select **Attach policies directly** and add the following policy:
   - `AdministratorAccess` (for development, use more restrictive permissions in production)

5. **Create user** → **Security credentials** tab
6. **Create access key** → **Command Line Interface (CLI)**
7. Save the Access key and Secret access key (shown only once!)

### 1.2 AWS Credentials Setup

**Option A: Environment Variables**

```bash
# Add to ~/.zshrc or ~/.bashrc
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="ap-northeast-2"
```

```bash
# Apply changes
source ~/.zshrc
```

**Option B: AWS CLI Setup**

```bash
# Install AWS CLI (macOS)
brew install awscli

# Configure credentials
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: ap-northeast-2
# Default output format: json
```

**Option C: AWS Profile (Recommended)**

```bash
# ~/.aws/credentials
[nomoreaislop]
aws_access_key_id = AKIA...
aws_secret_access_key = ...

# ~/.aws/config
[profile nomoreaislop]
region = ap-northeast-2
```

Specify the profile in `.env` file:

```bash
# .env
AWS_PROFILE=nomoreaislop
```

Or specify directly during deployment:

```bash
AWS_PROFILE=nomoreaislop npm run sst:deploy
```

### 1.3 Verify AWS Setup

```bash
# Verify credentials
aws sts get-caller-identity

# Example output:
# {
#   "UserId": "AIDA...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/nomoreaislop-deploy"
# }
```

---

## 2. SST Installation and Deployment

### 2.1 Install Dependencies

```bash
# Install project dependencies
npm install

# Install SST globally (optional, can use npx)
npm install -g sst
```

### 2.2 Environment Variables Setup

Set required environment variables in the `.env` file at project root:

```bash
# .env

# ============================================
# Supabase Configuration
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# ============================================
# AWS / Lambda Configuration
# ============================================

# AWS Profile (credentials in ~/.aws/credentials)
AWS_PROFILE=nomoreaislop

# Lambda URL (enter URL here after deployment)
NOSLOP_LAMBDA_URL=
```

> **Note**: SST reads environment variables from `.env` and injects them into Lambda during deployment.

### 2.3 Deployment

```bash
# Development environment (local testing, live reload on changes)
npm run sst:dev

# Production deployment
npm run sst:deploy

# Remove deployment (cleanup resources)
npm run sst:remove
```

Successful deployment output:
```
✔ Complete
   apiUrl: https://abc123xyz.lambda-url.ap-northeast-2.on.aws
```

---

## 3. Troubleshooting

### AWS Credentials Error

```
Error: Could not load credentials from any providers
```

**Solution**: Verify AWS credentials setup
```bash
aws sts get-caller-identity
```

### Lambda Timeout

```
Task timed out after 15.00 seconds
```

**Solution**: Increase timeout in `infra/api.ts` (max 15 minutes)

### CORS Error

```
Access to fetch has been blocked by CORS policy
```

**Solution**: Check CORS settings in `infra/api.ts`

---

## 4. Cost Information

Lambda costs (ap-northeast-2 region):
- **Requests**: $0.20 / 1 million requests
- **Execution time**: $0.0000166667 / GB-second

Estimated cost (1,000 analyses per month, 30 seconds each):
- Requests: $0.0002
- Execution: 1,000 × 30 seconds × 1GB × $0.0000166667 = ~$0.50
- **Total: Less than $1/month**

AWS Free Tier (12 months):
- 1 million requests per month free
- 400,000 GB-seconds per month free

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Client    │────▶│  AWS Lambda      │────▶│  Supabase   │
│ (Web / CLI) │     │  (SSE Streaming) │     │  (Storage)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Gemini API  │
                    │  (Analysis)  │
                    └──────────────┘
```

## Hybrid Setup

Keep Vercel for web app, use Lambda for heavy analysis:

- **Vercel**: `/`, `/r/[id]`, `/api/*` (web frontend + light API routes)
- **Lambda**: Heavy analysis endpoint (called via `NOSLOP_LAMBDA_URL`)

This gives you the best of both worlds:
- Vercel's CDN and instant deployments for the web app
- Lambda's higher limits and longer timeout for analysis processing
