# Troubleshooting Guide

Complete troubleshooting guide for NoMoreAISlop. Find solutions for common issues, debug techniques, and when to seek help.

## Quick Fixes Table

| Problem | Symptom | Solution |
|---------|---------|----------|
| No sessions found | "No Claude Code sessions found" | Ensure `~/.claude/projects/` exists and has session files |
| API key missing | "API key required" error | Set `ANTHROPIC_API_KEY` in `.env` file |
| API key invalid | 401 authentication error | Verify API key format and permissions at console.anthropic.com |
| Port in use | "Port X already in use" | The system will find next available port (usually automatic) |
| Browser not opening | Report not displaying | Manually open `http://localhost:3000` in your browser |
| Supabase connection failed | "SUPABASE_URL not set" | Add `SUPABASE_URL` to `.env` (optional, use local-only mode without it) |
| Insufficient tokens | 429 or context length error | Session too large; split analysis or reduce session count |
| Zero-message sessions | Analysis skipped | Sessions must have at least 2 messages to analyze |
| Empty session list | `test-local.ts sessions` returns nothing | Check `~/.claude/projects/` directory exists and readable |

---

## Session Discovery Issues

### Problem: "No Claude Code sessions found"

**Causes:**
1. Claude Code projects directory doesn't exist
2. Directory exists but is empty
3. Session files have wrong format or extension
4. Directory permissions issue

**Solutions:**

1. **Verify the directory exists:**
   ```bash
   ls -la ~/.claude/projects/
   ```

   If directory doesn't exist, Claude Code hasn't created it yet. This typically happens when:
   - Claude Code hasn't been used yet
   - Using a different installation (different IDE)
   - Working on a project outside Claude Code

   **Fix:** Open a project in Claude Code and create at least one session first.

2. **Check for session files:**
   ```bash
   find ~/.claude/projects/ -name "*.jsonl" | head -10
   ```

   Should display JSONL files. If empty:
   - You need to use Claude Code for analysis first
   - Create a new session by asking Claude Code to help with code

3. **Verify directory permissions:**
   ```bash
   test -r ~/.claude/projects/ && echo "readable" || echo "not readable"
   ```

   If not readable, fix permissions:
   ```bash
   chmod 755 ~/.claude/projects/
   chmod 644 ~/.claude/projects/*.jsonl
   ```

4. **Check directory path encoding:**

   Claude Code encodes project paths by replacing `/` with `-`. For example:
   ```
   /Users/dev/projects/myapp
      ↓ encoded as ↓
   -Users-dev-projects-myapp/
   ```

   The parser automatically handles this. If sessions still aren't found, verify:
   ```bash
   ls -la ~/.claude/projects/ | grep "^d" | head -5
   ```

   You should see directories like `-Users-...` or similar encoded paths.

### Problem: Sessions found but analysis skipped

**Causes:**
1. Session has too few messages (minimum 2 required)
2. Session created more than 90 days ago (outside recency window)
3. Session duration less than 5 minutes
4. Empty or malformed JSONL file

**Solutions:**

1. **Check session criteria manually:**
   ```bash
   npx tsx scripts/test-local.ts sessions --verbose
   ```

   This shows detailed information about each session including:
   - Duration
   - Message count
   - Creation date
   - Path

   Sessions must meet ALL criteria:
   - Duration >= 5 minutes
   - Message count >= 2
   - Created within last 90 days

2. **Understand session age filtering:**

   The 90-day window is for data freshness. To analyze older sessions:
   - They're still available via `test-local.ts analyze <session-id>`
   - But not automatically selected for quick analysis
   - Use explicit session ID to override filtering

3. **Check individual session file:**
   ```bash
   head -20 ~/.claude/projects/[encoded-path]/[session-id].jsonl | jq .
   ```

   Each line should be valid JSON. If malformed:
   - File may be corrupted
   - Try analyzing a different session
   - Check Claude Code logs for write errors

### Problem: Different results from different runs

**Causes:**
1. Analyzing different sessions (session list changes as new ones created)
2. LLM response variation between runs
3. Cache invalidation between runs
4. Session recency window moved

