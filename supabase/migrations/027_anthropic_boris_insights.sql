-- Migration: Add 10 professional insights from Anthropic research and Boris Cherny thread
-- Sources:
--   - Anthropic Research: https://www.anthropic.com/research/AI-assistance-coding-skills (3 insights)
--   - Boris Cherny (Anthropic Engineer): https://x.com/bcherny/status/2017742741636321619 (7 insights)

INSERT INTO professional_insights (
  id,
  version,
  category,
  title,
  key_takeaway,
  actionable_advice,
  source,
  applicable_styles,
  applicable_control_levels,
  applicable_dimensions,
  min_score,
  max_score,
  priority,
  enabled
) VALUES

-- ============================================================================
-- Anthropic Research: AI Assistance Impact on Coding Skills (3 insights)
-- Source: https://www.anthropic.com/research/AI-assistance-coding-skills
-- ============================================================================
(
  'c1c2c3d4-0001-4000-8000-000000000001',
  '1.0.0',
  'diagnosis',
  'The 17% Comprehension Gap',
  'Anthropic research found that AI-assisted developers showed 17% lower comprehension of the code they produced compared to unassisted developers. Speed gains come at a hidden cost.',
  ARRAY[
    'After AI generates code, explain it to yourself line-by-line before accepting',
    'Keep a "learning journal" of new patterns you encounter in AI-generated code',
    'If you can''t explain a section, ask AI "why this approach?" before moving on'
  ],
  '{"type": "research", "url": "https://www.anthropic.com/research/AI-assistance-coding-skills", "author": "Anthropic Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl', 'skillResilience'],
  NULL,
  NULL,
  10,
  true
),
(
  'c1c2c3d4-0002-4000-8000-000000000002',
  '1.0.0',
  'diagnosis',
  'Debugging Skills Suffer Most',
  'Anthropic study showed debugging abilities declined more than other coding skills with AI assistance. Debugging requires understanding code deeply - exactly what passive acceptance undermines.',
  ARRAY[
    'When bugs occur, attempt diagnosis yourself before asking AI',
    'Practice reading stack traces and error messages without AI interpretation',
    'Weekly challenge: debug one issue using only documentation and logs'
  ],
  '{"type": "research", "url": "https://www.anthropic.com/research/AI-assistance-coding-skills", "author": "Anthropic Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['skillResilience', 'aiControl'],
  NULL,
  NULL,
  9,
  true
),
(
  'c1c2c3d4-0003-4000-8000-000000000003',
  '1.0.0',
  'trend',
  'Cognitive Effort is the Learning Mechanism',
  'The same struggle that AI eliminates is what builds lasting skill. Anthropic research suggests the discomfort of problem-solving is the mechanism of learning, not a bug to be optimized away.',
  ARRAY[
    'Embrace productive struggle - 10-15 minutes of effort before asking AI',
    'Use AI as a tutor, not an answer machine: ask for hints, not solutions',
    'Treat easy AI wins as learning debt that needs repayment'
  ],
  '{"type": "research", "url": "https://www.anthropic.com/research/AI-assistance-coding-skills", "author": "Anthropic Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['skillResilience'],
  NULL,
  NULL,
  8,
  true
),

