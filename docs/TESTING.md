# Dashboard E2E Testing Guide

This guide explains how to perform end-to-end testing of the NoMoreAISlop dashboard, including account creation, analysis, payment, and report unlocking flows.

## Prerequisites

### 1. Supabase Email Authentication Setup

Before testing, ensure email authentication is enabled in Supabase:

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable the **Email** provider
3. **Important**: Disable "Confirm email" for testing convenience
4. Password minimum: 6 characters

### 2. Install Test Sessions

Run the setup script to copy test session files to `~/.claude/projects/`:

```bash
./scripts/setup-test-sessions.sh
```

This creates realistic Claude Code session data that the CLI can analyze.

### 3. Environment Variables

Ensure all required environment variables are set:

```bash
# Required for authentication
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Required for payments
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET

# Required for analysis
GOOGLE_GEMINI_API_KEY
```

## E2E Test Flows

### Flow A: New User Full Experience (Signup → Analyze → Pay → Unlock)

This is the primary happy path for new users.

#### Step 1: Start Development Server

```bash
npm run dev
```

#### Step 2: Create Test Account

1. Visit http://localhost:3000/dashboard/analyze
2. Find the **DEV ONLY** section (yellow dashed border)
3. Enter test credentials:
   - Email: `test@example.com`
   - Password: `test1234`
4. Click **Sign Up**

#### Step 3: Run Analysis

```bash
npx no-ai-slop
```

1. The CLI will open a browser for device authorization
2. If not logged in, use the test login form (DEV ONLY section)
3. Enter the device code from the terminal
4. Wait for analysis to complete

#### Step 4: View Preview Report

1. Visit http://localhost:3000/dashboard/personal
2. Click on the generated report
3. Verify you see the **Preview** badge
4. Scroll down to see locked content

#### Step 5: Payment Flow

1. Click **Unlock Full Report** ($4.99)
2. On Polar checkout page, enter coupon: `PO100LAR`
3. Complete checkout (coupon gives 100% discount)
4. You'll be redirected back with `?payment=success`

#### Step 6: Verify Unlock

1. Report should now show **Full** badge
2. All content should be visible
3. Success toast should appear

### Flow B: Credit Usage (Returning User)

Test the credit-based unlock flow.

#### Prerequisites
- User must have credits (purchased or signup bonus)
- User must have at least one unlocked report

#### Steps

1. Log in with existing test account
2. Run `npx no-ai-slop` for a new analysis
3. View the new report (should show Preview)
4. Click **Use 1 Credit to Unlock**
5. Verify instant unlock (no payment redirect)

### Flow C: Multi-Report Management

Test report listing and deletion.

#### Steps

1. Log in with test account
2. Run multiple analyses: `npx no-ai-slop` (2-3 times)
3. Visit /dashboard/personal
4. Verify all reports appear in the **Report** tab
5. Click the trash icon on one report
6. Confirm deletion
7. Verify report is removed from list
8. Check **Progress** tab for aggregated data

### Flow D: Device Authorization (CLI ↔ Web)

Test the OAuth device flow.

#### Steps

1. Start with logged-out state
2. Run `npx no-ai-slop`
3. Note the device code (e.g., `ABCD-1234`)
4. Visit the authorization URL shown in terminal
5. Log in using test credentials
6. Enter the device code
7. Click **Authorize Device**
8. Verify CLI continues automatically

## Test Data

### Test Session Files

Located in `test-data/claude-sessions/-Users-test-projects-demo/`:

| File | Description |
|------|-------------|
| `conversation_001.jsonl` | Basic React component creation |
| `conversation_002.jsonl` | Test debugging session |
| `conversation_003.jsonl` | Express API setup with TypeScript |

### Test Credentials

| Field | Value | Notes |
|-------|-------|-------|
| Email | `test@example.com` | Any valid email works |
| Password | `test1234` | Minimum 6 characters |
| Coupon | `PO100LAR` | 100% discount on Polar |

## Database Verification

Use Supabase Dashboard or SQL to verify test data:

### Check User Creation

```sql
-- View test user
SELECT * FROM auth.users WHERE email = 'test@example.com';

-- View user profile with credits
SELECT * FROM public.users WHERE id = '<user-id>';
```

### Check Analysis Results

```sql
-- View user's analyses
SELECT id, result_id, is_paid, claimed_at
FROM analysis_results
WHERE user_id = '<user-id>'
ORDER BY claimed_at DESC;
```

### Check Payments

```sql
-- View payment records
SELECT * FROM payments WHERE user_id = '<user-id>';

-- View credit transactions
SELECT * FROM credit_transactions WHERE user_id = '<user-id>';
```

## Verification Checklist

### Account Creation
- [ ] Test account created successfully
- [ ] User appears in `auth.users` table
- [ ] Profile created in `public.users` table
- [ ] Initial credits granted (usually 1)

### Analysis Flow
- [ ] CLI runs without errors
- [ ] Device authorization completes
- [ ] Analysis saved to `analysis_results` table
- [ ] Report visible in dashboard
- [ ] Preview badge shown (is_paid: false)

### Payment Flow
- [ ] Checkout redirects to Polar
- [ ] Coupon `PO100LAR` works
- [ ] Webhook received and processed
- [ ] Report unlocked (is_paid: true)
- [ ] Credits added if applicable
- [ ] Transaction recorded in `credit_transactions`

### Credit Usage
- [ ] Credit balance shown correctly
- [ ] "Use 1 Credit" button works
- [ ] Credit deducted after use
- [ ] Report unlocked instantly
- [ ] Transaction recorded

## Security Considerations

The test login form is **only available in development**:

```tsx
// Only renders when NODE_ENV !== 'production'
if (process.env.NODE_ENV === 'production') {
  return null;
}
```

Similarly, the coupon hint only appears in development:

```tsx
{process.env.NODE_ENV !== 'production' && (
  <p className={styles.testHint}>Test coupon: PO100LAR</p>
)}
```

These safeguards ensure test features never appear in production.

## Troubleshooting

### "Authentication not configured" Error

Check that Supabase environment variables are set:
```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Device Code Not Working

1. Ensure you're logged in on the web
2. Check the code hasn't expired (5 minutes TTL)
3. Verify the code format (e.g., `ABCD-1234`)

### Analysis Not Appearing

1. Check CLI output for errors
2. Verify session files exist: `ls ~/.claude/projects/`
3. Check Supabase logs for API errors

### Payment Not Completing

1. Verify Polar webhook URL is correct
2. Check Polar dashboard for failed webhooks
3. Verify `POLAR_WEBHOOK_SECRET` matches