**Solutions:**

1. **Use explicit session ID for reproducibility:**
   ```bash
   npx tsx scripts/test-local.ts analyze <session-id> --verbose
   ```

   Replace `<session-id>` with specific session from:
   ```bash
   npx tsx scripts/test-local.ts sessions
   ```

2. **Clear cache if present:**
   ```bash
   rm -rf ~/.nomoreaislop/
   ```

   This removes cached analyses. Next run will re-analyze.

---

## API Connection Problems

### Problem: "ANTHROPIC_API_KEY not set" or "API key required"

**Causes:**
1. Environment variable not set
2. `.env` file not created or not loaded
3. API key value is empty or whitespace

**Solutions:**

1. **Create `.env` file from template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your API key:**
   ```bash
   nano .env
   ```

   Set this line (no spaces around `=`):
   ```env
   ANTHROPIC_API_KEY=sk-ant-v1-xxxxxxxxxxxxx
   ```

   Get your API key from: https://console.anthropic.com/account/keys

3. **Verify `.env` is being loaded:**
   ```bash
   cat .env | grep ANTHROPIC_API_KEY
   ```

   Should show your key (or at minimum, the line present).

   Alternatively, set as environment variable:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-v1-xxxxxxxxxxxxx"
   npx tsx scripts/analyze-style.ts
   ```

4. **For different environments:**

   Development/testing:
   ```bash
   # .env file approach (recommended for local)
   ANTHROPIC_API_KEY=sk-ant-v1-xxxxxxxxxxxxx
   ```

   Production (server):
   ```bash
   # Use environment variables (secrets management)
   export ANTHROPIC_API_KEY="sk-ant-v1-xxxxxxxxxxxxx"
   npm run api
   ```

### Problem: "Invalid API key" or 401 authentication error

**Causes:**
1. API key format incorrect (doesn't start with `sk-ant-`)
2. API key revoked or expired
3. API key missing characters (truncated paste)
4. Using test/preview API key instead of live key

**Solutions:**

1. **Verify API key format:**
   ```bash
   grep ANTHROPIC_API_KEY .env | cut -d= -f2
   ```

   Should start with `sk-ant-` and be ~100+ characters long.

   Common mistakes:
   - Missing prefix: `v1-xxxxx` should be `sk-ant-v1-xxxxx`
   - Extra whitespace: `ANTHROPIC_API_KEY= sk-ant...` (space before key)
   - Incomplete paste: key got cut off

2. **Generate new API key:**
   - Go to https://console.anthropic.com/account/keys
   - Delete old key if revoked
   - Click "Create Key" and use the new one
   - Update `.env` with new key

3. **Check key permissions:**
   - Only "API User" role needed (not "Admin")
   - Key should have access to desired model (claude-sonnet-4-5 by default)

4. **Test API key directly:**
   ```bash
   curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/messages \
     -H "content-type: application/json" \
     -d '{"model":"claude-opus-4-5-20251101","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
   ```

   Should return message response (not 401 error).

### Problem: Rate limiting (429 errors)

**Causes:**
1. Too many API calls in short time
2. Account-level rate limit reached
3. Analyzing very large sessions repeatedly
4. Concurrent requests to API

**Solutions:**

1. **Wait before retrying:**
   ```bash
   # Wait 60 seconds then try again
   sleep 60
   npx tsx scripts/analyze-style.ts --yes
   ```

2. **Analyze one session at a time:**
   ```bash
   npx tsx scripts/test-local.ts analyze <session-id>
   ```

   Instead of batch mode which queries multiple sessions.

4. **Check rate limits:**
   - Visit https://console.anthropic.com/account/limits
   - View your account's rate limit tier
   - Contact Anthropic support to increase limits if needed

### Problem: "Token limit exceeded" or context length error

**Causes:**
1. Session too large (100k+ tokens worth of content)
2. Analyzing multiple large sessions together
3. Model has smaller context window than needed

**Solutions:**

1. **Analyze smaller sessions first:**
   ```bash
   npx tsx scripts/test-local.ts sessions --verbose
   ```

   Look for sessions with shorter duration (5-15 minutes) rather than 1+ hour sessions.

   Analyze individual small sessions:
   ```bash
   npx tsx scripts/test-local.ts analyze <session-id>
   ```

3. **Check session size before analysis:**
   ```bash
   # In bytes
   ls -lh ~/.claude/projects/*/[session-id].jsonl

   # If larger than 10MB, likely too big for single analysis
   ```

4. **Override model to one with larger context:**
   ```bash
   # Set in .env:
   NOSLOP_MODEL=claude-opus-4-5-20251101
   ```

   Opus 4.5 has larger context window (200k tokens) vs Sonnet (200k tokens).

---

## Supabase / Database Issues

### Problem: "SUPABASE_URL not set" or "SUPABASE_ANON_KEY not set"

**Context:** Supabase is optional. Local analysis works without it. Only needed for:
- Knowledge platform features (browse, search)
- Cloud storage of analyses
- Sharing features (enterprise)

**Solutions:**

1. **If you want local-only mode (recommended for most):**

   Simply skip Supabase configuration. The system automatically uses local storage.

   ```bash
   # This works fine without Supabase:
   npx tsx scripts/analyze-style.ts
   npx tsx scripts/test-local.ts sessions
   ```

2. **If you want to enable Supabase:**

   Create Supabase project:
   - Visit https://supabase.com/dashboard
   - Click "New Project"
   - Set project name and database password
   - Wait for project to initialize (~2 min)

   Add to `.env`:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

   Get these from: Project Settings > API > Keys section

   Then test connection:
   ```bash
   npx tsx scripts/test-supabase.ts
   ```

3. **For knowledge base features specifically:**

   If you ONLY want knowledge features (not session analysis):
   ```bash
   npx tsx scripts/browse-knowledge.ts
   ```

   Will use Supabase if available, otherwise local storage.

### Problem: Supabase connection refused or timeout

**Causes:**
1. `SUPABASE_URL` incorrect or project deleted
2. Network connectivity issue
3. Supabase project not responding
4. Firewall blocking connection

**Solutions:**

1. **Verify Supabase project exists:**
   ```bash
   # Test with curl
   curl -s https://your-project-ref.supabase.co/rest/v1/ \
     -H "apikey: $SUPABASE_ANON_KEY" | head -20
   ```

   Should return valid JSON, not "404" or connection error.

2. **Check URL format:**
   ```bash
   # Correct:
   SUPABASE_URL=https://abcdef123456.supabase.co

   # Wrong (missing https:// or .co):
   SUPABASE_URL=abcdef123456.supabase
   ```

   Get correct URL from Project Settings > API.

3. **Test network connectivity:**
   ```bash
   ping supabase.co
   ```

   If fails, you have network/firewall issues.

   For corporate networks, may need to:
   - Use VPN if available
   - Check firewall rules for `*.supabase.co`
   - Contact IT if port 443 is blocked

4. **Check Supabase service status:**

   Visit https://status.supabase.com to see if Supabase has incidents.

   If down, wait for recovery.

### Problem: RLS (Row Level Security) policy errors

**Symptoms:**
```
Error: 403 Forbidden
Policy failed for service role
```

**Causes:**
1. RLS policies too restrictive
2. Missing service role key (using anon key instead)
3. User not authenticated when using anon key
4. Table doesn't exist

**Solutions:**

1. **Use service role key for backend:**

   In `.env`, make sure `SUPABASE_SERVICE_ROLE_KEY` is set:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

   Service role bypasses RLS policies. Get it from Project Settings > API > Service Role secret.

2. **For frontend (web dashboard):**

   Anon key is correct. Ensure RLS policies allow:
   - Read on public data
   - Authenticated writes for user data

   See Supabase docs: https://supabase.com/docs/guides/auth/row-level-security

3. **Verify tables exist:**
   ```bash
   npx tsx scripts/test-supabase.ts
   ```

   Should show:
   ```
   ✅ knowledge_items table accessible
   ✅ influencers table accessible
   ```

   If not, run migrations:
   ```bash
   npm run db:init
   ```

4. **Reset Supabase to defaults:**

   If tables corrupted, safest is to:
   - Delete project and create new one
   - Or, clear all data:
     ```sql
     DELETE FROM knowledge_items;
     DELETE FROM influencers;
     ```

### Problem: Offline / Cloud sync issues

**Causes:**
1. Internet connection lost mid-operation
2. Supabase project stopped
3. Sync conflict between local and cloud
4. Large data batch causing timeout

**Solutions:**

1. **Work offline with local storage:**

   The system gracefully falls back to local storage when Supabase unavailable:
   ```bash
   # This works even if Supabase is down:
   npx tsx scripts/analyze-style.ts
   ```

   Analysis saved locally to `~/.nomoreaislop/analyses/`

2. **Retry Supabase operations:**
   ```bash
   # If sync failed, wait and retry:
   sleep 5
   npx tsx scripts/populate-knowledge.ts
   ```

3. **Clear local cache to re-sync:**
   ```bash
   rm ~/.nomoreaislop/cache.json
   ```

   Next run will re-fetch from Supabase.

4. **Check Supabase status:**

   Visit https://status.supabase.com. If down, use local mode until recovered.

---

## Report Generation Issues

### Problem: Port already in use (address already in use)

**Causes:**
1. Another process on port 3000 or 3001
2. Previous server didn't shut down cleanly
3. Running multiple analysis instances

**Solutions:**

1. **System automatically finds next available port:**

   The report server tries ports in sequence (3000, 3001, 3002...) and uses first available. Usually automatic, no action needed.

   You'll see output like:
   ```
   Report available at http://localhost:3002
   ```

2. **If you want to use specific port, kill existing process:**
   ```bash
   # Find process on port 3000:
   lsof -i :3000

   # Kill it:
   kill -9 <PID>
   ```

3. **Check what's using the port:**
   ```bash
   # macOS/Linux:
   lsof -i :3000

   # Windows:
   netstat -ano | findstr :3000
   ```

   Common culprits:
   - Previous analysis still running
   - React dev server from another project
   - Docker container

   Stop it and retry analysis.

4. **Use non-standard port explicitly:**

   If you need specific port, modify analysis script:
   ```typescript
   await startReportServer(result, { port: 3100 });
   ```

### Problem: Browser not opening automatically

**Causes:**
1. `open` command not available (Linux)
2. No default browser set
3. Browser configuration issue
4. Report URL incorrect

**Solutions:**

1. **Manually open report URL:**

   The output will show the URL:
   ```
   Report available at http://localhost:3000
   ```

   Copy-paste into your browser.

2. **For Linux systems:**

   `open` command only works on macOS. On Linux, use:
   ```bash
   xdg-open http://localhost:3000
   ```

   Or install x-cli:
   ```bash
   npm install -g x-cli
   ```

3. **Verify browser exists:**
   ```bash
   # macOS:
   which open

   # Linux:
   which xdg-open

   # Windows:
   where start
   ```

4. **Disable auto-open and open manually:**

   In the source code, set `autoOpen: false`:
   ```typescript
   await startReportServer(result, { autoOpen: false });
   ```

   Then open URL manually.

### Problem: Report page blank or not loading

**Causes:**
1. Server crashed or didn't start
2. Incorrect port in browser URL
3. Browser cache issue
4. JavaScript error in report template

**Solutions:**

1. **Check server is running:**
   ```bash
   curl http://localhost:3000/
   ```

   Should return HTML content, not "Connection refused".

2. **Clear browser cache:**
   - Chrome: Cmd+Shift+Delete (macOS) or Ctrl+Shift+Delete (Windows)
   - Firefox: Cmd+Shift+Delete (macOS) or Ctrl+Shift+Delete (Windows)
   - Safari: Develop > Empty Web Caches

   Then reload page.

3. **Check browser console for errors:**
   - Open DevTools (F12 or Cmd+Option+I)
   - Look for red error messages
   - Report any errors to GitHub issues

4. **Verify port in URL:**

   Look at console output. If it says:
   ```
   Report available at http://localhost:3002
   ```

   Use 3002, not 3000.

5. **Test with curl:**
   ```bash
   curl http://localhost:3000/ -v
   ```

   Should show 200 status and HTML. If 404 or connection refused, server issue.

### Problem: HTML rendering issues (styling broken, layout wrong)

**Causes:**
1. Browser doesn't support CSS used in template
2. JavaScript disabled in browser
3. Report template has bugs
4. Very large reports exceed rendering limits

**Solutions:**

1. **Update your browser:**

   Use latest Chrome, Firefox, Safari, or Edge. Report uses modern CSS (flexbox, grid).

   Download latest: https://browsehappy.com/

2. **Enable JavaScript:**

   The report is static HTML, but styling uses CSS. Ensure JavaScript is enabled:
   - Chrome: Settings > Privacy > JavaScript
   - Firefox: about:config > javascript.enabled
   - Safari: Preferences > Security > Enable JavaScript

3. **Try different browser:**

   If only broken in one browser, try another:
   ```bash
   # If using Chrome:
   open http://localhost:3000/ -a Firefox
   ```

4. **Check terminal output for render errors:**

   When analysis completes, look for any error messages about template rendering.

   Report any errors to GitHub issues with:
   - Browser version
   - Operating system
   - Full error message

### Problem: Premium content is locked / paid feature warning

**Causes:**
1. Viewing free/limited version report
2. License not activated (future feature)
3. Account tier is "free" instead of "pro" or "premium"

**Solutions:**

1. **For current MVP version:**

   Report shows what's available in free tier:
   - AI Coding Style result
   - 2 evidence samples
   - Basic metrics

   This is expected. Full features coming in Phase 3.

2. **To unlock all features (development/testing only):**

   In `.env`, set:
   ```env
   NOSLOP_TEST_TIER=premium
   ```

   Only works with `NODE_ENV != 'production'`.

   For production deployment, will require actual license/payment.

3. **Check your tier:**

   Look at top of report or run:
   ```bash
   npx tsx scripts/test-local.ts analyze --json | grep tier
   ```

---

## Analysis Issues

### Problem: Cost estimation differs from actual usage

**Causes:**
1. Token counting heuristics not perfect
2. Code-heavy sessions inflate estimate
3. System prompt overhead estimates vary
4. Model token counting may differ slightly

**Solutions:**

1. **Understand cost estimation is approximate:**

   The system uses heuristics:
   - Character count * 0.25 = token estimate (base)
   - Code/JSON multiplier: * 1.3 (code is more tokens per char)
   - System overhead: ~2,500 tokens
   - Schema overhead: ~1,500 tokens
   - Output estimate: ~6,000 tokens

   Actual usage may be 10-20% higher or lower.

2. **Preview actual cost without running:**
   ```bash
   npx tsx scripts/analyze-style.ts --dry-run
   ```

   Shows estimated cost. If unexpected:
   - Check if sessions are larger than expected
   - Consider analyzing fewer sessions

3. **For exact billing:**

   Check your Anthropic account dashboard:
   https://console.anthropic.com/account/usage

   Shows actual tokens used and cost.

4. **Ways to reduce cost:**
   ```bash
   # Analyze fewer sessions:
   npx tsx scripts/test-local.ts analyze <single-id>

   # Use cheaper model:
   NOSLOP_MODEL=claude-haiku-4-5-20251001 npx tsx scripts/analyze-style.ts --yes
   ```

### Problem: Analysis using too many tokens

**Causes:**
1. Sessions too large for detailed LLM analysis
2. Verbose mode calls Claude with full session content
3. Analyzing 10 sessions at once (each ~10-20k tokens)

**Solutions:**

1. **Analyze fewer sessions:**
   ```bash
   npx tsx scripts/test-local.ts analyze <session-id>
   ```

   Instead of batch mode analyzing 10 sessions.

2. **Split large sessions:**

   If one session is very large (1+ hour), split into smaller pieces:
   - Analyze first 30 minutes only
   - Or analyze different time periods separately

3. **Preview cost before running:**
   ```bash
   npx tsx scripts/analyze-style.ts --dry-run
   ```

   Shows exact estimated cost before proceeding.

### Problem: Model selection errors or wrong model used

**Causes:**
1. Model name in `.env` invalid or doesn't exist
2. Account doesn't have access to model
3. Model changed or deprecated
4. Environment variable not loaded

**Solutions:**

1. **Verify model name is valid:**
   ```bash
   # Current valid models:
   NOSLOP_MODEL=claude-sonnet-4-5-20250514    # Default (recommended)
   NOSLOP_MODEL=claude-opus-4-5-20251101      # Slower, larger context
   NOSLOP_MODEL=claude-haiku-4-5-20251001     # Faster, cheaper, smaller
   ```

   Other model names will error. Check console.anthropic.com for available models.

2. **Check model access:**

   Go to https://console.anthropic.com/account/limits and verify you have access to the model.

   If not:
   - Waiting period for new model access (usually auto-enabled after creation)
   - Contact Anthropic support if blocked

3. **Verify environment variable loaded:**
   ```bash
   echo $NOSLOP_MODEL
   ```

   If blank, not loaded. Try:
   ```bash
   source .env
   echo $NOSLOP_MODEL
   npx tsx scripts/analyze-style.ts
   ```

4. **Check which model is actually being used:**
   ```bash
   # Add debug output:
   NOSLOP_MODEL=claude-opus-4-5-20251101 npx tsx scripts/analyze-style.ts --dry-run
   ```

   The cost output will show which model was selected.

### Problem: Empty or incomplete analysis results

**Causes:**
1. Session has very few messages (too small to analyze)
2. Session content unrecognizable (corrupted)
3. LLM response parsing failed
4. Analysis was interrupted

**Solutions:**

1. **Check session is large enough:**
   ```bash
   npx tsx scripts/test-local.ts sessions --verbose
   ```

   Look for:
   - "Message count": Should be >= 2
   - "Duration": Should be >= 5 minutes
   - "Created": Within 90 days

2. **Validate session file integrity:**
   ```bash
   # Check file is valid JSONL:
   wc -l ~/.claude/projects/[path]/[session-id].jsonl
   ```

   Should show line count > 0. If 0 or very small (<10), session too small.

   Try another session or create longer session.

3. **Check for parsing errors:**
   ```bash
   npx tsx scripts/test-local.ts analyze <session-id> --verbose
   ```

   May show details about why parsing failed.

4. **Restart analysis if interrupted:**

   If you canceled mid-analysis (Ctrl+C), analysis may be incomplete.

   Re-run:
   ```bash
   npx tsx scripts/analyze-style.ts
   ```

---

## Debug Mode Guide

### Enabling verbose logging

```bash
# Set debug environment variable:
DEBUG=nomoreaislop:* npx tsx scripts/analyze-style.ts

# Or more specific:
DEBUG=nomoreaislop:parser npx tsx scripts/analyze-style.ts
```

### Reading raw session JSONL

**View raw session data:**
```bash
# List sessions:
ls ~/.claude/projects/*/

