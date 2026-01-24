-- Migration: Add additional professional insights to fill dimension gaps
-- Target: burnoutRisk(6), scopeManagement(4), learningVelocity(4),
--         aiCollaboration(2), iterationEfficiency(2), aiControl(1) = 19 total

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
-- burnoutRisk Insights (6 new)
-- ============================================================================
(
  'b1b2c3d4-0001-4000-8000-000000000001',
  '1.0.0',
  'diagnosis',
  'The 19% Slowdown: AI Productivity Paradox',
  'WARNING: Research proves experienced developers are 19% SLOWER with AI tools. AI was expected to cut time by 24%, but actually increased it. Stop assuming AI always helps.',
  ARRAY[
    'Before using AI, ask: "Can I do this faster myself?"',
    'Track your actual completion times with and without AI',
    'For familiar tasks, skip AI - your muscle memory is faster'
  ],
  '{"type": "research", "url": "https://arxiv.org/abs/2507.09089", "author": "METR Research Team"}'::jsonb,
  '{}',
  '{}',
  ARRAY['burnoutRisk'],
  NULL,
  50,
  9,
  true
),
(
  'b1b2c3d4-0002-4000-8000-000000000002',
  '1.0.0',
  'diagnosis',
  'Cognitive Overload: When AI Hurts More Than Helps',
  'DANGER: High AI immersion + fatigue = catastrophic performance drop. GenAI immersion amplifies exhaustion rather than reducing it. AI is not a substitute for rest.',
  ARRAY[
    'When tired, reduce AI usage - don''t increase it',
    'Set a "cognitive budget" - limit AI interactions per hour when fatigued',
    'Take breaks without screens, not just without AI'
  ],
  '{"type": "research", "url": "https://www.mdpi.com/2227-7080/13/11/486", "author": "MDPI Cognitive Load Study"}'::jsonb,
  '{}',
  '{}',
  ARRAY['burnoutRisk'],
  NULL,
  50,
  9,
  true
),
(
  'b1b2c3d4-0003-4000-8000-000000000003',
  '1.0.0',
  'diagnosis',
  'AI Fatigue is Real: 65,000 Developers Confirm',
  'Developer satisfaction with AI dropped from 70% to 60% in two years. The honeymoon is over - now the real work begins. Mid-career developers report peak burnout levels.',
  ARRAY[
    'Stop chasing every new AI feature - master what you have',
    'Recognize AI fatigue symptoms: frustration, cynicism, declining output quality',
    'Reduce your AI tool count - depth over breadth'
  ],
  '{"type": "survey", "url": "https://dev.to/dev_tips/dev-world-unplugged-65000-developers-survey-results-on-code-ai-and-burnout-in-2024-and-why-3nde", "author": "DEV.to Survey"}'::jsonb,
  '{}',
  '{}',
  ARRAY['burnoutRisk'],
  NULL,
  50,
  8,
  true
),
(
  'b1b2c3d4-0004-4000-8000-000000000004',
  '1.0.0',
  'diagnosis',
  'Technostress Alert: AI is Amplifying Developer Anxiety',
  'AI''s rapid evolution triggers uncertainty, loss of control, and cognitive overload. This is clinically linked to anxiety disorders. You cannot keep up with everything - and that''s okay.',
  ARRAY[
    'Limit exposure to AI news and updates to once per week',
    'Master one tool deeply before exploring others',
    'Accept that you cannot keep up with everything - and that''s okay'
  ],
  '{"type": "research", "url": "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1600013/full", "author": "Frontiers Psychology"}'::jsonb,
  '{}',
  '{}',
  ARRAY['burnoutRisk'],
  NULL,
  50,
  9,
  true
),
(
  'b1b2c3d4-0005-4000-8000-000000000005',
  '1.0.0',
  'diagnosis',
  'Long-term AI Use Linked to Mental Exhaustion (r=0.905)',
  'CRITICAL: Long-term AI use correlates almost perfectly (r=0.905) with mental exhaustion, attention problems, and information overload. This is not speculation - it''s measured.',
  ARRAY[
    'Schedule "AI-free coding blocks" weekly - minimum 2 hours',
    'Practice solving problems without AI to maintain independent capability',
    'Monitor yourself for attention fragmentation and increased frustration'
  ],
  '{"type": "research", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12367725/", "author": "PMC Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['burnoutRisk'],
  NULL,
  40,
  10,
  true
),
(
  'b1b2c3d4-0006-4000-8000-000000000006',
  '1.0.0',
  'diagnosis',
  'AI Productivity Can Accelerate Burnout',
  'WARNING: If not careful, AI-enabled productivity accelerates burnout rather than preventing it. More output capacity doesn''t mean you should output more. Protect your recovery time.',
  ARRAY[
    'Set boundaries - the work will still be there tomorrow',
    'Don''t let AI-enabled speed become the new baseline expectation',
    'Protect your recovery time - it''s now more valuable than ever'
  ],
  '{"type": "blog", "url": "https://addyosmani.com/blog/ai-coding-workflow/", "author": "Addy Osmani"}'::jsonb,
  '{}',
  '{}',
  ARRAY['burnoutRisk'],
  NULL,
  50,
  9,
  true
),

