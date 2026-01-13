#!/usr/bin/env npx tsx
/**
 * Populate Knowledge Base
 *
 * Directly saves curated AI engineering content to the knowledge store.
 * Bypasses the LLM pipeline for manual curation.
 */

import { randomUUID } from 'node:crypto';
import {
  knowledgeDb,
  type KnowledgeItem,
  type TopicCategory,
  type ContentType,
  type SourcePlatform,
} from '../src/search-agent/index.js';

interface CuratedContent {
  url: string;
  title: string;
  summary: string;
  content: string;
  category: TopicCategory;
  contentType: ContentType;
  platform: SourcePlatform;
  author?: string;
  authorHandle?: string;
  tags: string[];
  relevanceScore: number;
}

const CURATED_CONTENT: CuratedContent[] = [
  {
    url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
    title: 'Effective Context Engineering for AI Agents - Anthropic Official Guide',
    summary: 'Anthropic\'s official guide to context engineering, explaining strategies for managing LLM context windows including system prompts, tools design, compaction, and sub-agent architectures.',
    content: `Context engineering represents a fundamental shift in AI development. Rather than focusing solely on prompt wording, it emphasizes "thoughtfully curating what information enters the model's limited attention budget at each step."

Definition: Context engineering involves strategically managing all tokens available to an LLM—including system instructions, tools, examples, and message history—to optimize performance within inherent constraints.

Why Context Matters: LLMs face a critical limitation called "context rot" - as context windows expand, models experience reduced precision for information retrieval and reasoning.

Key Strategies:
1. System Prompts - Use clear, direct language at the "right altitude"
2. Tools Design - Minimize overlap, enable dynamic context pulling
3. Few-Shot Examples - Curate diverse canonical examples

Long-Horizon Techniques:
- Compaction: Summarize approaching context limits
- Structured Note-Taking: Persistent memory files like NOTES.md
- Sub-Agent Architectures: Specialized agents with clean context windows

Guiding Principle: "Find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome."`,
    category: 'context-engineering',
    contentType: 'reference',
    platform: 'web',
    author: 'Anthropic Engineering',
    tags: ['context-engineering', 'anthropic', 'official', 'context-window', 'compaction', 'sub-agents'],
    relevanceScore: 0.95,
  },
  {
    url: 'https://blog.langchain.com/context-engineering-for-agents/',
    title: 'Context Engineering for Agents: Four Core Strategies - LangChain',
    summary: 'LangChain\'s comprehensive guide to context engineering covering the four core strategies: Write, Select, Compress, and Isolate, with practical implementation guidance.',
    content: `Context engineering represents the strategic practice of managing an LLM's context window by ensuring the right information is available at each step.

As Andrej Karpathy characterizes it: "the delicate art and science of filling the context window with just the right information for the next step."

Four Core Strategies:

1. WRITE Context - Preserve information outside the active context window.
   - Scratchpads: Save intermediate findings persistently
   - Memory Systems: Episodic, procedural, and semantic memories

2. SELECT Context - Retrieve relevant information strategically.
   - Tools & Instructions: Use files like CLAUDE.md
   - Knowledge Retrieval: AST parsing, semantic chunking, knowledge graphs

3. COMPRESS Context - Reduce token consumption.
   - Summarization: Auto-compact at 95% utilization
   - Trimming/Pruning: Remove older messages with heuristics

4. ISOLATE Context - Partition across processing units.
   - Multi-Agent Architectures: Specialized sub-agents
   - Environmental Isolation: Keep heavy objects outside context`,
    category: 'context-engineering',
    contentType: 'technique',
    platform: 'web',
    author: 'LangChain',
    authorHandle: 'langaboratory',
    tags: ['context-engineering', 'langchain', 'write-select-compress-isolate', 'memory', 'rag'],
    relevanceScore: 0.92,
  },
  {
    url: 'https://www.humanlayer.dev/blog/writing-a-good-claude-md',
    title: 'Writing a Good CLAUDE.md: Best Practices for Under 60 Lines',
    summary: 'HumanLayer\'s guide to writing effective CLAUDE.md files, recommending under 300 lines (ideally <60), with WHY/WHAT/HOW structure and progressive disclosure.',
    content: `CLAUDE.md is the only file that by default goes into every single conversation you have with the agent. This makes it a critical onboarding tool.

Recommended Structure (WHY/WHAT/HOW):
- WHAT: Project tech stack, structure, codebase map
- WHY: Project purpose and component functions
- HOW: Development workflow, package managers, testing

Length Guidelines:
- Maximum: under 300 lines
- Ideal: Less than 60 lines (HumanLayer's approach)
- Content must be universally applicable

Key Principles:
- "Less (instructions) is more"
- LLMs follow 150-200 instructions reliably
- Claude Code already has ~50 system instructions
- Performance degrades uniformly as count increases

Progressive Disclosure:
- Store task-specific guidance in separate files
- "Prefer pointers to copies"
- Reference without duplicating

What NOT to Include:
- Code style guidelines (use linters instead)
- "Never send an LLM to do a linter's job"`,
    category: 'workflow-automation',
    contentType: 'pattern',
    platform: 'web',
    author: 'HumanLayer',
    tags: ['claude-md', 'claude-code', 'best-practices', 'configuration', 'progressive-disclosure'],
    relevanceScore: 0.90,
  },
  {
    url: 'https://shipyard.build/blog/claude-code-subagents-guide/',
    title: 'Claude Code Subagents Quickstart: Creating Specialized AI Assistants',
    summary: 'Comprehensive guide to creating and managing Claude Code subagents, including example personas (Architect, Reviewer, Debugger, DevOps) and best practices for team structure.',
    content: `Claude Code's subagents are specialized Claude instances with focused expertise areas. Rather than relying on a generalist agent, create specialists with tailored system prompts.

Key Benefits:
- Token Efficiency: Each subagent has its own context window
- Better Results: Superior outcomes for domain-specific work

How to Create:
1. Check version (≥1.0.60): claude --version
2. Run /agents command
3. Choose scope: Project-level or user-level
4. Configure: Name, model, system prompt, tool access

Example Personas:
- System Architect: Design patterns, optimization, scalability
- Code Reviewer: Security, performance, quality
- Debugger: Trace execution, analyze logs
- DevOps Engineer: Docker, Kubernetes, CI/CD

Best Practices:
- Acknowledge Limitations: Prevents hallucinations
- Encourage Critical Thinking: "be critical, honest, realistic"
- Add Adversarial Elements: Make agents opinionated
- Ask Follow-Ups: "why make this change?"

Optimal Team: Start with 1-3 subagents, max 3-4 total.`,
    category: 'subagents',
    contentType: 'technique',
    platform: 'web',
    author: 'Shipyard',
    tags: ['subagents', 'claude-code', 'multi-agent', 'personas', 'context-management'],
    relevanceScore: 0.88,
  },
  {
    url: 'https://dev.to/oikon/24-claude-code-tips-claudecodeadventcalendar-52b5',
    title: '24 Claude Code Tips: Advent of Claude 2025 Collection',
    summary: 'Complete collection of 24 Claude Code tips from December 2025, covering statusline, thinking modes, MCP, Skills, subagents, hooks, permissions, and parallel execution.',
    content: `Key Claude Code Tips from December 2025 Advent Calendar:

1. Opus 4.5 Migration: Watch for "excessive tool invocations"
2. Statusline: /statusline <content> for persistent info display
3. Web Tasks: Prefix with & for remote sandbox execution
4. Thinking: Only "ultrathink" activates extended thinking
5. MCP Context: Tools consume 8-30% of context when available
6. Skills + Subagents: YAML frontmatter to combine them
7. Project Rules: .claude/rules/ for topic-specific Markdown
8. CLAUDE.md Loading: ./CLAUDE.md or ./.claude/CLAUDE.md
9. Permission Safety: permissions.deny and permissions.ask
10. Sandbox: /sandbox restricts to working directory
11. Hooks: UserPromptSubmit and PreToolUse for filtering
12. Post-Edit Formatting: PostToolUse hooks for formatters
13. External Editor: Ctrl+G with VISUAL env var
14. Plan Mode: Shift+Tab, saves to ~/.claude/plans/
15. Skills Best Practices: SKILL.md under 500 lines
16. Auto-compact: 32k buffer (22.5% of 200k context)
17. Async Subagents: Parallel exploration
18. Parallel Execution: Same-branch or git worktree`,
    category: 'claude-code-skills',
    contentType: 'reference',
    platform: 'web',
    author: 'Ado (Anthropic DevRel)',
    authorHandle: 'adocomplete',
    tags: ['claude-code', 'tips', 'advent-calendar', 'hooks', 'skills', 'subagents', '2025'],
    relevanceScore: 0.91,
  },
  {
    url: 'https://www.technologyreview.com/2025/11/05/1127477/from-vibe-coding-to-context-engineering-2025/',
    title: 'From Vibe Coding to Context Engineering: 2025 Software Development Evolution',
    summary: 'MIT Technology Review analysis of 2025\'s shift from vibe coding to context engineering, including the "vibe coding hangover" and emergence of sustainable AI-assisted engineering practices.',
    content: `2025 marked evolution in AI-assisted development. While "vibe coding" captured early attention, "context engineering" emerged as the mature approach.

Vibe Coding:
- Coined by Andrej Karpathy (February 2025)
- "Give in to vibes, embrace exponentials, forget code exists"
- Collins Dictionary Word of the Year 2025
- Best for: Prototyping, hackathons, personal projects

The "Vibe Coding Hangover":
- 18 CTOs reported production disasters (Final Round AI survey)
- "Development hell" with AI-generated code
- Issues: Security flaws, fragile debugging, unmaintainability

Context Engineering Emerges:
- Sustainable approach for production systems
- Manages information flow to AI models
- Human developers remain critical
- Architecture, review, security require oversight

Key Insight: Vibe coding accelerates exploration but introduces hidden liabilities. Professional AI-assisted engineering requires human oversight and responsible code review.`,
    category: 'best-practices',
    contentType: 'insight',
    platform: 'web',
    author: 'MIT Technology Review',
    tags: ['vibe-coding', 'context-engineering', 'karpathy', 'production', 'best-practices', '2025'],
    relevanceScore: 0.87,
  },
  {
    url: 'https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills',
    title: 'Agent Skills: Anthropic Open Standard for Modular AI Autonomy',
    summary: 'Anthropic\'s December 2025 announcement of Agent Skills open standard, enabling modular packaging of procedural knowledge with progressive disclosure for efficient context usage.',
    content: `Agent Skills are organized folders of instructions, scripts, and resources that agents can discover and load dynamically.

Launched December 18, 2025 as an open standard to transform AI into specialized, autonomous experts.

Key Design:
- Progressive Disclosure: Skills take few dozen tokens when summarized
- Full details load only when task requires
- Extensive libraries without overwhelming working memory

Structure:
- Modular framework for procedural knowledge
- Solves interoperability challenges
- Reduces "context cost" of multi-step workflows

Relationship to MCP:
- MCP = "plumbing" (database/API connections)
- Agent Skills = "manual" (how to achieve specific goals)

Enterprise Partners:
- Atlassian: Jira tickets, Confluence docs
- Stripe: Financial operations, refunds, audits

Foundation News:
- December 9: MCP donated to Linux Foundation
- Anthropic + OpenAI co-founded Agentic AI Foundation
- Members: Google, Microsoft, AWS`,
    category: 'claude-code-skills',
    contentType: 'reference',
    platform: 'web',
    author: 'Anthropic Engineering',
    tags: ['agent-skills', 'anthropic', 'open-standard', 'mcp', 'modular', 'december-2025'],
    relevanceScore: 0.93,
  },
];

