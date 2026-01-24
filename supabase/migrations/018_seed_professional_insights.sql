-- Migration: Seed professional_insights with initial data
-- Source: Canonical INITIAL_INSIGHTS from src/lib/domain/models/knowledge.ts

-- Use ON CONFLICT DO NOTHING for idempotency (allows re-running without duplicates)
-- We use fixed UUIDs based on title hash for consistent seeding

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
-- Diagnosis Insights
-- ============================================================================
(
  'a1b2c3d4-0001-4000-8000-000000000001',
  '1.0.0',
  'diagnosis',
  'Skill Atrophy Self-Diagnosis',
  'The VCP research shows that heavy AI reliance can lead to skill decay. Test yourself: can you start coding without AI help?',
  ARRAY[
    'Try writing pseudocode or specs before involving AI',
    'Once a week, solve a small problem without AI assistance',
    'If you can''t explain code AI generated, that''s a warning sign'
  ],
  '{"type": "arxiv", "url": "https://arxiv.org/abs/2601.02410", "author": "VCP Research Team"}'::jsonb,
  '{}',
  '{}',
  ARRAY['skillResilience'],
  NULL,
  50,
  9,
  true
),
(
  'a1b2c3d4-0002-4000-8000-000000000002',
  '1.0.0',
  'diagnosis',
  'The 50% Modification Test',
  'Professional developers modify about 50% of AI-generated code. If you accept everything unchanged, you may be too passive.',
  ARRAY[
    'Track how often you modify AI suggestions this week',
    'Challenge at least one AI response per session with "are you sure?"',
    'If your modification rate is under 30%, you''re likely missing errors'
  ],
  '{"type": "research", "url": "https://twitter.com/elikidd/status/example", "author": "elvis"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl'],
  NULL,
  40,
  8,
  true
),
(
  'a1b2c3d4-0009-4000-8000-000000000009',
  '1.0.0',
  'diagnosis',
  'AI Dependency Checklist',
  'Answer honestly: Could you write this code without AI? If not, you may be developing learned helplessness.',
  ARRAY[
    'Before using AI: ''Could I start this myself?''',
    'After AI generates: ''Do I understand every line?''',
    'Weekly: Solve one problem without AI to maintain skills'
  ],
  '{"type": "research", "url": "https://twitter.com/rohanpaul/example", "author": "Rohan Paul"}'::jsonb,
  '{}',
  '{}',
  ARRAY['skillResilience', 'aiControl'],
  NULL,
  40,
  8,
  true
),
(
  'a1b2c3d4-0012-4000-8000-000000000012',
  '1.0.0',
  'diagnosis',
  'Sunk Cost Fallacy in AI Prompting',
  'When AI fails repeatedly with the same approach, continuing to tweak the prompt is a sunk cost fallacy. Reset context and try a fundamentally different approach.',
  ARRAY[
    'If the same error occurs 3+ times, reset context completely and start fresh',
    'Analyze error messages before retrying - understand what went wrong',
    'Don''t let frustration drive your prompts - take a breath and rethink',
    'Recognize AI''s limitations - some tasks may need a different tool or manual approach'
  ],
  '{"type": "research", "url": "https://nomoreaislop.com/insights/sunk-cost-fallacy", "author": "NoMoreAISlop Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl', 'skillResilience'],
  NULL,
  50,
  9,
  true
),
(
  'a1b2c3d4-0013-4000-8000-000000000013',
  '1.0.0',
  'diagnosis',
  'Trust but Verify: Critical Thinking in AI Collaboration',
  'Professional developers verify AI output before accepting. Passive acceptance leads to bugs, security issues, and skill atrophy.',
  ARRAY[
    'Ask ''are you sure?'' at least once per complex task',
    'Run tests before accepting AI-generated code',
    'Question AI assumptions - ask why it chose a particular approach',
    'Request alternatives for important decisions'
  ],
  '{"type": "research", "url": "https://nomoreaislop.com/insights/trust-but-verify", "author": "NoMoreAISlop Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl', 'skillResilience'],
  NULL,
  NULL,
  9,
  true
),
(
  'a1b2c3d4-0014-4000-8000-000000000014',
  '1.0.0',
  'diagnosis',
  'Iteration Efficiency Assessment',
  'Efficient developers complete iteration cycles in 2-3 turns on average. More than 5 turns indicates unclear requirements or wrong approach.',
  ARRAY[
    'Be specific about what to change before iterating',
    'Consider a new approach after 4+ turns',
    'Document successful patterns'
  ],
  '{"type": "research", "url": "https://nomoreaislop.com/insights/iteration-efficiency", "author": "NoMoreAISlop Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency'],
  NULL,
  60,
  8,
  true
),
(
  'a1b2c3d4-0015-4000-8000-000000000015',
  '1.0.0',
  'diagnosis',
  'Learning Velocity in AI-Assisted Development',
  'Top developers use AI as a learning accelerator, not a knowledge replacement. Ask "why" as often as "how".',
  ARRAY[
    'After asking "how", ask "why this approach?"',
    'Record recurring patterns - they are learning opportunities',
    'Periodically implement without AI'
  ],
  '{"type": "research", "url": "https://nomoreaislop.com/insights/learning-velocity", "author": "Educational Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['learningVelocity', 'skillResilience'],
  NULL,
  NULL,
  9,
  true
),
(
  'a1b2c3d4-0018-4000-8000-000000000018',
  '1.0.0',
  'diagnosis',
  'The "Why" Question Test',
  'Count how many times you asked "why" in a session. Zero means no knowledge transfer is happening.',
  ARRAY[
    'After receiving code, ask "why this approach?"',
    'When using a library, confirm "why this library?"',
    'Don''t skip over parts you don''t understand - ask questions'
  ],
  '{"type": "research", "url": "https://nomoreaislop.com/insights/why-question-test", "author": "Educational Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['learningVelocity'],
  NULL,
  50,
  9,
  true
),
(
  'a1b2c3d4-0024-4000-8000-000000000024',
  '1.0.0',
  'diagnosis',
  'Treat Context Like Memory Allocation',
  'Context window is like RAM - finite and precious. Loading unnecessary files or long chat history causes "context OOM". Be deliberate about what you load.',
  ARRAY[
    'Only read files you actually need',
    'Use /compact before context becomes bloated',
    'Clear context when switching tasks',
    'Monitor for signs of context exhaustion: repeated mistakes, forgotten instructions'
  ],
  '{"type": "official", "url": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents", "author": "Anthropic"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering'],
  NULL,
  70,
  9,
  true
),

