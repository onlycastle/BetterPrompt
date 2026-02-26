# Hero Section Redesign: BetterPrompt Rebrand

## Date: 2026-02-26

## Summary

Redesign the HeroSection to convey empathetic, friend-like positioning with an interactive demo card that auto-cycles through 3 bottleneck analysis scenarios.

## Design Decisions

- **Tone**: Empathetic ("Been stuck? Yeah, we've all been there.")
- **Visual**: Interactive demo card showing real-time analysis simulation
- **Animation**: Auto-sequence looping 3 scenarios (5s each)
- **Layout**: Stacked (mobile-first, vertical flow)

## Copy

```
Badge:     "BetterPrompt"
Headline:  "Fixed one thing, broke another."
Sub:       "BetterPrompt reads your AI coding sessions, finds where
            things went sideways, and gives you the exact question
            to ask next."
CTA:       "Get Unstuck — Free"
Scroll:    "See how it works"
```

## Demo Card — 3-Phase Auto-Sequence

Each scenario plays for 5 seconds (1.5s scanning + 1.5s detection + 2s suggestion), then crossfades to next.

| # | Name | Label (color) | Context | Suggested Prompt |
|---|------|---------------|---------|-----------------|
| 1 | The Loop | BOTTLENECK DETECTED (red) | .env loop, 47min, 12 messages | "Check prisma version mismatch" |
| 2 | The Circle | CIRCULAR PATTERN (yellow) | Auth asked 3 ways, 3 sessions | "Commit to ONE auth approach" |
| 3 | The Blind Spot | MISSING CONTEXT (orange) | Broken data model | "Read schema.prisma first" |

## Component Architecture

```
HeroSection.tsx (updated)
├── Badge, Headline, Subheadline (static, copy changes)
├── HeroDemoCard.tsx (NEW)
│   ├── useState: scenarioIndex (0/1/2), phase (scanning/detection/suggestion)
│   ├── useEffect: 5s interval cycling scenarios
│   ├── Phase timer: 1.5s → 1.5s → 2s
│   └── CSS transitions for crossfade
├── CTA Button
└── ScrollCue
```

## Files

| File | Action |
|------|--------|
| `src/components/landing/HeroSection.tsx` | Update copy + add HeroDemoCard |
| `src/components/landing/HeroSection.module.css` | Add demo card layout styles |
| `src/components/landing/HeroDemoCard.tsx` | NEW interactive demo component |
| `src/components/landing/HeroDemoCard.module.css` | NEW demo card styles |
