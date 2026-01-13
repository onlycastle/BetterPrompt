# Report Page Implementation Checklist

## Phase 1: Types and Hooks ✅ COMPLETED

### Files Created
- [x] `/web-ui/src/types/report.ts` - Complete TypeScript types (12KB)
- [x] `/web-ui/src/hooks/useReport.ts` - React Query hook (1.7KB)
- [x] `/web-ui/src/hooks/index.ts` - Central hook exports (231B)
- [x] `/web-ui/src/types/__tests__/report.test.ts` - Type tests (12KB)

### Files Modified
- [x] `/web-ui/src/types/index.ts` - Added report type exports
- [x] `/web-ui/src/types/personal.ts` - Fixed HistoryEntry conflict

### Validation
- [x] TypeScript compilation successful
- [x] No naming conflicts with existing types
- [x] Types match backend API response structure
- [x] Proper null/optional field handling
- [x] Test file ready for vitest (when added)

## Phase 2: Report Page Components (TODO)

### Core Components
- [ ] `/web-ui/src/pages/ReportPage.tsx`
  - [ ] Use `useReport` hook
  - [ ] Handle loading state
  - [ ] Handle error states (404, 410, network)
  - [ ] Display type result section
  - [ ] Display dimensions section (if unlocked)
  - [ ] Display unlock CTA (if locked)

### Type Result Components
- [ ] `/web-ui/src/components/report/TypeResultHeader.tsx`
  - [ ] Display primary type with emoji
  - [ ] Show type name and tagline
  - [ ] Display percentage match

- [ ] `/web-ui/src/components/report/TypeDescription.tsx`
  - [ ] Show full type description
  - [ ] List strengths with icons
  - [ ] List growth points with icons

- [ ] `/web-ui/src/components/report/TypeDistributionChart.tsx`
  - [ ] Radar/bar chart showing all 5 types
  - [ ] Highlight primary type
  - [ ] Interactive hover states

- [ ] `/web-ui/src/components/report/MetricsDisplay.tsx`
  - [ ] Show session metrics
  - [ ] Format numbers nicely
  - [ ] Tool usage highlights

- [ ] `/web-ui/src/components/report/EvidenceList.tsx`
  - [ ] Display conversation quotes
  - [ ] Show timestamp and type
  - [ ] Explanation for each quote

### Dimension Components
- [ ] `/web-ui/src/components/report/DimensionsOverview.tsx`
  - [ ] Grid of 6 dimension cards
  - [ ] Score visualization for each
  - [ ] Level badges (novice/developing/proficient/expert)

- [ ] `/web-ui/src/components/report/DimensionCard.tsx`
  - [ ] Dimension icon and name
  - [ ] Score circle/bar
  - [ ] Level indicator
  - [ ] Expandable for details

- [ ] `/web-ui/src/components/report/DimensionDetail.tsx`
  - [ ] Full breakdown scores
  - [ ] Strengths list
  - [ ] Growth areas list
  - [ ] Interpretation text

- [ ] `/web-ui/src/components/report/AICollaborationBreakdown.tsx`
  - [ ] Planning score + details
  - [ ] Orchestration score + details
  - [ ] Verification score + details

- [ ] `/web-ui/src/components/report/ContextEngineeringBreakdown.tsx`
  - [ ] Write (preserve) score
  - [ ] Select (retrieve) score
  - [ ] Compress (reduce) score
  - [ ] Isolate (partition) score

- [ ] `/web-ui/src/components/report/BurnoutRiskBreakdown.tsx`
  - [ ] Session intensity indicators
  - [ ] Work-life balance metrics
  - [ ] Stress signal warnings
  - [ ] Recommendations list

### Unlock Flow Components
- [ ] `/web-ui/src/components/report/UnlockSection.tsx`
  - [ ] Blurred dimension preview
  - [ ] "Unlock Full Analysis" CTA
  - [ ] Benefits list
  - [ ] Pricing information