-- ============================================================================
-- scopeManagement Insights (4 new)
-- ============================================================================
(
  'b1b2c3d4-0007-4000-8000-000000000007',
  '1.0.0',
  'diagnosis',
  'AI Enables Scope Creep - Manage It or Pay Later',
  'AI makes implementation so fast that scope creep happens before you notice. Just because you CAN build it quickly doesn''t mean you SHOULD. Define scope BEFORE opening your AI tool.',
  ARRAY[
    'Define scope BEFORE opening your AI tool',
    'Every "quick addition" gets written down and evaluated against original scope',
    'Ask: "Is this in the original requirements?" before implementing anything'
  ],
  '{"type": "research", "url": "https://amsconsulting.com/articles/integrating-ai-with-project-management/", "author": "Deloitte AI Change Management"}'::jsonb,
  '{}',
  '{}',
  ARRAY['scopeManagement'],
  NULL,
  50,
  9,
  true
),
(
  'b1b2c3d4-0008-4000-8000-000000000008',
  '1.0.0',
  'diagnosis',
  'The Technical Debt Bubble: Vibe Coding''s Hidden Cost',
  'WARNING: 25-70% of AI-generated code contains security vulnerabilities. You''re trading short-term speed for long-term instability. Track every shortcut AI helped you take.',
  ARRAY[
    'Never skip security review for AI-generated code',
    'Maintain a "debt log" - track every shortcut AI helped you take',
    'Schedule regular refactoring sessions to pay down AI-accelerated debt'
  ],
  '{"type": "research", "url": "https://en.wikipedia.org/wiki/Vibe_coding", "author": "IEEE/Wikipedia"}'::jsonb,
  '{}',
  '{}',
  ARRAY['scopeManagement'],
  NULL,
  50,
  9,
  true
),
(
  'b1b2c3d4-0009-4000-8000-000000000009',
  '1.0.0',
  'diagnosis',
  'Production Codebases: No Room for Vibe Coding',
  'Most software engineering is evolving existing systems, not greenfield projects. AI-generated code that ignores existing architecture creates maintenance nightmares.',
  ARRAY[
    'Always provide existing codebase context to AI before generating code',
    'New code must follow existing patterns - AI won''t know them unless you specify',
    'Review how AI-generated code integrates with existing modules before accepting'
  ],
  '{"type": "blog", "url": "https://simonwillison.net/2025/Mar/19/vibe-coding/", "author": "Simon Willison"}'::jsonb,
  '{}',
  '{}',
  ARRAY['scopeManagement'],
  NULL,
  50,
  8,
  true
),
(
  'b1b2c3d4-0010-4000-8000-000000000010',
  '1.0.0',
  'diagnosis',
  'Andrew Ng''s Warning: Don''t Skip Requirements Because AI is Fast',
  'AI can generate code instantly, but without clear requirements, it will generate the WRONG code instantly. Garbage in, garbage out - faster. Write requirements before ANY AI interaction.',
  ARRAY[
    'Write requirements document before ANY AI interaction',
    'Define acceptance criteria that AI-generated code must meet',
    'Unclear scope + AI = infinite scope expansion'
  ],
  '{"type": "blog", "url": "https://www.klover.ai/vibe-coding-karpathy-viral-term-ng-reality-check-klover-first-mover-advantage/", "author": "Andrew Ng via Klover.ai"}'::jsonb,
  '{}',
  '{}',
  ARRAY['scopeManagement'],
  NULL,
  50,
  9,
  true
),