-- ============================================================================
-- Trend Insights
-- ============================================================================
(
  'a1b2c3d4-0003-4000-8000-000000000003',
  '1.0.0',
  'trend',
  'New Skill Layer: Context Engineering',
  'Karpathy says vibe coding is a new skill layer like mobile dev or cloud computing. Those who master it will thrive.',
  ARRAY[
    'Treat context engineering as a skill to deliberately practice',
    'Learn your AI tool''s context window limits and how to manage them',
    'Use /compact and fresh sessions strategically'
  ],
  '{"type": "x-post", "url": "https://twitter.com/karpathy/status/example", "author": "Andrej Karpathy", "engagement": {"likes": 55000}}'::jsonb,
  '{}',
  '{}',
  '{}',
  NULL,
  NULL,
  10,
  true
),
(
  'a1b2c3d4-0004-4000-8000-000000000004',
  '1.0.0',
  'trend',
  'The 80% Planning Rule',
  'Top developers spend 80% of their time planning and 20% executing. With AI, this ratio matters even more.',
  ARRAY[
    'Write a brief plan.md before starting any complex feature',
    'Define acceptance criteria before asking AI to implement',
    'Use TodoWrite to structure your work'
  ],
  '{"type": "blog", "url": "https://example.com/planning", "author": "Peter Yang"}'::jsonb,
  ARRAY['architect', 'collaborator'],
  '{}',
  '{}',
  NULL,
  NULL,
  7,
  true
),
(
  'a1b2c3d4-0010-4000-8000-000000000010',
  '1.0.0',
  'trend',
  'From Vibe Coding to Context Engineering',
  'MIT Technology Review: The 2025 paradigm shift is from "vibe coding" to "context engineering". Professionals control, not follow.',
  ARRAY[
    'Think of AI as a tool you control, not a partner you follow',
    'Your job is to provide perfect context, not perfect prompts',
    'Master your context window like you mastered your IDE'
  ],
  '{"type": "blog", "url": "https://www.technologyreview.com/2025/11/05/1127477/from-vibe-coding-to-context-engineering-2025-in-software-development/", "author": "MIT Technology Review"}'::jsonb,
  '{}',
  '{}',
  '{}',
  NULL,
  NULL,
  10,
  true
),
(
  'a1b2c3d4-0016-4000-8000-000000000016',
  '1.0.0',
  'trend',
  'Scope Management for AI Collaboration',
  'Clear scope determines AI collaboration success. "Do only this" works better than "do this and that".',
  ARRAY[
    'Request one task per prompt',
    'Don''t add new tasks before completing current ones',
    'Use "first X, then Y" pattern'
  ],
  '{"type": "research", "url": "https://nomoreaislop.com/insights/scope-management", "author": "NoMoreAISlop Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['scopeManagement'],
  NULL,
  NULL,
  8,
  true
),
(
  'a1b2c3d4-0020-4000-8000-000000000020',
  '1.0.0',
  'trend',
  'Task Decomposition: The A→A1→A2→A3→B Pattern',
  'Break complex tasks into numbered subtasks. Complete each subtask before moving to the next. This prevents scope creep and improves AI focus.',
  ARRAY[
    'Decompose tasks: "First do A1, then A2, then A3, then B"',
    'Verify each subtask completion before proceeding',
    'Keep subtasks small enough to complete in 1-2 AI turns'
  ],
  '{"type": "blog", "url": "https://github.com/ykdojo/claude-code-tips", "author": "Claude Code Tips"}'::jsonb,
  '{}',
  '{}',
  ARRAY['scopeManagement', 'aiCollaboration'],
  NULL,
  NULL,
  8,
  true
),
(
  'a1b2c3d4-0022-4000-8000-000000000022',
  '1.0.0',
  'trend',
  'Cascade Pattern: Parallel AI Instances',
  'Run multiple Claude instances in parallel for independent tasks. One researches while another implements. Use terminal multiplexers like tmux.',
  ARRAY[
    'Use tmux/screen to manage multiple Claude sessions',
    'Split independent tasks across parallel sessions',
    'Let one session research while another codes'
  ],
  '{"type": "blog", "url": "https://github.com/ykdojo/claude-code-tips", "author": "Claude Code Tips"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency', 'toolMastery'],
  70,
  NULL,
  7,
  true
),
(
  'a1b2c3d4-0025-4000-8000-000000000025',
  '1.0.0',
  'trend',
  'Simple Agents Beat Complex Ones',
  'Research from Anthropic shows simple, well-prompted agents outperform complex multi-step frameworks. Invest in prompts, not orchestration complexity.',
  ARRAY[
    'Start with the simplest agent architecture that works',
    'Add complexity only when simple approaches fail',
    'Prefer explicit instructions over implicit inference'
  ],
  '{"type": "official", "url": "https://www.anthropic.com/engineering/building-effective-agents", "author": "Anthropic Engineering"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiCollaboration', 'toolMastery'],
  60,
  NULL,
  8,
  true
),

