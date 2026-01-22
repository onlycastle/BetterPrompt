#!/usr/bin/env npx tsx
/**
 * Scanner Trace - 각 Phase에서 어떤 프로젝트가 남는지 추적
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

const PREFILTER_CONFIG = {
  MIN_FILE_SIZE: 5 * 1024,
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  MAX_CANDIDATES: 150,
  SIZE_WEIGHT: 0.3,
  RECENCY_WEIGHT: 0.7,
  IDEAL_SIZE_MIN: 100 * 1024,
  IDEAL_SIZE_MAX: 5 * 1024 * 1024,
  MIN_PROJECTS_IN_PREFILTER: 5,
  MAX_PER_PROJECT_IN_PREFILTER: 50,
};

interface FileMetadata {
  filePath: string;
  fileSize: number;
  mtime: Date;
  projectDirName: string;
}

function decodeProjectPath(encoded: string): string {
  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }
  return encoded;
}

function getProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

function getShortProjectName(dirName: string): string {
  const path = decodeProjectPath(dirName);
  return getProjectName(path);
}

async function collectAllFiles(): Promise<FileMetadata[]> {
  const allFiles: FileMetadata[] = [];

  const entries = await readdir(CLAUDE_PROJECTS_DIR);
  for (const entry of entries) {
    const fullPath = join(CLAUDE_PROJECTS_DIR, entry);
    try {
      const stats = await stat(fullPath);
      if (!stats.isDirectory()) continue;

      const files = await readdir(fullPath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const filePath = join(fullPath, file);
        try {
          const fstat = await stat(filePath);
          if (fstat.isFile()) {
            allFiles.push({
              filePath,
              fileSize: fstat.size,
              mtime: fstat.mtime,
              projectDirName: entry,
            });
          }
        } catch {}
      }
    } catch {}
  }

  return allFiles;
}

function countByProject(files: FileMetadata[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of files) {
    const name = getShortProjectName(f.projectDirName);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

function printProjectCounts(label: string, counts: Map<string, number>) {
  console.log(`\n${label}:`);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [_, c]) => s + c, 0);
  console.log(`   Total: ${total} files from ${sorted.length} projects`);
  for (const [name, count] of sorted.slice(0, 15)) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(count / total * 30));
    console.log(`   ${name.slice(0, 20).padEnd(20)} ${String(count).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  }
  if (sorted.length > 15) {
    console.log(`   ... and ${sorted.length - 15} more projects`);
  }
}

async function main() {
  console.log('\n🔍 SCANNER PROJECT TRACE\n');
  console.log('='.repeat(70));

  // Phase 1: All files
  const allFiles = await collectAllFiles();
  printProjectCounts('📁 PHASE 1: All JSONL files', countByProject(allFiles));

  // Phase 2a: Size filtered
  const sizeFiltered = allFiles.filter(
    f => f.fileSize >= PREFILTER_CONFIG.MIN_FILE_SIZE &&
         f.fileSize <= PREFILTER_CONFIG.MAX_FILE_SIZE
  );
  printProjectCounts('📏 PHASE 2a: After size filter (5KB-50MB)', countByProject(sizeFiltered));

  // Show what was filtered out
  const tooSmall = allFiles.filter(f => f.fileSize < PREFILTER_CONFIG.MIN_FILE_SIZE);
  const tooLarge = allFiles.filter(f => f.fileSize > PREFILTER_CONFIG.MAX_FILE_SIZE);

  console.log(`\n   ❌ Filtered out: ${tooSmall.length} too small, ${tooLarge.length} too large`);
  if (tooSmall.length > 0) {
    console.log(`   Too small by project:`);
    const smallCounts = countByProject(tooSmall);
    for (const [name, count] of [...smallCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`      ${name.slice(0, 20).padEnd(20)} ${count} files`);
    }
  }

  // Phase 2b: Pre-filter scoring
  if (sizeFiltered.length > 0) {
    const mtimes = sizeFiltered.map(f => f.mtime.getTime());
    const newestMtime = Math.max(...mtimes);
    const oldestMtime = Math.min(...mtimes);

    const scored = sizeFiltered.map(file => {
      let sizeScore: number;
      if (file.fileSize < PREFILTER_CONFIG.IDEAL_SIZE_MIN) {
        sizeScore = (file.fileSize / PREFILTER_CONFIG.IDEAL_SIZE_MIN) * 50;
      } else if (file.fileSize <= PREFILTER_CONFIG.IDEAL_SIZE_MAX) {
        sizeScore = 100;
      } else {
        const overSize = file.fileSize - PREFILTER_CONFIG.IDEAL_SIZE_MAX;
        const maxOverSize = PREFILTER_CONFIG.MAX_FILE_SIZE - PREFILTER_CONFIG.IDEAL_SIZE_MAX;
        sizeScore = Math.max(30, 100 - (overSize / maxOverSize) * 70);
      }

      const mtimeRange = newestMtime - oldestMtime;
      const recencyScore = mtimeRange > 0
        ? ((file.mtime.getTime() - oldestMtime) / mtimeRange) * 100
        : 100;

      const totalScore = sizeScore * PREFILTER_CONFIG.SIZE_WEIGHT + recencyScore * PREFILTER_CONFIG.RECENCY_WEIGHT;

      return { file, sizeScore, recencyScore, totalScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    // Show score distribution by project
    console.log(`\n📊 Pre-filter scores by project (avg recency score):`);
    const projectScores = new Map<string, number[]>();
    for (const s of scored) {
      const name = getShortProjectName(s.file.projectDirName);
      if (!projectScores.has(name)) projectScores.set(name, []);
      projectScores.get(name)!.push(s.recencyScore);
    }

    const avgScores = [...projectScores.entries()].map(([name, scores]) => ({
      name,
      avgRecency: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    })).sort((a, b) => b.avgRecency - a.avgRecency);

    for (const { name, avgRecency, count } of avgScores.slice(0, 15)) {
      const bar = '█'.repeat(Math.ceil(avgRecency / 100 * 20));
      console.log(`   ${name.slice(0, 20).padEnd(20)} avg=${avgRecency.toFixed(0).padStart(3)} (${count} files) ${bar}`);
    }

    // NEW: Project-capped selection (max 50 per project)
    const byProject = new Map<string, typeof scored>();
    for (const item of scored) {
      const project = item.file.projectDirName;
      if (!byProject.has(project)) byProject.set(project, []);
      byProject.get(project)!.push(item);
    }

    const projectCapped: typeof scored = [];
    for (const [_project, files] of byProject) {
      files.sort((a, b) => b.totalScore - a.totalScore);
      projectCapped.push(...files.slice(0, PREFILTER_CONFIG.MAX_PER_PROJECT_IN_PREFILTER));
    }
    projectCapped.sort((a, b) => b.totalScore - a.totalScore);

    const candidates = projectCapped.slice(0, PREFILTER_CONFIG.MAX_CANDIDATES).map(s => s.file);
    printProjectCounts('🎯 PHASE 2b: Top 150 candidates (with project cap of 50)', countByProject(candidates));

    // Show the score threshold
    const lastCandidate = projectCapped[PREFILTER_CONFIG.MAX_CANDIDATES - 1];
    const firstExcluded = projectCapped[PREFILTER_CONFIG.MAX_CANDIDATES];
    console.log(`\n   Score cutoff: ${lastCandidate?.totalScore.toFixed(1)} (last included) vs ${firstExcluded?.totalScore.toFixed(1)} (first excluded)`);

    // Show what got excluded
    const excludedFiles = projectCapped.slice(PREFILTER_CONFIG.MAX_CANDIDATES).map(s => s.file);
    const excludedCounts = countByProject(excludedFiles);
    if (excludedCounts.size > 0) {
      console.log(`\n   ❌ Excluded from top 150 (by project):`);
      for (const [name, count] of [...excludedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`      ${name.slice(0, 20).padEnd(20)} ${count} files excluded`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 NEW: Pre-filter now caps each project at 50 files for diversity.\n');
}

main().catch(console.error);