-- ============================================================================
-- learningVelocity Insights (4 new)
-- ============================================================================
(
  'b1b2c3d4-0011-4000-8000-000000000011',
  '1.0.0',
  'diagnosis',
  'Fundamentals First: AI Skills Without Foundation = House on Sand',
  'Everyone wants AI skills, but without programming fundamentals, you''ll hit a ceiling fast. AI tools require strong basics to use effectively. Master the language AI is generating.',
  ARRAY[
    'Before learning "AI coding", master the language AI is generating',
    'Understand data structures and algorithms - AI can''t compensate for missing fundamentals',
    'Build something non-trivial without AI first - then see how AI helps'
  ],
  '{"type": "survey", "url": "https://blog.jetbrains.com/education/2024/12/17/computer-science-education-trends-2024/", "author": "JetBrains CS Education Survey"}'::jsonb,
  '{}',
  '{}',
  ARRAY['learningVelocity'],
  50,
  NULL,
  8,
  true
),
(
  'b1b2c3d4-0012-4000-8000-000000000012',
  '1.0.0',
  'trend',
  'The 56% AI Salary Premium: What It Really Means',
  'AI skills command up to 56% salary premium. But "using AI" is not a skill - "solving problems WITH AI" is. Learn prompt engineering and context management - the real AI skills.',
  ARRAY[
    'Focus on prompt engineering and context management - the real AI skills',
    'Learn to evaluate AI output critically - this is what employers pay for',
    'Document your AI-augmented problem-solving methodology'
  ],
  '{"type": "research", "url": "https://www.morson.com/blog/top-ai-skills-engineers-should-learn-2026", "author": "PwC AI Skills Report"}'::jsonb,
  '{}',
  '{}',
  ARRAY['learningVelocity'],
  50,
  NULL,
  8,
  true
),
(
  'b1b2c3d4-0013-4000-8000-000000000013',
  '1.0.0',
  'diagnosis',
  '12-Year Developer''s Confession: AI Made Me Worse at My Craft',
  'DANGER: Senior developers are confessing skill decay from AI dependency. One engineer stopped reading docs entirely. Don''t let this happen to you. Maintain your independent capability.',
  ARRAY[
    'Read official documentation weekly - don''t let AI summarize everything',
    'Solve at least one problem per week without any AI assistance',
    'If you can''t explain AI-generated code line by line, you''ve learned nothing'
  ],
  '{"type": "blog", "url": "https://addyo.substack.com/p/avoiding-skill-atrophy-in-the-age", "author": "Addy Osmani"}'::jsonb,
  '{}',
  '{}',
  ARRAY['learningVelocity', 'skillResilience'],
  NULL,
  50,
  9,
  true
),
(
  'b1b2c3d4-0014-4000-8000-000000000014',
  '1.0.0',
  'diagnosis',
  'The Junior Developer Trap: AI Shortcuts Lead to Career Plateaus',
  'WARNING: Juniors who skip the "hard way" plateau early. Without struggling through problems, you lack depth to become senior. Your growth rate depends on challenges faced, not solutions copied.',
  ARRAY[
    'Embrace difficulty - struggling builds neural pathways AI can''t build for you',
    'Intentionally attempt problems above your level without AI first',
    'Your growth rate depends on challenges faced, not solutions copied'
  ],
  '{"type": "research", "url": "https://spectrum.ieee.org/ai-coding-degrades", "author": "IEEE Spectrum"}'::jsonb,
  '{}',
  '{}',
  ARRAY['learningVelocity', 'skillResilience'],
  NULL,
  50,
  9,
  true
),

