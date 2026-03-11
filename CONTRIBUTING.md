# Contributing

## Development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set your own API keys and optional self-hosted service URLs.
4. Run `npm run dev`.

## Guardrails

- Do not commit `.env` files, generated caches, or session transcripts.
- Do not add hardcoded production URLs, webhook endpoints, or API keys.
- Prefer local-first behavior and make hosted integrations opt-in.

## Verification

Run the checks relevant to your change before opening a PR:

```bash
npm run typecheck
npm run test
```