-- ============================================================================
-- Type-Specific Insights
-- ============================================================================
(
  'a1b2c3d4-0005-4000-8000-000000000005',
  '1.0.0',
  'type-specific',
  'For Speedrunners: Quick Verification',
  'You can be fast AND accurate. Add 30-second sanity checks to maintain quality without losing velocity.',
  ARRAY[
    'Before accepting: "Does this actually solve my problem?"',
    'Run the simplest possible test before moving on',
    'Quick mental review: "What could go wrong here?"'
  ],
  '{"type": "x-post", "url": "https://twitter.com/example/speedrunner-tips", "author": "hashin"}'::jsonb,
  ARRAY['speedrunner'],
  ARRAY['explorer', 'navigator'],
  '{}',
  NULL,
  NULL,
  8,
  true
),
(
  'a1b2c3d4-0007-4000-8000-000000000007',
  '1.0.0',
  'type-specific',
  'For Architects: Validate Against Your Plans',
  'Your planning strength is an asset. Use your plans as verification checkpoints to ensure AI output matches your design.',
  ARRAY[
    'After AI implements: check against your plan item by item',
    'Ask AI to verify its output matches your specifications',
    'Don''t let AI deviate from your architecture without discussion'
  ],
  '{"type": "blog", "url": "https://example.com/architect-tips", "author": "Matt Pocock"}'::jsonb,
  ARRAY['architect'],
  '{}',
  '{}',
  NULL,
  NULL,
  7,
  true
),
(
  'a1b2c3d4-0008-4000-8000-000000000008',
  '1.0.0',
  'type-specific',
  'For Scientists: Inverted TDD',
  'Your verification instinct is powerful. Try "Inverted TDD": write tests first, then have AI implement to pass them.',
  ARRAY[
    'Write test cases that define expected behavior',
    'Ask AI to implement code that passes your tests',
    'Your tests catch hallucinations automatically'
  ],
  '{"type": "research", "url": "https://twitter.com/example/inverted-tdd", "author": "Bohrium"}'::jsonb,
  ARRAY['scientist'],
  '{}',
  '{}',
  NULL,
  NULL,
  7,
  true
),
(
  'a1b2c3d4-0017-4000-8000-000000000017',
  '1.0.0',
  'type-specific',
  'Targeted Refinement vs Shotgun Debugging',
  'Telling AI "change only this part" yields more accurate edits. Requesting a full redo changes other parts too.',
  ARRAY[
    'Specify exact location when requesting edits',
    '"Edit only this function" instead of "redo everything"',
    'Request multiple edits one at a time'
  ],
  '{"type": "x-post", "url": "https://twitter.com/example/targeted-refinement", "author": "AI Engineering"}'::jsonb,
  '{}',
  '{}',
  ARRAY['iterationEfficiency', 'aiCollaboration'],
  NULL,
  NULL,
  7,
  true
),
(
  'a1b2c3d4-0026-4000-8000-000000000026',
  '1.0.0',
  'type-specific',
  'The Write-Test-Verify Cycle',
  'After AI generates code, always run tests before accepting. This catches hallucinations and ensures the code actually works.',
  ARRAY[
    'Run "npm test" or equivalent after each significant change',
    'Ask AI to write tests first, then implement',
    'Never merge AI code without running the full test suite'
  ],
  '{"type": "official", "url": "https://www.anthropic.com/engineering/claude-code-best-practices", "author": "Anthropic Engineering"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiControl', 'skillResilience'],
  NULL,
  NULL,
  9,
  true
),