-- ============================================================================
-- aiCollaboration Insights (2 new)
-- ============================================================================
(
  'b1b2c3d4-0015-4000-8000-000000000015',
  '1.0.0',
  'trend',
  'The 80/20 Rule: Use the Right AI Tool for the Right Job',
  'Top developers use Copilot for 80% routine coding and Claude for 20% deep thinking. Using one tool for everything is leaving performance on the table. Master both paradigms.',
  ARRAY[
    'Autocomplete tools for line-by-line speed, conversational AI for complex problems',
    'Switch tools based on task complexity, not habit',
    'Master both paradigms - inline completion AND conversational interaction'
  ],
  '{"type": "blog", "url": "https://www.fine.dev/blog/github-copilot-with-claude", "author": "Fine.dev"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiCollaboration'],
  NULL,
  NULL,
  8,
  true
),
(
  'b1b2c3d4-0016-4000-8000-000000000016',
  '1.0.0',
  'trend',
  'AI Pair Programming Cannot Replace Human Collaboration',
  'AI reduces anxiety and boosts motivation, but research confirms it cannot match the collaborative depth of human pairing. Don''t isolate yourself. Maintain human mentorship relationships.',
  ARRAY[
    'Schedule human code reviews even when AI has "reviewed" your code',
    'Use AI for first-pass feedback, humans for architectural decisions',
    'Maintain human mentorship relationships - AI can''t provide career guidance'
  ],
  '{"type": "research", "url": "https://www.researchgate.net/publication/364417476", "author": "ResearchGate Study"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiCollaboration'],
  NULL,
  NULL,
  8,
  true
),

-- ============================================================================
-- iterationEfficiency Insights (2 new)
-- ============================================================================
(
  'b1b2c3d4-0017-4000-8000-000000000017',
  '1.0.0',
  'tool',
  '30% Faster Reviews: Use AI as Your First Reviewer',
  'AI code review cuts review time by 30% and enables faster PR merging. But this only works if you treat AI as the FIRST pass, not the ONLY pass. Let humans focus on architecture.',
  ARRAY[
    'Run AI review before human review to catch obvious issues',
    'Let humans focus on architecture and business logic, not syntax',
    'Track your review-to-merge time and optimize the handoff'
  ],
  '{"type": "blog", "url": "https://graphite.dev/blog/how-ai-code-review-reduces-review-cycles", "author": "Graphite"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency'],
  NULL,
  60,
  8,
  true
),
(
  'b1b2c3d4-0018-4000-8000-000000000018',
  '1.0.0',
  'tool',
  'Stop Blindly Accepting: Train Your AI with Feedback',
  'Blindly accepting AI suggestions wastes time on false positives. Implement feedback loops - mark false positives to improve accuracy over time. Review false positive rates monthly.',
  ARRAY[
    'Mark AI suggestions as false positive when wrong - this trains the system',
    'Create ignore patterns for recurring false alarms',
    'Review false positive rates monthly and tune sensitivity'
  ],
  '{"type": "blog", "url": "https://graphite.com/guides/ai-code-review-implementation-best-practices", "author": "Graphite Best Practices"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency'],
  NULL,
  60,
  8,
  true
),

-- ============================================================================
-- aiControl Insights (1 new)
-- ============================================================================
(
  'b1b2c3d4-0019-4000-8000-000000000019',
  '1.0.0',
  'trend',
  'Your New Role: From Coder to Supervisor',
  'With AI agents, your role shifts from "code writer" to "task definer, process supervisor, and final reviewer". Embrace this - don''t fight it. Define clear acceptance criteria BEFORE AI starts.',
  ARRAY[
    'Define clear acceptance criteria BEFORE AI starts coding',
    'Monitor AI progress at checkpoints, not just the final result',
    'Verify every output against requirements - AI doesn''t know your context fully'
  ],
  '{"type": "research", "url": "https://arxiv.org/html/2508.00083v1", "author": "arXiv Agentic Programming Survey"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl'],
  NULL,
  50,
  9,
  true
),

