#!/usr/bin/env npx tsx
/**
 * Scanner Debug Script
 *
 * Uses the actual scanner module to verify the pipeline works correctly.
 */

import { scanSessions } from './scanner.js';

async function main() {
  console.log('\n' + '🔬'.repeat(35));
  console.log('         SCANNER PIPELINE DIAGNOSTIC');
  console.log('🔬'.repeat(35) + '\n');

  console.log('Running scanSessions(50)...\n');

  const startTime = Date.now();
  const result = await scanSessions(50);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('=' .repeat(70));
  console.log('📈 SCAN RESULTS');
  console.log('='.repeat(70));

  console.log(`\n⏱️  Scan completed in ${elapsed}s`);
  console.log(`\n📊 Summary:`);
  console.log(`   Sessions returned:     ${result.sessions.length}`);
  console.log(`   Total messages:        ${result.totalMessages}`);
  console.log(`   Total duration:        ${result.totalDurationMinutes} minutes`);

  // Project distribution
  const projectCounts = new Map<string, number>();
  for (const s of result.sessions) {
    const project = s.metadata.projectName;
    projectCounts.set(project, (projectCounts.get(project) || 0) + 1);
  }

  console.log(`\n🗂️  Project distribution (${projectCounts.size} projects):`);
  const sortedProjects = [...projectCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [project, count] of sortedProjects) {
    console.log(`   ${project.slice(0, 30).padEnd(30)} ${count} sessions`);
  }

  // Quality score distribution
  const scores = result.sessions.map(s => s.metadata.qualityScore ?? 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  console.log(`\n⭐ Quality scores:`);
  console.log(`   Min: ${minScore}, Max: ${maxScore}, Avg: ${avgScore.toFixed(1)}`);

  // Score distribution
  const scoreRanges = { '90-100': 0, '70-89': 0, '50-69': 0, '30-49': 0, '0-29': 0 };
  for (const score of scores) {
    if (score >= 90) scoreRanges['90-100']++;
    else if (score >= 70) scoreRanges['70-89']++;
    else if (score >= 50) scoreRanges['50-69']++;
    else if (score >= 30) scoreRanges['30-49']++;
    else scoreRanges['0-29']++;
  }

  for (const [range, count] of Object.entries(scoreRanges)) {
    const bar = '█'.repeat(Math.ceil(count / result.sessions.length * 20));
    console.log(`   ${range.padEnd(10)} ${String(count).padStart(3)} ${bar}`);
  }

  // Session details
  console.log(`\n📝 Session details:`);
  console.log('   #  Project                  Score  Msgs  Duration  Date        Tools');
  console.log('   ' + '-'.repeat(85));

  for (let i = 0; i < result.sessions.length; i++) {
    const s = result.sessions[i];
    const tools = s.parsed.stats.uniqueToolsUsed.slice(0, 3).join(', ');
    const durationMin = Math.round(s.metadata.durationSeconds / 60);
    const date = s.metadata.timestamp.toISOString().split('T')[0];

    console.log(
      `   ${String(i + 1).padStart(2)}. ${s.metadata.projectName.slice(0, 22).padEnd(22)} ` +
      `${String(s.metadata.qualityScore ?? 0).padStart(3)}    ${String(s.metadata.messageCount).padStart(4)}  ` +
      `${String(durationMin).padStart(5)}m  ${date}  ${tools}`
    );
  }

  // Check if we reached target
  console.log('\n' + '='.repeat(70));
  if (result.sessions.length >= 50) {
    console.log('✅ TARGET ACHIEVED: 50 sessions successfully selected!');
  } else {
    console.log(`⚠️  Only ${result.sessions.length}/50 sessions found`);
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);
