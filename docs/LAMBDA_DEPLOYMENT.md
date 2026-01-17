# AWS Lambda Deployment Guide

This guide covers deploying the heavy analysis API to AWS Lambda using SST.

## Why Lambda?

| Feature | Vercel Pro | AWS Lambda |
|---------|------------|------------|
| Payload Limit | 4.5MB (hard limit) | 10MB |
| Timeout | 5 minutes | 15 minutes |
| Streaming | SSE via Edge | Lambda Response Streaming |

## Prerequisites

1. AWS Account (크레딧 있으면 더 좋음)
2. Node.js 20+
3. AWS CLI (선택사항, SST가 직접 설정도 가능)

---

## 1. AWS 계정 설정

### 1.1 IAM User 생성

1. [AWS Console](https://console.aws.amazon.com) 로그인
2. **IAM** → **Users** → **Create user**
3. User name: `nomoreaislop-deploy`
4. **Attach policies directly** 선택 후 아래 정책 추가:
   - `AdministratorAccess` (개발용, 프로덕션에선 더 제한적인 권한 권장)

5. **Create user** → **Security credentials** 탭
6. **Create access key** → **Command Line Interface (CLI)**
7. Access key와 Secret access key 저장 (한 번만 보임!)

### 1.2 AWS Credentials 설정

**Option A: 환경변수**

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="ap-northeast-2"
```

```bash
# 적용
source ~/.zshrc
```

**Option B: AWS CLI 설정**

```bash
# AWS CLI 설치 (macOS)
brew install awscli

# credentials 설정
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: ap-northeast-2
# Default output format: json
```

**Option C: AWS Profile 사용 (권장)**

```bash
# ~/.aws/credentials
[nomoreaislop]
aws_access_key_id = AKIA...
aws_secret_access_key = ...

# ~/.aws/config
[profile nomoreaislop]
region = ap-northeast-2
```

`.env` 파일에 프로필 지정:

```bash
# .env
AWS_PROFILE=nomoreaislop
```

또는 배포 시 직접 지정:

```bash
AWS_PROFILE=nomoreaislop npm run sst:deploy
```

### 1.3 AWS 설정 확인

```bash
# credentials 확인
aws sts get-caller-identity

# 출력 예시:
# {
#   "UserId": "AIDA...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/nomoreaislop-deploy"
# }
```

---

## 2. SST 설치 및 배포

### 2.1 의존성 설치

```bash
# 프로젝트 의존성 설치
npm install

# SST 글로벌 설치 (선택, npx로도 사용 가능)
npm install -g sst
```

### 2.2 Environment Variables 설정

프로젝트 루트의 `.env` 파일에 필요한 환경변수 설정:

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

# Lambda URL (배포 후 여기에 URL 입력)
NOSLOP_LAMBDA_URL=
```

> **Note**: SST는 배포 시 `.env`에서 환경변수를 읽어 Lambda에 주입합니다.

### 2.3 배포

```bash
# 개발 환경 (로컬 테스트, 변경사항 실시간 반영)
npm run sst:dev

# 프로덕션 배포
npm run sst:deploy

# 배포 삭제 (리소스 정리)
npm run sst:remove
```

배포 성공 시 출력:
```
✔ Complete
   apiUrl: https://abc123xyz.lambda-url.ap-northeast-2.on.aws
```

---

## 3. CLI 설정

### 3.1 Lambda URL 설정

배포 후 출력된 URL을 `.env` 파일에 추가:

```bash
# .env
NOSLOP_LAMBDA_URL=https://abc123xyz.lambda-url.ap-northeast-2.on.aws
```

또는 shell 환경변수로 설정:

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가
export NOSLOP_LAMBDA_URL="https://abc123xyz.lambda-url.ap-northeast-2.on.aws"
```

### 3.2 테스트

```bash
# CLI 실행 - Lambda URL이 설정되어 있으면 자동으로 Lambda 사용
npx no-ai-slop --api-key YOUR_GEMINI_API_KEY
```

---

## 4. 문제 해결

### AWS Credentials 에러

```
Error: Could not load credentials from any providers
```

**해결**: AWS credentials 설정 확인
```bash
aws sts get-caller-identity
```

### Lambda Timeout

```
Task timed out after 15.00 seconds
```

**해결**: `infra/api.ts`에서 timeout 증가 (최대 15분)

### CORS 에러

```
Access to fetch has been blocked by CORS policy
```

**해결**: `infra/api.ts`의 CORS 설정 확인

---

## 5. 비용 정보

Lambda 비용 (ap-northeast-2 기준):
- **요청**: $0.20 / 1백만 요청
- **실행 시간**: $0.0000166667 / GB-초

예상 비용 (월 1,000회 분석, 각 30초):
- 요청: $0.0002
- 실행: 1,000 × 30초 × 1GB × $0.0000166667 = ~$0.50
- **총: 월 $1 미만**

AWS Free Tier (12개월):
- 월 1백만 요청 무료
- 월 40만 GB-초 무료

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   CLI       │────▶│  AWS Lambda      │────▶│  Supabase   │
│  (no-ai-slop)    │  (SSE Streaming) │     │  (Storage)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Gemini API  │
                    │  (Analysis)  │
                    └──────────────┘
```

## Hybrid Setup

Keep Vercel for web app, use Lambda only for heavy analysis:

- **Vercel**: `/`, `/r/[id]`, `/api/*` (except analysis)
- **Lambda**: Analysis endpoint (via `NOSLOP_LAMBDA_URL`)

This gives you the best of both worlds:
- Vercel's CDN and instant deployments for the web app
- Lambda's higher limits and longer timeout for analysis
