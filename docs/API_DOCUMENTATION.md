# NoMoreAISlop - API Documentation

> Version: 3.0.0 | Base URL: `http://localhost:3001/api`

## Authentication

**Supabase Auth** - Bearer token required for protected routes.

```typescript
// Middleware
requireAuth(req, res, next)     // Validates JWT
requireTier(minTier)            // Checks user tier
```

## Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server status |
| POST | `/api/reports/share` | Create shareable report |
| GET | `/api/reports/:id` | Get shared report |
| GET | `/api/reports/:id/og-image` | OG image for sharing |

### Authenticated (All Tiers)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analyses` | List user's analyses |
| GET | `/api/analyses/:id` | Get single analysis |
| POST | `/api/analyses` | Save new analysis |

### PREMIUM Tier

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tracking/daily` | Daily metrics (30 days) |
| GET | `/api/tracking/weekly` | Weekly metrics (12 weeks) |
| GET | `/api/knowledge` | List knowledge items |
| GET | `/api/knowledge/:id` | Get knowledge item |
| GET | `/api/knowledge/metrics` | Quality metrics |

### Admin Only

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/learn/youtube` | Learn from YouTube |
| POST | `/api/learn/url` | Learn from URL |
| POST | `/api/influencers` | Add influencer |
| DELETE | `/api/influencers/:id` | Remove influencer |

## Request/Response Examples

### Create Shared Report
```bash
POST /api/reports/share
{
  "typeResult": { "primaryType": "architect", "distribution": {...} },
  "dimensions": {...}
}

# Response
{
  "reportId": "abc123",
  "shareUrl": "https://nomoreaislop.xyz/r/abc123",
  "accessToken": "...",
  "expiresAt": "2026-02-12T00:00:00Z"
}
```

### Get Tracking Metrics
```bash
GET /api/tracking/daily
Authorization: Bearer <token>

# Response
{
  "metrics": [
    { "date": "2026-01-12", "sessionsAnalyzed": 3, "averageScore": 72.5 }
  ]
}
```

## Error Responses

| Code | Meaning |
|------|---------|
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Tier upgrade required |
| 404 | Not found |
| 500 | Server error |

```json
{ "error": "Upgrade required", "message": "PREMIUM tier needed" }
```

## Rate Limits

| Tier | Analyses/Month | API Calls/Hour |
|------|----------------|----------------|
| FREE | 3 | 100 |
| PRO | Unlimited | 1000 |
| PREMIUM | Unlimited | 5000 |
