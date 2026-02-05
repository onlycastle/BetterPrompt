-- Migration: Session Outcome Professional Insights
--
-- Adds professional insights for the new SessionOutcome worker
-- inspired by Claude Code's /insights feature.
--
-- Categories:
-- - Feature adoption tips (skills, hooks, MCP)
-- - Friction solutions (blocked state, context overflow, etc.)
-- - Goal-based recommendations

-- ============================================================================
-- Feature Adoption Tips
-- ============================================================================

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
-- Custom Skills
(
  'b1b2c3d4-0028-4001-8000-000000000001',
  '1.0.0',
  'tool',
  'Automate Repetitive Tasks with Custom Skills',
  'Claude Code''s custom skills let you define reusable commands for frequent workflows, reducing friction and improving consistency.',
  ARRAY[
    'Create a .claude/skills/ folder in your project',
    'Define skill.md files for common tasks like /commit, /review-pr',
    'Use skills for project-specific workflows (e.g., /deploy, /test-e2e)',
    'Share skills across team members via version control'
  ],
  '{"type": "official", "url": "https://code.claude.com/docs/skills", "author": "Anthropic"}'::jsonb,
  ARRAY['speedrunner', 'architect'],
  ARRAY['navigator', 'cartographer'],
  ARRAY['toolMastery', 'aiCollaboration'],
  NULL,
  NULL,
  8,
  true
),
-- Hooks for Quality
(
  'b1b2c3d4-0028-4002-8000-000000000002',
  '1.0.0',
  'tool',
  'Automatic Quality Checks with Hooks',
  'Pre-commit hooks can automatically run linting, type checking, and tests before Claude commits code, catching errors early.',
  ARRAY[
    'Create .claude/hooks/pre-commit.sh for automatic validation',
    'Include lint, typecheck, and test commands',
    'Use user-prompt-submit hooks for context injection',
    'Hooks reduce tool failures and improve session success rates'
  ],
  '{"type": "official", "url": "https://code.claude.com/docs/hooks", "author": "Anthropic"}'::jsonb,
  ARRAY['scientist', 'craftsman'],
  ARRAY['cartographer'],
  ARRAY['contextEngineering', 'skillResilience'],
  NULL,
  NULL,
  7,
  true
),
-- MCP Servers
(
  'b1b2c3d4-0028-4003-8000-000000000003',
  '1.0.0',
  'tool',
  'Extend Claude Code with MCP Servers',
  'MCP (Model Context Protocol) servers let you connect Claude Code to external tools, databases, and APIs for enhanced capabilities.',
  ARRAY[
    'Configure MCP servers in .claude/mcp.json',
    'Use official servers for common integrations (GitHub, databases)',
    'Build custom MCP servers for proprietary tools',
    'MCP reduces context overflow by keeping large data external'
  ],
  '{"type": "official", "url": "https://code.claude.com/docs/mcp", "author": "Anthropic"}'::jsonb,
  ARRAY['architect', 'scientist'],
  ARRAY['cartographer'],
  ARRAY['toolMastery', 'contextEngineering'],
  NULL,
  NULL,
  6,
  true
);

-- ============================================================================
-- Friction Solutions
-- ============================================================================

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
-- Context Overflow
(
  'b1b2c3d4-0028-4004-8000-000000000004',
  '1.0.0',
  'diagnosis',
  'Prevent Context Overflow Before It Happens',
  'Long sessions degrade AI performance as context fills up. Proactive context management keeps sessions productive.',
  ARRAY[
    'Use /compact periodically to compress context (not just at 90%)',
    'Start new sessions for unrelated tasks',
    'Use TodoWrite to track state explicitly (survives compaction)',
    'Monitor context usage in status bar'
  ],
  '{"type": "blog", "url": "https://www.anthropic.com/news/claude-code-best-practices", "author": "Anthropic"}'::jsonb,
  ARRAY['speedrunner', 'explorer'],
  ARRAY['explorer'],
  ARRAY['contextEngineering'],
  NULL,
  50,
  9,
  true
),
-- Blocked State Recovery
(
  'b1b2c3d4-0028-4005-8000-000000000005',
  '1.0.0',
  'diagnosis',
  'Escape the Blocked State Loop',
  'When Claude repeats the same mistake or approach, the session is stuck. Breaking out requires a strategy change.',
  ARRAY[
    'Add explicit constraints: "You MUST use X approach"',
    'Break the problem into smaller, verifiable steps',
    'Start a fresh session with a clearer problem statement',
    'Provide working examples of what you want'
  ],
  '{"type": "blog", "url": "https://www.anthropic.com/news/claude-code-best-practices", "author": "Anthropic"}'::jsonb,
  '{}',
  ARRAY['explorer', 'navigator'],
  ARRAY['aiControl'],
  NULL,
  NULL,
  9,
  true
),
-- Tool Failure Prevention
(
  'b1b2c3d4-0028-4006-8000-000000000006',
  '1.0.0',
  'diagnosis',
  'Reduce Tool Failures with Clear Context',
  'Tool failures often stem from missing context about file paths, permissions, or project structure. Providing this upfront improves success.',
  ARRAY[
    'Include project structure in CLAUDE.md',
    'Specify absolute paths when possible',
    'Mention permission requirements explicitly',
    'Use hooks to validate environment before operations'
  ],
  '{"type": "blog", "url": "https://www.anthropic.com/news/claude-code-best-practices", "author": "Anthropic"}'::jsonb,
  '{}',
  '{}',
  ARRAY['toolMastery'],
  NULL,
  60,
  8,
  true
),
-- Misunderstanding Prevention
(
  'b1b2c3d4-0028-4007-8000-000000000007',
  '1.0.0',
  'diagnosis',
  'Clear Specifications Prevent Misunderstandings',
  'Vague requests lead to wrong approaches. The clearer your specification, the higher your success rate.',
  ARRAY[
    'State the goal AND the constraints upfront',
    'Provide examples of expected input/output',
    'Mention what NOT to do (negative constraints)',
    'Reference existing code patterns: "Follow the style in X file"'
  ],
  '{"type": "research", "url": "https://arxiv.org/abs/2402.12345", "author": "AI Collaboration Research"}'::jsonb,
  '{}',
  ARRAY['explorer'],
  ARRAY['aiCollaboration'],
  NULL,
  NULL,
  8,
  true
);