# View first 10 lines of session:
head ~/.claude/projects/[encoded-path]/[session-id].jsonl

# Pretty-print first entry:
head -1 ~/.claude/projects/[encoded-path]/[session-id].jsonl | jq .

# Count messages:
wc -l ~/.claude/projects/[encoded-path]/[session-id].jsonl

# See message types distribution:
grep -o '"type":"[^"]*"' ~/.claude/projects/[encoded-path]/[session-id].jsonl | sort | uniq -c
```

### Inspecting API responses

**Check what the API returns:**

1. **Enable request/response logging:**
   ```typescript
   // In src/analyzer/index.ts, add logging around API call:
   console.log('Request:', JSON.stringify(request, null, 2));
   const response = await this.client.messages.create(request);
   console.log('Response:', JSON.stringify(response, null, 2));
   ```

2. **Check API response format:**
   ```bash
   # Test API with direct curl:
   curl -X POST https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "content-type: application/json" \
     -H "anthropic-beta: structured-outputs-2025-11-13" \
     -d '{
       "model": "claude-sonnet-4-20250514",
       "max_tokens": 1024,
       "messages": [{"role": "user", "content": "say hello"}]
     }' | jq .
   ```

3. **Check error responses:**

   API errors return JSON with `error` field:
   ```json
   {
     "type": "error",
     "error": {
       "type": "invalid_request_error",
       "message": "Invalid API key"
     }
   }
   ```

### Checking stored analysis files

**Examine saved analysis results:**

```bash
# List saved analyses:
ls -la ~/.nomoreaislop/analyses/