- [ ] `/web-ui/src/components/report/UnlockModal.tsx`
  - [ ] Email capture form
  - [ ] Payment integration (Stripe?)
  - [ ] Success confirmation
  - [ ] Error handling

### Share Components
- [ ] `/web-ui/src/components/report/ShareButtons.tsx`
  - [ ] Twitter share button
  - [ ] LinkedIn share button
  - [ ] Copy link button
  - [ ] Record analytics on share

- [ ] `/web-ui/src/components/report/SharePreview.tsx`
  - [ ] Show how share will look
  - [ ] OG image preview
  - [ ] Edit share text

## Phase 3: Routing and Navigation (TODO)

- [ ] Add route to `/web-ui/src/App.tsx`
  - [ ] `/r/:reportId` route
  - [ ] Proper route params handling

- [ ] Create `/web-ui/src/pages/ReportPage.tsx`
  - [ ] Extract reportId from URL params
  - [ ] Pass to useReport hook

- [ ] Add navigation from other pages
  - [ ] After analysis complete
  - [ ] From history page
  - [ ] From shared links

## Phase 4: Styling (TODO)

- [ ] Create report theme
  - [ ] Cyberpunk aesthetic
  - [ ] Neon colors for each type
  - [ ] Terminal-style components
  - [ ] Smooth animations

- [ ] Responsive design
  - [ ] Mobile layout
  - [ ] Tablet layout
  - [ ] Desktop layout

- [ ] Dark/light mode support
  - [ ] Match existing theme
  - [ ] Proper color contrast

## Phase 5: Testing (TODO)

- [ ] Unit tests
  - [ ] Type tests (already created)
  - [ ] Hook tests (useReport)
  - [ ] Component tests

- [ ] Integration tests
  - [ ] Full report page flow
  - [ ] Share functionality
  - [ ] Unlock flow

- [ ] E2E tests
  - [ ] Visit report URL
  - [ ] Share report
  - [ ] Unlock analysis

## Phase 6: Analytics and Monitoring (TODO)

- [ ] Track page views
  - [ ] Report view count
  - [ ] Time on page
  - [ ] Scroll depth

- [ ] Track interactions
  - [ ] Share button clicks
  - [ ] Unlock CTA clicks
  - [ ] Dimension card expansions

- [ ] Error monitoring
  - [ ] 404 errors
  - [ ] 410 expired errors
  - [ ] Network failures

## Phase 7: SEO and Social (TODO)

- [ ] Meta tags
  - [ ] Dynamic title based on type
  - [ ] OG image URL
  - [ ] OG description
  - [ ] Twitter card

- [ ] Structured data
  - [ ] Schema.org markup
  - [ ] JSON-LD

## Dependencies

### Already Installed
- React 19.2.0
- React Router DOM 7.12.0
- TanStack React Query 5.90.16
- TypeScript 5.9.3

### May Need to Add
- Chart library (for distribution visualization)
  - Recharts?
  - Chart.js?
  - D3?
- Share buttons
  - react-share?
  - Custom implementation?
- Copy to clipboard
  - navigator.clipboard API (native)
- Animation library
  - Framer Motion?
  - React Spring?

## API Integration Notes

The types are fully compatible with:
- `GET /api/reports/:reportId` - Fetch report
- `POST /api/reports/:reportId/share` - Record share
- `GET /api/reports/:reportId/og-image` - OG image (already implemented in backend)

No backend changes needed for basic report display!

## Design References

Look at these for inspiration:
- 16Personalities test results
- GitHub Unwrapped
- Spotify Wrapped
- Linear's changelog page
- Vercel's dashboard

## Success Metrics

When report page is complete, we should see:
- ✅ Users can view their type result
- ✅ Users can see detailed dimension breakdowns (if unlocked)
- ✅ Users can easily share results
- ✅ Page loads in <2s
- ✅ Mobile responsive
- ✅ High share rate (target: >30%)
- ✅ Low bounce rate (target: <40%)
