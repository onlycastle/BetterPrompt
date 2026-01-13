# NoMoreAISlop - Product Requirements

> Version: 3.0.0 | Business Model: Closed-Source SaaS (Greptile Model)

## Vision

**B2B service assessing developers' AI utilization capabilities** with B2C viral acquisition.

## GTM Funnel

```
FREE (CLI analysis) → PRO (detailed reports) → PREMIUM (tracking) → ENTERPRISE (teams)
```

## Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **FREE** | $0 | 3 analyses/month, basic CLI/web report |
| **PRO** | One-time | Unlimited analyses, detailed recommendations, growth plan |
| **PREMIUM** | Monthly | Tracking dashboard, knowledge base access |
| **ENTERPRISE** | Per-seat | Team management, customized knowledge base |

## The 5 AI Coding Styles

| Type | Tagline | Key Trait |
|------|---------|-----------|
| 🏗️ Architect | Strategic planner | Plans before coding |
| 🔬 Scientist | Truth-seeker | Verifies AI output |
| 🤝 Collaborator | Pair programmer | Iterates through dialogue |
| ⚡ Speedrunner | Agile executor | Fast iteration |
| 🔧 Craftsman | Quality artisan | Code quality focus |

## Analysis Dimensions

| Dimension | Range | Purpose |
|-----------|-------|---------|
| AI Collaboration Mastery | 0-100 | Context provision quality |
| Prompt Engineering | 0-100 | Prompt clarity |
| Burnout Risk | 0-100 | Work pattern health |
| Tool Mastery | 0-100 | Tool usage effectiveness |
| AI Control Index | 0-100 | Strategic control vs vibing |
| Skill Resilience | 0-100 | Independent coding ability |

## Feature Access by Tier

| Feature | FREE | PRO | PREMIUM | ENTERPRISE |
|---------|------|-----|---------|------------|
| Basic analysis | ✓ | ✓ | ✓ | ✓ |
| AI-powered evaluation | Limited | ✓ | ✓ | ✓ |
| Detailed recommendations | ✗ | ✓ | ✓ | ✓ |
| Tracking dashboard | ✗ | ✗ | ✓ | ✓ |
| Knowledge base | ✗ | ✗ | ✓ | ✓ + custom |
| Team management | ✗ | ✗ | ✗ | ✓ |

## Web UI Routes

```
/                    → Reports (landing)
/reports             → Analysis list
/reports/:id         → Report detail
/tracking            → Progress dashboard (PREMIUM)
/knowledge           → Knowledge base (PREMIUM)
```

## Technical Stack

| Component | Technology |
|-----------|------------|
| CLI | TypeScript + Node.js |
| API | Express.js |
| Web UI | React + Vite |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Payments | Polar.sh |

## Success Metrics

| Metric | Target |
|--------|--------|
| Plugin Installs | 10,000+ (Month 3) |
| Unlock Rate | 10%+ |
| PRO Subscribers | 200+ |

## Payment (Polar.sh)

- Automated license keys
- Merchant of record (handles taxes)
- 4% + 40¢ per transaction