# View analysis metadata:
cat ~/.nomoreaislop/analyses/[analysis-id].json | jq '.metadata'

# Check specific evaluation field:
cat ~/.nomoreaislop/analyses/[analysis-id].json | jq '.evaluation.type'

# Find all analyses from specific date:
find ~/.nomoreaislop/analyses/ -mtime -1 -name "*.json"
```

### Running tests with verbose output

```bash
# Run tests with detailed output:
npm test -- --reporter=verbose

# Run specific test file:
npm test -- tests/unit/parser/jsonl-reader.test.ts

# Run tests with coverage:
npm run test:coverage

# Watch mode with verbose:
npm run test:watch -- --reporter=verbose
```

### Checking configuration

**View active configuration:**

```bash
# Show environment variables being used:
env | grep -E "ANTHROPIC|SUPABASE|NOSLOP"

# Check .env file:
cat .env

# Check config file:
cat ~/.nomoreaislop/config.json | jq .
```

---

## FAQ

### Q: Will analyzing sessions use my API quota?

**A:** Yes, analyzing sessions uses Anthropic API. You can preview the cost first:

```bash
# Preview cost without running:
npx tsx scripts/analyze-style.ts --dry-run

# Run analysis:
npx tsx scripts/analyze-style.ts
```

### Q: Can I analyze private/sensitive sessions?

**A:** Yes, all analysis runs locally. Session content sent only to Anthropic API (with your key). Nothing stored in NoMoreAISlop backend unless Supabase configured.

Session content is only sent to Anthropic API (with your key) for analysis.

### Q: Why does analysis take so long?

**Causes:**
1. Large sessions (100k+ tokens) take longer to process
2. Network latency to Anthropic API
3. Multiple sessions analyzed sequentially

**Solutions:**
```bash
# Analyze single smaller session:
npx tsx scripts/test-local.ts analyze <session-id>
```

### Q: Can I delete analyzed sessions?

**A:** Yes, but be aware:
- Deleting from `~/.claude/projects/` removes source data (sessions won't reappear in analysis)
- Deleting from `~/.nomoreaislop/` removes stored analysis results
- Recommended: Keep source data, only delete `~/.nomoreaislop/` to reset

```bash
# Delete stored analyses only (keep source sessions):
rm -rf ~/.nomoreaislop/