-- ============================================================================
-- Tool Insights
-- ============================================================================
(
  'a1b2c3d4-0006-4000-8000-000000000006',
  '1.0.0',
  'tool',
  'Anthropic Context Engineering Techniques',
  'Anthropic recommends three key techniques: Compaction (summarize and restart), Sub-agents (delegate), and Just-in-Time retrieval.',
  ARRAY[
    'Use /compact when context gets messy or AI performance degrades',
    'Delegate complex subtasks to specialized agents via Task tool',
    'Only load documentation when you actually need it'
  ],
  '{"type": "official", "url": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents", "author": "Anthropic"}'::jsonb,
  '{}',
  '{}',
  ARRAY['aiCollaboration', 'toolMastery'],
  NULL,
  NULL,
  9,
  true
),
(
  'a1b2c3d4-0011-4000-8000-000000000011',
  '1.0.0',
  'tool',
  'The 50% Context Rule',
  'Research shows ~50% context window utilization is optimal. Above 70%, LLM performance degrades and hallucination risk increases.',
  ARRAY[
    'Use /compact command when sessions get long',
    'Start fresh sessions for new tasks instead of continuing old ones',
    'Delegate to subagents to distribute context load',
    'Monitor your context usage - if AI responses degrade, context may be overloaded'
  ],
  '{"type": "research", "url": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents", "author": "Anthropic Research"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering'],
  NULL,
  60,
  9,
  true
),
(
  'a1b2c3d4-0019-4000-8000-000000000019',
  '1.0.0',
  'tool',
  'Fresh Sessions Outperform Continued Context',
  'Starting new sessions often yields better results than continuing degraded context. Use /compact or restart when AI responses become incoherent.',
  ARRAY[
    'Start fresh sessions for new distinct tasks',
    'Use /compact to summarize and clear when context degrades',
    'Recognize context exhaustion: repetitive errors, ignoring instructions'
  ],
  '{"type": "blog", "url": "https://github.com/ykdojo/claude-code-tips", "author": "Claude Code Tips"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering', 'iterationEfficiency'],
  NULL,
  60,
  9,
  true
),
(
  'a1b2c3d4-0021-4000-8000-000000000021',
  '1.0.0',
  'tool',
  'Keep MCP Servers Under 10 for Optimal Context',
  'Each MCP server consumes context window tokens. More than 10 servers can significantly degrade performance by reducing available context for actual work.',
  ARRAY[
    'Audit your MCP configuration regularly',
    'Remove unused or rarely-used MCP servers',
    'Consolidate related functionality into fewer servers'
  ],
  '{"type": "blog", "url": "https://github.com/affaan-m/everything-claude-code", "author": "Everything Claude Code"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering', 'toolMastery'],
  NULL,
  NULL,
  7,
  true
),
(
  'a1b2c3d4-0027-4000-8000-000000000027',
  '1.0.0',
  'tool',
  'Keep CLAUDE.md Minimal and Focused',
  'CLAUDE.md is loaded into every conversation. Bloated instructions waste context. Focus on project-specific rules, not general coding advice.',
  ARRAY[
    'Include only project-specific conventions and rules',
    'Avoid generic coding best practices (Claude already knows them)',
    'Review and prune CLAUDE.md monthly',
    'Use .cursorrules or .windsurfrules for editor-specific config'
  ],
  '{"type": "blog", "url": "https://github.com/ykdojo/claude-code-tips", "author": "Claude Code Tips"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering'],
  50,
  NULL,
  8,
  true
),
(
  'a1b2c3d4-0023-4000-8000-000000000023',
  '1.0.0',
  'tool',
  'Terminal Aliases Reduce Friction',
  'Create short aliases for common Claude commands. "cc" for "claude", "ccc" for "claude --continue". Small friction reductions compound.',
  ARRAY[
    'Add "alias cc=claude" to your shell config',
    'Create "ccc" for --continue, "ccr" for --resume',
    'Document aliases in your personal notes for consistency'
  ],
  '{"type": "blog", "url": "https://github.com/ykdojo/claude-code-tips", "author": "Claude Code Tips"}'::jsonb,
  '{}',
  '{}',
  ARRAY['toolMastery'],
  NULL,
  NULL,
  6,
  true
),
(
  'a1b2c3d4-0028-4000-8000-000000000028',
  '1.0.0',
  'tool',
  'Reduce System Prompt to Recover 10k+ Tokens',
  'Heavy system prompts (CLAUDE.md, MCP tools) can consume 10k+ tokens before you even start. Audit and trim for meaningful context gains.',
  ARRAY[
    'Use /cost command to check token usage',
    'Remove redundant MCP servers from configuration',
    'Keep CLAUDE.md under 500 lines',
    'Prefer project-level over global CLAUDE.md rules'
  ],
  '{"type": "blog", "url": "https://github.com/ykdojo/claude-code-tips", "author": "Claude Code Tips"}'::jsonb,
  '{}',
  '{}',
  ARRAY['contextEngineering', 'toolMastery'],
  70,
  NULL,
  8,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Verify seed count
DO $$
DECLARE
  insight_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO insight_count FROM professional_insights;
  RAISE NOTICE 'Professional insights seeded: % total', insight_count;
END$$;
