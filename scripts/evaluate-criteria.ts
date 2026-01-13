#!/usr/bin/env npx tsx
/**
 * Evaluate Criteria CLI
 *
 * Analyzes collected content to evaluate the fitness of current evaluation criteria.
 *
 * Usage:
 *   npx tsx scripts/evaluate-criteria.ts analyze
 *   npx tsx scripts/evaluate-criteria.ts gaps
 *   npx tsx scripts/evaluate-criteria.ts report
 *   npx tsx scripts/evaluate-criteria.ts suggest
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  knowledgeStore,
  RELEVANCE_CRITERIA,
  type KnowledgeItem,
  type TopicCategory,
  type SourcePlatform,
  DISCOVERY_TOPICS,
} from '../src/search-agent/index.js';

// Report storage paths
const REPORTS_BASE_PATH = join(homedir(), '.nomoreaislop', 'reports');
const DISCOVERY_PATH = join(homedir(), '.nomoreaislop', 'discovery');
const CONTENT_FILE = join(DISCOVERY_PATH, 'content.json');

type Command = 'analyze' | 'gaps' | 'report' | 'suggest' | 'current' | 'help';

interface CriteriaStats {
  name: string;
  weight: number;
  coverage: number; // % of content scoring > 0.5
  avgScore: number;
  scoreVariance: number;
  highScoreTopics: string[];
  lowScoreTopics: string[];
}

interface GapAnalysis {
  uncoveredThemes: Array<{
    theme: string;
    frequency: number;
    examples: string[];
  }>;
  missingSignals: Array<{
    signal: string;
    reasoning: string;
    suggestedCriterion: string;
  }>;
}

interface CriteriaReport {
  generatedAt: string;
  summary: {
    totalContent: number;
    dateRange: { start: string; end: string };
    platformBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
  };
  currentCriteria: CriteriaStats[];
  gapAnalysis: GapAnalysis;
  recommendations: string[];
}

function showHelp() {
  console.log(`
Evaluate Criteria CLI

Analyze content to evaluate the fitness of current evaluation criteria.

Usage:
  npx tsx scripts/evaluate-criteria.ts <command> [options]

Commands:
  analyze          Analyze knowledge base against current criteria
  current          Show current criteria definitions
  gaps             Identify gaps in criteria coverage
  report           Generate full evaluation report
  suggest          Suggest new criteria based on analysis
  help             Show this help message

Examples:
  # Show current criteria
  npx tsx scripts/evaluate-criteria.ts current

  # Analyze criteria fitness
  npx tsx scripts/evaluate-criteria.ts analyze

  # Generate full report
  npx tsx scripts/evaluate-criteria.ts report
`);
}

function ensureReportsDir() {
  if (!existsSync(REPORTS_BASE_PATH)) {
    mkdirSync(REPORTS_BASE_PATH, { recursive: true });
  }
}

function loadDiscoveredContent(): Array<{
  text: string;
  topics: string[];
  platform: string;
}> {
  if (!existsSync(CONTENT_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(readFileSync(CONTENT_FILE, 'utf-8'));
    return data.map((item: any) => ({
      text: item.text || '',
      topics: item.detectedTopics || [],
      platform: item.platform || 'web',
    }));
  } catch {
    return [];
  }
}

function parseArgs(): { command: Command; args: string[] } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const command = args[0] as Command;
  return { command, args: args.slice(1) };
}

async function showCurrentCriteria() {
  console.log('\n📋 Current Relevance Criteria\n');
  console.log('━'.repeat(70));

  for (const criterion of RELEVANCE_CRITERIA) {
    console.log(`\n### ${criterion.name} (weight: ${criterion.weight * 100}%)`);
    console.log(`${criterion.description}\n`);

    console.log('✅ Positive Signals:');
    for (const signal of criterion.positiveSignals) {
      console.log(`   • ${signal}`);
    }

    console.log('\n❌ Negative Signals:');
    for (const signal of criterion.negativeSignals) {
      console.log(`   • ${signal}`);
    }
  }

  console.log('\n' + '━'.repeat(70));
  console.log('\n📊 Weight Distribution:');

  const totalWeight = RELEVANCE_CRITERIA.reduce((sum, c) => sum + c.weight, 0);
  for (const criterion of RELEVANCE_CRITERIA) {
    const pct = Math.round((criterion.weight / totalWeight) * 100);
    const bar = '█'.repeat(Math.floor(pct / 5));
    console.log(`   ${criterion.name.padEnd(20)} ${bar} ${pct}%`);
  }
}

async function analyzeKnowledge(): Promise<{
  items: KnowledgeItem[];
  stats: CriteriaStats[];
}> {
  await knowledgeStore.initialize();
  const items = await knowledgeStore.listItems();

  if (items.length === 0) {
    console.log('\n📭 No knowledge items in storage.');
    console.log('Run the discovery and learning pipeline first.\n');
    return { items: [], stats: [] };
  }

  console.log(`\n📊 Analyzing ${items.length} knowledge items...\n`);

  // Calculate stats for each criterion
  const stats: CriteriaStats[] = [];

  // Since we don't have per-criterion scores stored, we'll analyze based on overall patterns
  // In a real implementation, we'd need to score each item against each criterion

  for (const criterion of RELEVANCE_CRITERIA) {
    // Calculate metrics based on content analysis
    const scores = items.map((item) => {
      // Estimate how well this item matches the criterion based on content
      let score = 0.5; // Base score

      const textLower = (item.content + ' ' + item.summary + ' ' + item.title).toLowerCase();

      // Check positive signals
      for (const signal of criterion.positiveSignals) {
        const keywords = signal.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const matches = keywords.filter((kw) => textLower.includes(kw)).length;
        score += (matches / keywords.length) * 0.2;
      }

      // Check negative signals
      for (const signal of criterion.negativeSignals) {
        const keywords = signal.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const matches = keywords.filter((kw) => textLower.includes(kw)).length;
        score -= (matches / keywords.length) * 0.15;
      }

      return Math.max(0, Math.min(1, score));
    });

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const coverage = scores.filter((s) => s > 0.5).length / scores.length;

    // Analyze by category
    const categoryScores: Record<string, number[]> = {};
    items.forEach((item, i) => {
      if (!categoryScores[item.category]) {
        categoryScores[item.category] = [];
      }
      categoryScores[item.category].push(scores[i]);
    });

    const categoryAvgs = Object.entries(categoryScores)
      .map(([cat, catScores]) => ({
        category: cat,
        avg: catScores.reduce((a, b) => a + b, 0) / catScores.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    stats.push({
      name: criterion.name,
      weight: criterion.weight,
      coverage,
      avgScore,
      scoreVariance: variance,
      highScoreTopics: categoryAvgs.slice(0, 3).map((c) => c.category),
      lowScoreTopics: categoryAvgs.slice(-3).map((c) => c.category),
    });
  }

  return { items, stats };
}

async function showAnalysis() {
  const { items, stats } = await analyzeKnowledge();

  if (items.length === 0) return;

  console.log('━'.repeat(70));
  console.log('\n📈 Criteria Analysis Results\n');

  for (const stat of stats) {
    const coverageBar = '█'.repeat(Math.floor(stat.coverage * 20));
    const coveragePct = Math.round(stat.coverage * 100);

    console.log(`\n### ${stat.name}`);
    console.log(`   Weight: ${stat.weight * 100}%`);
    console.log(`   Coverage: ${coverageBar.padEnd(20)} ${coveragePct}%`);
    console.log(`   Avg Score: ${stat.avgScore.toFixed(2)}`);
    console.log(`   Variance: ${stat.scoreVariance.toFixed(3)} (${stat.scoreVariance > 0.1 ? 'good discrimination' : 'low discrimination'})`);
    console.log(`   High-score categories: ${stat.highScoreTopics.join(', ')}`);
    console.log(`   Low-score categories: ${stat.lowScoreTopics.join(', ')}`);
  }

  // Overall insights
  console.log('\n' + '━'.repeat(70));
  console.log('\n💡 Key Insights:\n');

  const lowCoverage = stats.filter((s) => s.coverage < 0.6);
  if (lowCoverage.length > 0) {
    console.log(`⚠️  Low coverage criteria (< 60%): ${lowCoverage.map((s) => s.name).join(', ')}`);
  }

  const lowVariance = stats.filter((s) => s.scoreVariance < 0.05);
  if (lowVariance.length > 0) {
    console.log(`⚠️  Low variance criteria (poor discrimination): ${lowVariance.map((s) => s.name).join(', ')}`);
  }

  // Check if vibe-coding is being captured
  const vibeCodingItems = items.filter(
    (item) =>
      item.content.toLowerCase().includes('vibe') ||
      item.tags.some((t) => t.toLowerCase().includes('vibe'))
  );
  console.log(`\n📌 Vibe Coding Content: ${vibeCodingItems.length} items (${Math.round((vibeCodingItems.length / items.length) * 100)}%)`);

  if (vibeCodingItems.length === 0) {
    console.log('   ⚠️  No vibe coding content found - criteria may not capture this topic');
  }
}

async function showGaps() {
  const { items, stats } = await analyzeKnowledge();

  if (items.length === 0) return;

  const discoveredContent = loadDiscoveredContent();

  console.log('\n🔍 Gap Analysis\n');
  console.log('━'.repeat(70));

  // Analyze discovered content topics vs knowledge base topics
  const discoveredTopics = new Map<string, number>();
  for (const content of discoveredContent) {
    for (const topic of content.topics) {
      discoveredTopics.set(topic, (discoveredTopics.get(topic) || 0) + 1);
    }
  }

  const knowledgeTopics = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) {
      knowledgeTopics.set(tag.toLowerCase(), (knowledgeTopics.get(tag.toLowerCase()) || 0) + 1);
    }
  }

  // Find topics in discovered content but not well-represented in knowledge
  const gaps: Array<{ topic: string; discovered: number; stored: number }> = [];

  for (const [topic, count] of discoveredTopics.entries()) {
    const storedCount = knowledgeTopics.get(topic.toLowerCase()) || 0;
    if (count >= 3 && storedCount < count * 0.3) {
      gaps.push({ topic, discovered: count, stored: storedCount });
    }
  }

  gaps.sort((a, b) => b.discovered - a.discovered);

  console.log('\n📊 Topic Coverage Gaps:\n');

  if (gaps.length === 0) {
    console.log('   ✅ No significant topic gaps found');
  } else {
    console.log('   Topic'.padEnd(30) + 'Discovered'.padEnd(15) + 'Stored');
    console.log('   ' + '─'.repeat(50));
    for (const gap of gaps.slice(0, 10)) {
      console.log(
        `   ${gap.topic.padEnd(30)}${gap.discovered.toString().padEnd(15)}${gap.stored}`
      );
    }
  }

  // Check for missing signals in criteria
  console.log('\n\n🔎 Missing Signals Analysis:\n');

  // Check if common AI engineering terms are in criteria
  const importantTerms = [
    'vibe coding',
    'vibe-based',
    'context engineering',
    'agentic',
    'human-AI collaboration',
    'cognitive offloading',
    'AI-first',
    'subagents',
    'multi-agent',
  ];

  const criteriaText = RELEVANCE_CRITERIA.flatMap((c) => [
    ...c.positiveSignals,
    ...c.negativeSignals,
  ])
    .join(' ')
    .toLowerCase();

  const missingTerms = importantTerms.filter(
    (term) => !criteriaText.includes(term.toLowerCase())
  );

  if (missingTerms.length > 0) {
    console.log('   Terms NOT in current criteria:');
    for (const term of missingTerms) {
      console.log(`   • "${term}"`);
    }
  } else {
    console.log('   ✅ All important terms are covered');
  }

  // Recommend criteria updates
  console.log('\n\n📝 Recommended Criteria Updates:\n');

  if (missingTerms.includes('vibe coding') || missingTerms.includes('vibe-based')) {
    console.log('   1. Add to topicRelevance positiveSignals:');
    console.log('      "Discusses vibe coding or vibe-based development approach"');
  }

  if (missingTerms.includes('human-AI collaboration')) {
    console.log('   2. Add to projectFit positiveSignals:');
    console.log('      "Describes human-AI collaboration patterns and practices"');
  }

  if (missingTerms.includes('agentic')) {
    console.log('   3. Add to topicRelevance positiveSignals:');
    console.log('      "Covers agentic AI workflows or autonomous coding agents"');
  }
}

async function generateReport() {
  const { items, stats } = await analyzeKnowledge();

  if (items.length === 0) return;

  const discoveredContent = loadDiscoveredContent();

  // Generate comprehensive report
  const report: CriteriaReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalContent: items.length,
      dateRange: {
        start:
          items.length > 0
            ? items.reduce((min, i) => (i.createdAt < min ? i.createdAt : min), items[0].createdAt)
            : new Date().toISOString(),
        end:
          items.length > 0
            ? items.reduce((max, i) => (i.createdAt > max ? i.createdAt : max), items[0].createdAt)
            : new Date().toISOString(),
      },
      platformBreakdown: {},
      categoryBreakdown: {},
    },
    currentCriteria: stats,
    gapAnalysis: {
      uncoveredThemes: [],
      missingSignals: [],
    },
    recommendations: [],
  };

  // Platform breakdown
  for (const item of items) {
    report.summary.platformBreakdown[item.source.platform] =
      (report.summary.platformBreakdown[item.source.platform] || 0) + 1;
    report.summary.categoryBreakdown[item.category] =
      (report.summary.categoryBreakdown[item.category] || 0) + 1;
  }

  // Generate recommendations
  for (const stat of stats) {
    if (stat.coverage < 0.6) {
      report.recommendations.push(
        `Criterion "${stat.name}" has low coverage (${Math.round(stat.coverage * 100)}%). Consider reviewing its signals.`
      );
    }
    if (stat.scoreVariance < 0.05) {
      report.recommendations.push(
        `Criterion "${stat.name}" has low variance, suggesting poor discrimination. Consider more specific signals.`
      );
    }
  }

  // Check for vibe coding gap
  const criteriaText = RELEVANCE_CRITERIA.flatMap((c) => [
    ...c.positiveSignals,
    ...c.negativeSignals,
  ])
    .join(' ')
    .toLowerCase();

  if (!criteriaText.includes('vibe')) {
    report.recommendations.push(
      'Add "vibe coding" and "vibe-based development" to topicRelevance positiveSignals to capture this emerging topic.'
    );
    report.gapAnalysis.missingSignals.push({
      signal: 'vibe coding / vibe-based development',
      reasoning: 'Emerging AI development philosophy not captured by current criteria',
      suggestedCriterion: 'topicRelevance',
    });
  }

  // Save report
  ensureReportsDir();
  const reportPath = join(
    REPORTS_BASE_PATH,
    `criteria-evaluation-${new Date().toISOString().split('T')[0]}.json`
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Display summary
  console.log('\n📑 Criteria Evaluation Report\n');
  console.log('━'.repeat(70));
  console.log(`\nGenerated: ${report.generatedAt}`);
  console.log(`Total Content: ${report.summary.totalContent}`);
  console.log(`Date Range: ${report.summary.dateRange.start.split('T')[0]} to ${report.summary.dateRange.end.split('T')[0]}`);

  console.log('\n📊 Platform Distribution:');
  for (const [platform, count] of Object.entries(report.summary.platformBreakdown)) {
    const pct = Math.round((count / items.length) * 100);
    console.log(`   ${platform.padEnd(15)} ${count} (${pct}%)`);
  }

  console.log('\n📁 Category Distribution:');
  for (const [category, count] of Object.entries(report.summary.categoryBreakdown)) {
    const pct = Math.round((count / items.length) * 100);
    console.log(`   ${category.padEnd(25)} ${count} (${pct}%)`);
  }

  console.log('\n📋 Criteria Performance:');
  for (const stat of report.currentCriteria) {
    console.log(`   ${stat.name.padEnd(20)} Coverage: ${Math.round(stat.coverage * 100)}% | Avg: ${stat.avgScore.toFixed(2)}`);
  }

  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    for (const rec of report.recommendations) {
      console.log(`   • ${rec}`);
    }
  }

  console.log(`\n✅ Full report saved to: ${reportPath}`);
}

async function suggestCriteria() {
  console.log('\n💡 Suggested Criteria Updates\n');
  console.log('━'.repeat(70));

  console.log('\nBased on analysis of AI engineering content trends, here are suggested updates:\n');

  console.log('## 1. Update topicRelevance positiveSignals\n');
  console.log('Add these signals:');
  console.log('```typescript');
  console.log("'Discusses vibe coding or vibe-based AI development approach',");
  console.log("'Covers agentic AI workflows or autonomous coding agents',");
  console.log("'Describes context engineering techniques for LLMs',");
  console.log('```\n');

  console.log('## 2. Update projectFit positiveSignals\n');
  console.log('Add these signals:');
  console.log('```typescript');
  console.log("'Describes human-AI collaboration patterns and practices',");
  console.log("'Provides cognitive offloading strategies for AI-assisted work',");
  console.log('```\n');

  console.log('## 3. Consider New Criterion: "Vibe Alignment"\n');
  console.log('```typescript');
  console.log('{');
  console.log("  name: 'vibeAlignment',");
  console.log('  weight: 0.10,');
  console.log("  description: 'Does this embrace vibe-based AI development philosophy?',");
  console.log('  positiveSignals: [');
  console.log("    'Describes intuitive, flow-based AI collaboration',");
  console.log("    'Emphasizes trust in AI capabilities while maintaining oversight',");
  console.log("    'Discusses natural language-first development approach',");
  console.log('  ],');
  console.log('  negativeSignals: [');
  console.log("    'Overly rigid or ceremony-heavy processes',");
  console.log("    'Distrust of AI-generated code quality',");
  console.log('  ],');
  console.log('}');
  console.log('```\n');

  console.log('## 4. File to Modify\n');
  console.log('Edit: src/search-agent/skills/judge/criteria.ts\n');

  console.log('━'.repeat(70));
  console.log('\nTo apply these changes, edit the criteria.ts file directly.');
}

async function main() {
  const { command, args } = parseArgs();

  switch (command) {
    case 'current':
      await showCurrentCriteria();
      break;

    case 'analyze':
      await showAnalysis();
      break;

    case 'gaps':
      await showGaps();
      break;

    case 'report':
      await generateReport();
      break;

    case 'suggest':
      await suggestCriteria();
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