-- ============================================================================
-- Bonus: Community-sourced insights for extra coverage
-- ============================================================================
(
  'b1b2c3d4-0020-4000-8000-000000000020',
  '1.0.0',
  'tool',
  'Strategic vs Auto Compaction: Control Your Context',
  'Auto-compaction triggers at arbitrary points, often mid-task. Strategic compaction at logical boundaries preserves what matters and clears what doesn''t.',
  ARRAY[
    'Compact after planning phase, before execution',
    'Compact after debugging, before moving to next task',
    'Never compact mid-implementation - you''ll lose critical context'
  ],
  '{"type": "community", "url": "https://github.com/affaan-m/everything-claude-code", "author": "Everything Claude Code"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering'],
  NULL,
  NULL,
  7,
  true
),
(
  'b1b2c3d4-0021-4000-8000-000000000021',
  '1.0.0',
  'tool',
  'Your 200k Context Can Shrink to 70k - Here''s Why',
  'Too many MCP tools enabled at once dramatically shrink your effective context. Keep 20-30 configured, under 10 enabled, under 80 tools active.',
  ARRAY[
    'Audit your enabled MCPs regularly',
    'Use disabledMcpServers in project config',
    'Start minimal, add tools only when needed'
  ],
  '{"type": "community", "url": "https://github.com/affaan-m/everything-claude-code", "author": "Everything Claude Code"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering'],
  NULL,
  NULL,
  8,
  true
),
(
  'b1b2c3d4-0022-4000-8000-000000000022',
  '1.0.0',
  'tool',
  'The Four-Phase Workflow: Stop Jumping to Code',
  'Without exploration and planning, Claude jumps straight to coding. This wastes iterations on wrong approaches. Always: Explore, Plan, Code, Commit.',
  ARRAY[
    'Always start with "Read these files, don''t write code yet"',
    'Request a plan using thinking mode before implementation',
    'Explore -> Plan -> Code -> Commit, in that order'
  ],
  '{"type": "official", "url": "https://www.anthropic.com/engineering/claude-code-best-practices", "author": "Anthropic Engineering"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency', 'aiCollaboration'],
  NULL,
  NULL,
  9,
  true
),
(
  'b1b2c3d4-0023-4000-8000-000000000023',
  '1.0.0',
  'tool',
  'The 6-Phase Verification Loop Before Every PR',
  'Build -> Types -> Lint -> Tests -> Security -> Diff Review. Skip any phase and you ship bugs. 80% test coverage is the minimum, not the goal.',
  ARRAY[
    'Run /verify after every major change',
    '80% test coverage is the minimum, not the goal',
    'Security scan for secrets and console.logs before commit'
  ],
  '{"type": "community", "url": "https://github.com/affaan-m/everything-claude-code", "author": "Everything Claude Code"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency', 'aiControl'],
  NULL,
  NULL,
  8,
  true
),
(
  'b1b2c3d4-0024-4000-8000-000000000024',
  '1.0.0',
  'tool',
  'Two Claudes Are Better Than One',
  'Have one Claude write code while another reviews it independently. Separation of context improves quality and catches blind spots. Fresh context catches what tired context misses.',
  ARRAY[
    'Use git worktrees for parallel Claude instances',
    'Writing Claude shouldn''t review its own code',
    'Fresh context catches what tired context misses'
  ],
  '{"type": "official", "url": "https://www.anthropic.com/engineering/claude-code-best-practices", "author": "Anthropic Engineering"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl', 'iterationEfficiency'],
  NULL,
  NULL,
  8,
  true
)

ON CONFLICT (id) DO NOTHING;

-- Verify counts per dimension
DO $$
DECLARE
  dimension_record RECORD;
BEGIN
  RAISE NOTICE '=== Professional Insights by Dimension ===';
  FOR dimension_record IN
    SELECT
      unnest(applicable_dimensions) as dimension,
      COUNT(*) as count
    FROM professional_insights
    WHERE enabled = true
    GROUP BY unnest(applicable_dimensions)
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '%: % insights', dimension_record.dimension, dimension_record.count;
  END LOOP;
END$$;