function createKnowledgeItem(content: CuratedContent): KnowledgeItem {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    version: '1.0.0',
    title: content.title,
    summary: content.summary,
    content: content.content,
    category: content.category,
    contentType: content.contentType,
    tags: content.tags,
    source: {
      platform: content.platform,
      url: content.url,
      author: content.author,
      authorHandle: content.authorHandle,
      fetchedAt: now,
      credibilityTier: 'high',
    },
    relevance: {
      score: content.relevanceScore,
      confidence: 0.95,
      reasoning: 'Manually curated high-quality content from authoritative source',
    },
    createdAt: now,
    updatedAt: now,
    status: 'approved',
  };
}

async function main() {
  console.log('\n🚀 Populating Knowledge Base (Direct Mode)\n');
  console.log('━'.repeat(60));
  console.log(`\nProcessing ${CURATED_CONTENT.length} curated content items...\n`);

  try {
    let saved = 0;
    let skipped = 0;

    for (const content of CURATED_CONTENT) {
      const item = createKnowledgeItem(content);

      // Check for duplicates
      const isDuplicate = await knowledgeDb.hasItemByUrl(content.url);

      if (isDuplicate) {
        console.log(`   ⏭️  Skipped (duplicate): ${content.title.slice(0, 50)}...`);
        skipped++;
        continue;
      }

      await knowledgeDb.save(item);
      console.log(`   ✅ Saved: [${item.category}] ${item.title.slice(0, 50)}...`);
      saved++;
    }

    // Get stats
    const stats = await knowledgeDb.getStats();

    console.log('\n' + '━'.repeat(60));
    console.log('\n✅ Knowledge Base Population Complete!\n');
    console.log('📊 Results:');
    console.log(`   Saved: ${saved}`);
    console.log(`   Skipped (duplicates): ${skipped}`);
    console.log(`   Total in store: ${stats.totalItems}`);

    console.log('\n📁 Category Breakdown:');
    for (const [category, count] of Object.entries(stats.byCategory)) {
      if (count > 0) {
        console.log(`   ${category}: ${count}`);
      }
    }

    console.log('\n💡 Next Steps:');
    console.log('   npx tsx scripts/browse-knowledge.ts list');
    console.log('   npx tsx scripts/browse-knowledge.ts stats');
    console.log('   npx tsx scripts/browse-knowledge.ts search "context engineering"');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