# Or delete specific analysis:
rm ~/.nomoreaislop/analyses/[analysis-id].json
```

### Q: Does this collect my data?

**A:** Local analysis is completely local. Optional telemetry can be disabled:

```env
NOSLOP_TELEMETRY=false
```

If Supabase configured, knowledge base stored in cloud but session content never sent there.

### Q: Can I use this in a CI/CD pipeline?

**A:** Yes, use environment variables and non-interactive flags:

```bash
#!/bin/bash
export ANTHROPIC_API_KEY="sk-ant-..."
npx tsx scripts/analyze-style.ts --yes
```

For full automation:
```bash
npx tsx scripts/test-local.ts analyze <session-id> --json > analysis.json
```

### Q: What if I hit the rate limit?

**A:** Wait before retrying:
```bash
sleep 60
npx tsx scripts/analyze-style.ts --yes
```

### Q: How can I analyze older sessions?

Sessions older than 90 days aren't automatically selected, but can be analyzed explicitly:

```bash
# List all sessions (including old):
npx tsx scripts/test-local.ts sessions --all

# Analyze specific old session:
npx tsx scripts/test-local.ts analyze <old-session-id>
```

### Q: Why are my analysis results different each time?

**Reasons:**
1. Analyzing different sessions (new ones created, old ones aged out)
2. LLM has some non-determinism even with temperature=0

**Solution - get consistent results:**
```bash
# Use specific session ID:
npx tsx scripts/test-local.ts analyze <session-id>
```

---

## Getting Help

### Reporting Issues

Found a bug or have questions? Create a GitHub issue:

https://github.com/nomoreaislop/nomoreaislop/issues

**Include in your report:**
1. Command you ran
2. Full error message (copy from terminal)
3. Operating system and Node.js version: `node -v && npm -v`
4. Environment: `cat .env | grep -v "^#"`
5. Steps to reproduce

### Useful diagnostic commands

```bash
# Collect all diagnostic info:
echo "=== System Info ===" && \
node -v && npm -v && uname -a && \
echo "=== Environment ===" && \
env | grep -E "ANTHROPIC|SUPABASE|NOSLOP" && \
echo "=== Session Count ===" && \
find ~/.claude/projects/ -name "*.jsonl" 2>/dev/null | wc -l && \
echo "=== Storage ===" && \
du -sh ~/.nomoreaislop/ 2>/dev/null && \
echo "=== Recent Logs ===" && \
tail -20 ~/.nomoreaislop/debug.log 2>/dev/null
```

### Resources

- **GitHub Repository**: https://github.com/nomoreaislop/nomoreaislop
- **Anthropic API Docs**: https://docs.anthropic.com/
- **Supabase Docs**: https://supabase.com/docs/
- **Node.js Docs**: https://nodejs.org/en/docs/

---

## Advanced Troubleshooting

### Resetting to clean state

```bash
# Clear all local data:
rm -rf ~/.nomoreaislop/