-- ============================================================================
-- Boris Cherny Thread: Claude Code Power Tips (7 insights)
-- Source: https://x.com/bcherny/status/2017742741636321619
-- Author: Boris Cherny (Anthropic Engineer)
-- ============================================================================
(
  'c1c2c3d4-0004-4000-8000-000000000004',
  '1.0.0',
  'tool',
  'Invest in CLAUDE.md: Let Claude Write Its Own Rules',
  'Boris Cherny recommends having Claude update its own CLAUDE.md when you give feedback. This creates a compounding improvement loop where Claude learns your preferences over time.',
  ARRAY[
    'When you correct Claude, say "update CLAUDE.md with this preference"',
    'Include coding style, error handling patterns, and testing requirements',
    'Review CLAUDE.md monthly - remove outdated rules, keep what works'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering', 'toolMastery', 'aiControl'],
  NULL,
  NULL,
  9,
  true
),
(
  'c1c2c3d4-0005-4000-8000-000000000005',
  '1.0.0',
  'tool',
  'Turn Repeated Tasks into Skills',
  'Use the /skill command to capture common workflows. This reduces context overhead and ensures consistent execution of repeated tasks.',
  ARRAY[
    'Identify tasks you do repeatedly (commit, deploy, test patterns)',
    'Create custom skills with /skill for these workflows',
    'Skills are reusable prompts - invest time to craft them well'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['toolMastery'],
  NULL,
  NULL,
  8,
  true
),
(
  'c1c2c3d4-0006-4000-8000-000000000006',
  '1.0.0',
  'trend',
  'Zero-Context Bug Fixing with MCP',
  'Using MCP servers like Sentry integration, you can paste a bug URL and Claude will fix it with zero context - it fetches everything it needs automatically.',
  ARRAY[
    'Set up Sentry MCP for automatic error context fetching',
    'Paste issue URLs directly instead of copying error details manually',
    'MCP turns external tools into context sources Claude can query directly'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['toolMastery', 'aiCollaboration'],
  NULL,
  NULL,
  7,
  true
),
(
  'c1c2c3d4-0007-4000-8000-000000000007',
  '1.0.0',
  'tool',
  'Make Claude Your Code Reviewer',
  'Train Claude to review code the way you like by teaching it your standards in CLAUDE.md. "Review this PR" becomes a powerful command when Claude knows your preferences.',
  ARRAY[
    'Document your code review criteria in CLAUDE.md',
    'Include what you look for: error handling, naming, test coverage',
    'Use "review this like you''re me" for personalized feedback'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl', 'aiCollaboration'],
  NULL,
  NULL,
  8,
  true
),
(
  'c1c2c3d4-0008-4000-8000-000000000008',
  '1.0.0',
  'trend',
  'Subagents Keep Your Context Window Clean',
  'Subagents run in isolated context windows. Delegate exploratory tasks to them to keep your main conversation focused and prevent context pollution.',
  ARRAY[
    'Use Task tool to delegate research and exploration to subagents',
    'Subagent results come back summarized, not raw',
    'Reserve main context for decision-making and implementation'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering', 'toolMastery'],
  NULL,
  NULL,
  7,
  true
),
(
  'c1c2c3d4-0009-4000-8000-000000000009',
  '1.0.0',
  'tool',
  'Use Claude for Data Analysis via CLI',
  'Claude Code can analyze CSVs, logs, and data files directly. Pipe data through Claude for quick analysis without switching to specialized tools.',
  ARRAY[
    'Pipe log files directly: "cat logs.txt | claude ''find errors''"',
    'Analyze CSVs: "claude ''summarize this data'' < data.csv"',
    'Combine with shell tools for powerful data pipelines'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['toolMastery'],
  NULL,
  NULL,
  6,
  true
),
(
  'c1c2c3d4-0010-4000-8000-000000000010',
  '1.0.0',
  'diagnosis',
  'Use Explanatory Mode for Active Learning',
  'Claude Code has an explanatory output style that teaches as it works. Use this mode when learning new codebases or unfamiliar patterns to build understanding, not just output.',
  ARRAY[
    'Enable explanatory mode when exploring unfamiliar code',
    'Ask Claude to explain its reasoning, not just its output',
    'Treat AI sessions as learning opportunities, not just task completion'
  ],
  '{"type": "x-post", "url": "https://x.com/bcherny/status/2017742741636321619", "author": "Boris Cherny", "authorHandle": "@bcherny"}'::jsonb,
  '{}',
  '{}',
  ARRAY['skillResilience'],
  NULL,
  NULL,
  8,
  true
)

ON CONFLICT (id) DO NOTHING;

-- Verify the new insights were added
DO $$
DECLARE
  new_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_count
  FROM professional_insights
  WHERE id::text LIKE 'c1c2c3d4-%';

  SELECT COUNT(*) INTO total_count
  FROM professional_insights
  WHERE enabled = true;

  RAISE NOTICE '=== Migration 027: Anthropic & Boris Cherny Insights ===';
  RAISE NOTICE 'New insights added: %', new_count;
  RAISE NOTICE 'Total enabled insights: %', total_count;
END$$;