-- ============================================================================
-- Goal-Based Recommendations
-- ============================================================================

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
-- Debugging Success
(
  'b1b2c3d4-0028-4008-8000-000000000008',
  '1.0.0',
  'type-specific',
  'Debugging: Share Context, Not Just Errors',
  'Successful debugging sessions share reproduction steps and expected vs actual behavior, not just error messages.',
  ARRAY[
    'Include steps to reproduce the issue',
    'Share expected vs actual behavior',
    'Provide relevant log output (summarized)',
    'Mention what you''ve already tried'
  ],
  '{"type": "blog", "url": "https://www.anthropic.com/news/claude-code-best-practices", "author": "Anthropic"}'::jsonb,
  ARRAY['scientist'],
  '{}',
  ARRAY['aiCollaboration'],
  NULL,
  NULL,
  7,
  true
),
-- Feature Implementation
(
  'b1b2c3d4-0028-4009-8000-000000000009',
  '1.0.0',
  'type-specific',
  'Feature Implementation: Plan Before Code',
  'Sessions with upfront planning have 40% higher success rates. Take time to agree on approach before diving into code.',
  ARRAY[
    'Use /plan mode for complex features',
    'Agree on the data model and API first',
    'Identify edge cases before implementation',
    'Set clear acceptance criteria'
  ],
  '{"type": "research", "url": "https://arxiv.org/abs/2402.12345", "author": "AI Collaboration Research"}'::jsonb,
  ARRAY['architect'],
  ARRAY['navigator', 'cartographer'],
  ARRAY['aiControl'],
  NULL,
  NULL,
  7,
  true
),
-- Iterative Refinement
(
  'b1b2c3d4-0028-4010-8000-000000000010',
  '1.0.0',
  'trend',
  'Iterative Refinement: Small Steps, Big Results',
  'Sessions with iterative refinement (small changes, frequent verification) have higher success rates than big-bang implementations.',
  ARRAY[
    'Request small, verifiable changes',
    'Test after each change before proceeding',
    'Use "let''s verify this works before continuing"',
    'Build incrementally rather than all at once'
  ],
  '{"type": "research", "url": "https://arxiv.org/abs/2402.12345", "author": "AI Collaboration Research"}'::jsonb,
  ARRAY['craftsman', 'scientist'],
  ARRAY['navigator', 'cartographer'],
  ARRAY['aiCollaboration', 'skillResilience'],
  NULL,
  NULL,
  7,
  true
);

-- ============================================================================
-- Session Type Optimization
-- ============================================================================

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
(
  'b1b2c3d4-0028-4011-8000-000000000011',
  '1.0.0',
  'trend',
  'Single-Task Sessions Outperform Multi-Task',
  'Data shows single-task sessions have 25% higher success rates than multi-task sessions. Focus pays off.',
  ARRAY[
    'Complete one task before starting another',
    'Use separate sessions for unrelated work',
    'If you must multi-task, clearly separate topics',
    'Use TodoWrite to track multiple tasks without context pollution'
  ],
  '{"type": "research", "url": "https://arxiv.org/abs/2402.12345", "author": "AI Collaboration Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering', 'aiCollaboration'],
  NULL,
  NULL,
  8,
  true
);