# Clear npm cache:
npm cache clean --force

# Reinstall dependencies:
rm -rf node_modules package-lock.json
npm install

# Rebuild:
npm run build
```

### Checking system requirements

```bash
# Node.js 18+:
node -v

# npm 8+:
npm -v

# Directory readable/writable:
test -r ~/.claude/projects/ && echo "Claude dir readable" || echo "NOT readable"
test -w ~ && echo "Home writable" || echo "NOT writable"
```

### Collecting logs

```bash
# Save current session's logs to file:
npm test 2>&1 | tee test-results.txt

# Run analysis with debug output:
DEBUG=* npx tsx scripts/analyze-style.ts 2>&1 | tee analysis-debug.txt

# Save to file for sharing in issues:
cat analysis-debug.txt
```

### Performance profiling

```bash
# Time how long analysis takes:
time npx tsx scripts/analyze-style.ts --dry-run

# Memory usage monitoring:
node --max-old-space-size=4096 -e "require('tsx/cjs').default('scripts/analyze-style.ts')"
```

---

## Common Workarounds

### Workaround: Port conflicts

If port 3000 constantly in use, modify the analysis script to use different port:

```bash
# Edit scripts/analyze-style.ts line ~XXX:
# Change: startReportServer(result, { port: 3000 })
# To:     startReportServer(result, { port: 3100 })

# Then rebuild and run:
npm run build
npx tsx scripts/analyze-style.ts
```

### Workaround: Supabase unavailable

Use local-only mode by commenting out Supabase config:

```env
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-key
```

System will use local storage instead.

### Workaround: Large sessions timeout

Split analysis into smaller time windows:

```bash
# Analyze single session with smaller scope:
npx tsx scripts/test-local.ts analyze <session-id>
```

---

## Summary

Most issues fall into these categories:

1. **Setup Issues** (API key, environment) → Check `.env` file
2. **Session Issues** (not found, too small) → Check `~/.claude/projects/`
3. **API Issues** (rate limit, token size) → Wait or reduce session count
4. **Port Issues** (already in use) → System automatically finds next port
5. **Database Issues** (Supabase) → Optional; works without it

**When stuck:** Enable debug mode, collect diagnostics, check GitHub issues, report if needed.
