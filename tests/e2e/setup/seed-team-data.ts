/**
 * Playwright E2E Test Data Seeder
 *
 * Seeds the local SQLite database with realistic team data for enterprise
 * dashboard E2E tests. Works as a Playwright globalSetup module.
 *
 * Architecture:
 * - User creation: direct SQLite (no user-creation API exists)
 * - Org/team/member creation: via REST API (POST /api/org, /api/teams, etc.)
 * - Analysis sync: via REST API (POST /api/analysis/sync)
 *
 * The local auth model always returns the first user as the "current user",
 * so we create the owner first, then additional member users directly in SQLite.
 * The team member API looks up users by email, so DB-level user rows must exist.
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:3000';
const SEED_SLUG = 'e2e-test-org';

// ---------------------------------------------------------------------------
// Seeded Data Shape (returned for test consumption)
// ---------------------------------------------------------------------------

export interface SeededMember {
  userId: string;
  email: string;
  name: string;
  role: string;
  teamId: string;
  resultIds: string[];
}

export interface SeededTeam {
  teamId: string;
  name: string;
  description: string;
}

export interface SeededData {
  organizationId: string;
  organizationSlug: string;
  teams: SeededTeam[];
  members: SeededMember[];
}

// ---------------------------------------------------------------------------
// Direct DB helpers (users must exist before API calls)
// ---------------------------------------------------------------------------

function getDb() {
  // Dynamic import to avoid bundling issues -- this runs in Node.js globalSetup
  // Use path.resolve for reliable resolution regardless of CWD
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dbPath = require('node:path').resolve(__dirname, '../../../src/lib/local/database');
  const { getDatabase } = require(dbPath);
  return getDatabase();
}

function createUserDirectly(id: string, email: string, role = 'member'): void {
  const db = getDb();
  const now = new Date().toISOString();

  // Upsert: skip if email already exists (idempotent reruns)
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email) as { id: string } | undefined;

  if (existing) return;

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, '', ?, ?, ?)
  `).run(id, email, role, now, now);
}

function setUserOrganization(userId: string, orgId: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET organization_id = ? WHERE id = ?').run(orgId, userId);
}

function createAnalysisRecordDirectly(
  userId: string,
  evaluation: Record<string, unknown>,
  activitySessions: Array<Record<string, unknown>>,
  claimedAt: string,
): string {
  const db = getDb();
  const resultId = randomUUID().slice(0, 12);

  db.prepare(`
    INSERT INTO analysis_results (
      result_id, user_id, evaluation_json, phase1_output_json,
      canonical_run_json, activity_sessions_json,
      created_at, claimed_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)
  `).run(
    resultId,
    userId,
    JSON.stringify(evaluation),
    JSON.stringify(activitySessions),
    claimedAt,
    claimedAt,
    claimedAt,
  );

  return resultId;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function api<T = unknown>(
  baseUrl: string,
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as T;
  return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Member profiles
// ---------------------------------------------------------------------------

interface MemberProfile {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  teamIndex: number; // which team to assign (0 or 1)
  primaryType: 'architect' | 'analyst' | 'conductor' | 'speedrunner' | 'trendsetter';
  controlLevel: 'explorer' | 'navigator' | 'cartographer';
  distribution: { architect: number; analyst: number; conductor: number; speedrunner: number; trendsetter: number };
  // Base scores for the most recent week; older weeks are derived from trend
  domainScores: {
    thinkingQuality: number;
    communicationPatterns: number;
    learningBehavior: number;
    contextEfficiency: number;
    sessionOutcome: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  weeklyDelta: number; // score delta per week backward (positive = was lower before)
  antiPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: 'high' | 'medium' | 'low';
  }>;
  projects: string[];
  personalitySummary: string;
}

const MEMBER_PROFILES: MemberProfile[] = [
  // 1. Senior Architect -- high scores, improving
  {
    id: 'e2e-user-architect-001',
    email: 'alice.chen@e2e-test.com',
    name: 'Alice Chen',
    role: 'admin',
    teamIndex: 0,
    primaryType: 'architect',
    controlLevel: 'cartographer',
    distribution: { architect: 45, analyst: 20, conductor: 15, speedrunner: 10, trendsetter: 10 },
    domainScores: {
      thinkingQuality: 88,
      communicationPatterns: 82,
      learningBehavior: 85,
      contextEfficiency: 90,
      sessionOutcome: 84,
    },
    trend: 'improving',
    weeklyDelta: 4,
    antiPatterns: [],
    projects: ['payment-service', 'auth-gateway', 'infra-terraform'],
    personalitySummary: 'A strategic architect who meticulously plans system structure before implementation. Excels at breaking complex problems into well-defined tasks and maintaining clear separation of concerns across service boundaries.',
  },
  // 2. Junior Speedrunner -- lower scores, improving fast
  {
    id: 'e2e-user-speedrunner-002',
    email: 'bob.kim@e2e-test.com',
    name: 'Bob Kim',
    role: 'member',
    teamIndex: 0,
    primaryType: 'speedrunner',
    controlLevel: 'explorer',
    distribution: { architect: 10, analyst: 15, conductor: 10, speedrunner: 50, trendsetter: 15 },
    domainScores: {
      thinkingQuality: 52,
      communicationPatterns: 58,
      learningBehavior: 55,
      contextEfficiency: 48,
      sessionOutcome: 60,
    },
    trend: 'improving',
    weeklyDelta: 6,
    antiPatterns: [
      { pattern: 'context_bloat', frequency: 8, impact: 'high' },
      { pattern: 'no_session_separation', frequency: 5, impact: 'medium' },
      { pattern: 'verbose_error_pasting', frequency: 4, impact: 'medium' },
    ],
    projects: ['frontend-dashboard', 'mobile-app'],
    personalitySummary: 'A fast-moving speedrunner who favors rapid iteration over upfront planning. Shows strong improvement trajectory but still struggles with context management and session hygiene.',
  },
  // 3. Mid Analyst -- stable, consistent scores
  {
    id: 'e2e-user-analyst-003',
    email: 'carol.jones@e2e-test.com',
    name: 'Carol Jones',
    role: 'member',
    teamIndex: 0,
    primaryType: 'analyst',
    controlLevel: 'navigator',
    distribution: { architect: 20, analyst: 40, conductor: 15, speedrunner: 15, trendsetter: 10 },
    domainScores: {
      thinkingQuality: 68,
      communicationPatterns: 65,
      learningBehavior: 70,
      contextEfficiency: 67,
      sessionOutcome: 66,
    },
    trend: 'stable',
    weeklyDelta: 1,
    antiPatterns: [
      { pattern: 'redundant_info', frequency: 3, impact: 'low' },
    ],
    projects: ['data-pipeline', 'analytics-service', 'ml-models'],
    personalitySummary: 'A methodical analyst who approaches problems with data-driven precision. Maintains consistent quality across sessions with a focus on understanding before acting.',
  },
  // 4. Senior Conductor -- high but declining
  {
    id: 'e2e-user-conductor-004',
    email: 'dave.patel@e2e-test.com',
    name: 'Dave Patel',
    role: 'admin',
    teamIndex: 1,
    primaryType: 'conductor',
    controlLevel: 'cartographer',
    distribution: { architect: 15, analyst: 15, conductor: 45, speedrunner: 15, trendsetter: 10 },
    domainScores: {
      thinkingQuality: 78,
      communicationPatterns: 80,
      learningBehavior: 72,
      contextEfficiency: 75,
      sessionOutcome: 82,
    },
    trend: 'declining',
    weeklyDelta: -3,
    antiPatterns: [
      { pattern: 'late_compact', frequency: 4, impact: 'medium' },
      { pattern: 'prompt_length_inflation', frequency: 3, impact: 'low' },
    ],
    projects: ['platform-core', 'ci-cd-pipeline', 'monitoring-stack', 'team-tooling'],
    personalitySummary: 'An experienced conductor who orchestrates AI tools with confidence. Recent decline suggests potential burnout from overextended responsibilities across too many projects.',
  },
  // 5. Trendsetter -- mixed scores, many anti-patterns
  {
    id: 'e2e-user-trendsetter-005',
    email: 'eva.martinez@e2e-test.com',
    name: 'Eva Martinez',
    role: 'member',
    teamIndex: 1,
    primaryType: 'trendsetter',
    controlLevel: 'explorer',
    distribution: { architect: 10, analyst: 10, conductor: 10, speedrunner: 20, trendsetter: 50 },
    domainScores: {
      thinkingQuality: 72,
      communicationPatterns: 55,
      learningBehavior: 78,
      contextEfficiency: 42,
      sessionOutcome: 65,
    },
    trend: 'stable',
    weeklyDelta: 2,
    antiPatterns: [
      { pattern: 'context_bloat', frequency: 10, impact: 'high' },
      { pattern: 'no_knowledge_persistence', frequency: 7, impact: 'high' },
      { pattern: 'verbose_error_pasting', frequency: 6, impact: 'medium' },
      { pattern: 'no_session_separation', frequency: 5, impact: 'medium' },
      { pattern: 'redundant_info', frequency: 4, impact: 'low' },
    ],
    projects: ['experimental-ai-agent', 'hackathon-prototype'],
    personalitySummary: 'A creative trendsetter who eagerly explores cutting-edge AI capabilities but lacks discipline in context management. High learning potential offset by poor session hygiene habits.',
  },
];

// ---------------------------------------------------------------------------
// Evaluation builder
// ---------------------------------------------------------------------------

/**
 * Build a VerboseEvaluation-compatible object for a given member profile
 * at a specific point in time (weekOffset = 0 is latest, 1 = one week ago, etc.)
 */
function buildEvaluation(
  profile: MemberProfile,
  weekOffset: number,
): Record<string, unknown> {
  // Compute scores for this point in time
  const delta = profile.weeklyDelta * weekOffset;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const scores = {
    thinkingQuality: clamp(profile.domainScores.thinkingQuality - delta),
    communicationPatterns: clamp(profile.domainScores.communicationPatterns - delta),
    learningBehavior: clamp(profile.domainScores.learningBehavior - delta),
    contextEfficiency: clamp(profile.domainScores.contextEfficiency - delta),
    sessionOutcome: clamp(profile.domainScores.sessionOutcome - delta),
  };

  // Build workerInsights (the key field the team mapper reads)
  const workerInsights: Record<string, unknown> = {};

  const domainConfigs: Array<{
    key: string;
    label: string;
    strengthTitle: string;
    strengthDesc: string;
    growthTitle: string;
    growthDesc: string;
    growthRec: string;
    growthSeverity: string;
  }> = [
    {
      key: 'thinkingQuality',
      label: 'Thinking Quality',
      strengthTitle: 'Strategic Problem Decomposition',
      strengthDesc: 'Consistently breaks complex problems into well-structured sub-tasks before diving into implementation, resulting in cleaner architecture and fewer rework cycles across sessions.',
      growthTitle: 'Alternative Solution Exploration',
      growthDesc: 'Tends to commit to the first viable solution without systematically evaluating alternative approaches. This pattern limits creative problem-solving and may miss more elegant solutions to complex challenges.',
      growthRec: 'Before implementing, spend 2 minutes listing at least 3 possible approaches with trade-offs, then pick the best fit for the constraints at hand.',
      growthSeverity: 'medium',
    },
    {
      key: 'communicationPatterns',
      label: 'Communication Patterns',
      strengthTitle: 'Clear Intent Communication',
      strengthDesc: 'Articulates goals and constraints with precision, enabling the AI to produce targeted responses. Prompts consistently include the "what", "why", and acceptance criteria for tasks being delegated.',
      growthTitle: 'Context Provision for Complex Tasks',
      growthDesc: 'When tackling multi-step tasks, often assumes the AI retains full context from earlier exchanges without re-establishing relevant constraints or intermediate results in new prompts.',
      growthRec: 'For multi-step workflows, start each new prompt with a brief 1-2 sentence recap of the current state and what has been accomplished so far before stating the next task.',
      growthSeverity: 'medium',
    },
    {
      key: 'learningBehavior',
      label: 'Learning Behavior',
      strengthTitle: 'Rapid Knowledge Absorption',
      strengthDesc: 'Quickly incorporates feedback from AI responses into subsequent prompts, demonstrating an effective learning loop. Rarely repeats the same mistake pattern across sessions within the same project.',
      growthTitle: 'Cross-Project Knowledge Transfer',
      growthDesc: 'Patterns learned in one project context are not consistently applied when starting work on a different project, leading to repeated discovery of solutions that were already found elsewhere.',
      growthRec: 'Maintain a personal CLAUDE.md or project knowledge file that captures reusable patterns, and reference it when starting new project sessions.',
      growthSeverity: 'low',
    },
    {
      key: 'contextEfficiency',
      label: 'Context Efficiency',
      strengthTitle: 'Efficient Context Window Usage',
      strengthDesc: 'Maintains clean context windows by using session separation, compact commands, and targeted file references rather than pasting entire files into the conversation.',
      growthTitle: 'Context Bloat Prevention',
      growthDesc: 'Sessions occasionally grow to near-capacity context fill without proactive compaction, leading to degraded response quality in later turns when the model must work with truncated or compressed input.',
      growthRec: 'Monitor context fill percentage and proactively use /compact when approaching 70% rather than waiting for degradation symptoms to appear.',
      growthSeverity: 'high',
    },
    {
      key: 'sessionOutcome',
      label: 'Session Outcome',
      strengthTitle: 'Goal-Oriented Session Management',
      strengthDesc: 'Begins most sessions with a clear objective and systematically works toward completion, resulting in high task completion rates and efficient use of AI collaboration time.',
      growthTitle: 'Session Scope Creep',
      growthDesc: 'Occasionally allows sessions to expand beyond their original scope by tackling tangential tasks mid-session, which fragments focus and reduces the overall completion quality of the primary objective.',
      growthRec: 'When a tangential task arises mid-session, note it in a TODO comment and start a fresh session for it rather than context-switching in place.',
      growthSeverity: 'medium',
    },
  ];

  for (const config of domainConfigs) {
    const score = scores[config.key as keyof typeof scores];
    // Only include growth areas if score is below 75
    const growthAreas = score < 75 ? [{
      title: config.growthTitle,
      description: config.growthDesc,
      evidence: [{
        utteranceId: `${profile.id}_session1_${Math.floor(Math.random() * 20)}`,
        quote: `Example from ${profile.name}'s session showing ${config.growthTitle.toLowerCase()}`,
        context: `During ${profile.projects[0] ?? 'project'} development`,
      }],
      recommendation: config.growthRec,
      severity: config.growthSeverity,
    }] : [];

    workerInsights[config.key] = {
      strengths: [{
        title: config.strengthTitle,
        description: config.strengthDesc,
        evidence: [{
          utteranceId: `${profile.id}_session1_${Math.floor(Math.random() * 20)}`,
          quote: `Evidence from ${profile.name} demonstrating ${config.strengthTitle.toLowerCase()}`,
          context: `Working on ${profile.projects[0] ?? 'project'}`,
        }],
      }],
      growthAreas,
      domainScore: score,
    };
  }

  // Build agentOutputs for anti-pattern extraction
  const agentOutputs = profile.antiPatterns.length > 0 ? {
    efficiency: {
      inefficiencyPatterns: profile.antiPatterns.map(ap => ({
        pattern: ap.pattern,
        frequency: ap.frequency,
        impact: ap.impact,
      })),
    },
  } : undefined;

  return {
    sessionId: `e2e-sync-${profile.id}-week${weekOffset}`,
    analyzedAt: weekDate(weekOffset),
    sessionsAnalyzed: 3 + Math.floor(Math.random() * 5),

    primaryType: profile.primaryType,
    controlLevel: profile.controlLevel,
    controlScore: profile.controlLevel === 'cartographer' ? 85
      : profile.controlLevel === 'navigator' ? 60 : 35,
    distribution: profile.distribution,

    personalitySummary: profile.personalitySummary,
    promptPatterns: [],
    workerInsights,
    agentOutputs,

    pipelineTokenUsage: {
      stages: [],
      totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
    },
  };
}

// ---------------------------------------------------------------------------
// Activity session builder
// ---------------------------------------------------------------------------

function buildActivitySessions(
  profile: MemberProfile,
  weekOffset: number,
): Array<Record<string, unknown>> {
  const baseDate = new Date(weekDate(weekOffset));
  const sessionsCount = 2 + Math.floor(Math.random() * 3);

  return Array.from({ length: sessionsCount }, (_, i) => {
    const sessionDate = new Date(baseDate);
    sessionDate.setDate(sessionDate.getDate() + i);
    const project = profile.projects[i % profile.projects.length];

    return {
      sessionId: `e2e-session-${profile.id}-w${weekOffset}-s${i}`,
      projectName: project,
      startTime: sessionDate.toISOString(),
      durationMinutes: 15 + Math.floor(Math.random() * 90),
      messageCount: 5 + Math.floor(Math.random() * 30),
      summary: buildSessionSummary(project, i),
    };
  });
}

function buildSessionSummary(project: string, index: number): string {
  const summaries: Record<string, string[]> = {
    'payment-service': [
      'Implemented Stripe webhook handler with idempotency keys',
      'Refactored payment retry logic to use exponential backoff',
      'Added comprehensive error handling for declined transactions',
    ],
    'auth-gateway': [
      'Set up OAuth 2.0 PKCE flow for mobile clients',
      'Migrated session storage from JWT to opaque tokens',
      'Implemented rate limiting on login endpoints',
    ],
    'infra-terraform': [
      'Provisioned ECS Fargate cluster for staging environment',
      'Configured CloudWatch alarms for API latency P99',
      'Set up VPC peering between production and analytics accounts',
    ],
    'frontend-dashboard': [
      'Built responsive data table component with virtual scrolling',
      'Implemented client-side filtering and search with debounce',
      'Added dark mode theme toggle with system preference detection',
    ],
    'mobile-app': [
      'Integrated push notification service with FCM',
      'Optimized list rendering with FlashList for 60fps scroll',
      'Added offline-first data sync with conflict resolution',
    ],
    'data-pipeline': [
      'Designed Kafka consumer for real-time event processing',
      'Implemented exactly-once delivery with transactional outbox',
      'Added dead-letter queue handling with retry backpressure',
    ],
    'analytics-service': [
      'Built aggregation pipeline for daily active user metrics',
      'Implemented cohort analysis query with materialized views',
      'Added A/B test statistical significance calculation',
    ],
    'ml-models': [
      'Fine-tuned classification model on updated training data',
      'Implemented feature store integration for real-time inference',
      'Added model performance monitoring with drift detection',
    ],
    'platform-core': [
      'Extracted shared middleware into reusable platform package',
      'Implemented distributed tracing with OpenTelemetry',
      'Added graceful shutdown handling for long-running tasks',
    ],
    'ci-cd-pipeline': [
      'Migrated CI from Jenkins to GitHub Actions with matrix builds',
      'Added automated canary deployment with rollback triggers',
      'Implemented test splitting for parallel execution',
    ],
    'monitoring-stack': [
      'Deployed Grafana dashboards for SLI/SLO tracking',
      'Configured PagerDuty integration with severity-based routing',
      'Added custom Prometheus exporter for business metrics',
    ],
    'team-tooling': [
      'Built internal CLI tool for environment provisioning',
      'Created Slack bot for deployment status notifications',
      'Implemented code review assignment algorithm based on expertise',
    ],
    'experimental-ai-agent': [
      'Prototyped multi-agent orchestration with tool-use chains',
      'Experimented with ReAct prompting for autonomous debugging',
      'Built evaluation harness for agent task completion accuracy',
    ],
    'hackathon-prototype': [
      'Rapid prototyped voice-to-code interface in 48 hours',
      'Integrated speech recognition with real-time code generation',
      'Built demo UI with live streaming transcription display',
    ],
  };

  const projectSummaries = summaries[project] ?? [
    `Working on ${project} - session ${index + 1}`,
    `Continued development on ${project}`,
    `Bug fixes and improvements for ${project}`,
  ];

  return projectSummaries[index % projectSummaries.length];
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function weekDate(weekOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - weekOffset * 7);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Core seeding logic
// ---------------------------------------------------------------------------

export async function seedTeamData(baseUrl = DEFAULT_BASE_URL): Promise<SeededData> {
  console.log('[E2E Seed] Starting team data seeding...');

  // Step 1: Create all users directly in SQLite
  // The first user must be the "local" admin (org owner).
  // Other users are created for team member lookups.
  console.log('[E2E Seed] Creating users in database...');
  for (const profile of MEMBER_PROFILES) {
    createUserDirectly(profile.id, profile.email, profile.role === 'owner' ? 'admin' : 'member');
  }

  // Step 2: Create organization via API
  // The API uses getCurrentUserFromRequest() which returns the first user by created_at.
  // We need to ensure the org owner IS the first user. In local-auth, the auto-created
  // "local@localhost" user is always first. So we work with that user as the owner.
  console.log('[E2E Seed] Creating organization...');

  // Check if org already exists (idempotent)
  const existingOrg = await api<{ organization?: { id: string } }>(baseUrl, '/api/org');
  let organizationId: string;

  if (existingOrg.status === 200 && existingOrg.data?.organization?.id) {
    organizationId = existingOrg.data.organization.id;
    console.log(`[E2E Seed] Organization already exists: ${organizationId}`);
  } else {
    const orgResult = await api<{ id: string }>(baseUrl, '/api/org', 'POST', {
      name: 'E2E Test Company',
      slug: SEED_SLUG,
    });

    if (orgResult.status !== 201) {
      throw new Error(`Failed to create organization: ${JSON.stringify(orgResult.data)}`);
    }
    organizationId = orgResult.data.id;
    console.log(`[E2E Seed] Organization created: ${organizationId}`);
  }

  // Step 3: Assign all member users to the organization (direct DB)
  // The API only sets org_id for the owner; we need all members in the org
  for (const profile of MEMBER_PROFILES) {
    setUserOrganization(profile.id, organizationId);
  }

  // Step 4: Create teams via API
  console.log('[E2E Seed] Creating teams...');
  const teamDefs = [
    { name: 'Platform Engineering', description: 'Core platform, infrastructure, and developer tooling' },
    { name: 'Product Development', description: 'User-facing features, integrations, and experiments' },
  ];

  const teams: SeededTeam[] = [];

  // Check existing teams first
  const existingTeams = await api<Array<{ id: string; name: string; description: string }>>(
    baseUrl, '/api/teams',
  );
  const existingTeamMap = new Map(
    (Array.isArray(existingTeams.data) ? existingTeams.data : [])
      .map(t => [t.name, t]),
  );

  for (const def of teamDefs) {
    const existing = existingTeamMap.get(def.name);
    if (existing) {
      teams.push({ teamId: existing.id, name: existing.name, description: existing.description ?? def.description });
      console.log(`[E2E Seed] Team already exists: ${existing.name} (${existing.id})`);
      continue;
    }

    const teamResult = await api<{ id: string; name: string; description: string }>(
      baseUrl, '/api/teams', 'POST', def,
    );

    if (teamResult.status !== 201) {
      throw new Error(`Failed to create team "${def.name}": ${JSON.stringify(teamResult.data)}`);
    }

    teams.push({
      teamId: teamResult.data.id,
      name: teamResult.data.name,
      description: teamResult.data.description ?? def.description,
    });
    console.log(`[E2E Seed] Team created: ${teamResult.data.name} (${teamResult.data.id})`);
  }

  // Step 5: Add members to teams via API
  console.log('[E2E Seed] Adding members to teams...');
  const members: SeededMember[] = [];

  for (const profile of MEMBER_PROFILES) {
    const team = teams[profile.teamIndex];
    if (!team) {
      throw new Error(`Invalid teamIndex ${profile.teamIndex} for profile ${profile.email}`);
    }

    // Check if member already exists on team
    const existingMembers = await api<Array<{ userId: string }>>(
      baseUrl, `/api/teams/${team.teamId}/members`,
    );
    const alreadyMember = Array.isArray(existingMembers.data) &&
      existingMembers.data.some(m => m.userId === profile.id);

    if (!alreadyMember) {
      const memberResult = await api(
        baseUrl,
        `/api/teams/${team.teamId}/members`,
        'POST',
        { email: profile.email, role: profile.role },
      );

      if (memberResult.status !== 201) {
        console.warn(
          `[E2E Seed] Warning: Could not add ${profile.email} to team ${team.name}: ` +
          `${JSON.stringify(memberResult.data)}`,
        );
      } else {
        console.log(`[E2E Seed] Added ${profile.email} to ${team.name} as ${profile.role}`);
      }
    } else {
      console.log(`[E2E Seed] ${profile.email} already in ${team.name}`);
    }

    // Step 6: Create analysis results for this member (3 weekly data points)
    const resultIds: string[] = [];
    for (let weekOffset = 0; weekOffset < 3; weekOffset++) {
      const evaluation = buildEvaluation(profile, weekOffset);
      const activitySessions = buildActivitySessions(profile, weekOffset);
      const claimedAt = weekDate(weekOffset);

      const resultId = createAnalysisRecordDirectly(
        profile.id,
        evaluation,
        activitySessions,
        claimedAt,
      );
      resultIds.push(resultId);
    }

    console.log(
      `[E2E Seed] Created ${resultIds.length} analysis records for ${profile.email}`,
    );

    members.push({
      userId: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      teamId: team.teamId,
      resultIds,
    });
  }

  const seededData: SeededData = {
    organizationId,
    organizationSlug: SEED_SLUG,
    teams,
    members,
  };

  console.log('[E2E Seed] Seeding complete!');
  console.log(`[E2E Seed]   Organization: ${organizationId}`);
  console.log(`[E2E Seed]   Teams: ${teams.length}`);
  console.log(`[E2E Seed]   Members: ${members.length}`);
  console.log(`[E2E Seed]   Analysis records: ${members.reduce((s, m) => s + m.resultIds.length, 0)}`);

  return seededData;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function cleanupTeamData(baseUrl = DEFAULT_BASE_URL): Promise<void> {
  console.log('[E2E Cleanup] Starting team data cleanup...');

  const db = getDb();

  // Remove analysis records for seeded users
  const userIds = MEMBER_PROFILES.map(p => p.id);
  const placeholders = userIds.map(() => '?').join(', ');

  const deletedAnalyses = db.prepare(
    `DELETE FROM analysis_results WHERE user_id IN (${placeholders})`,
  ).run(...userIds);
  console.log(`[E2E Cleanup] Deleted ${deletedAnalyses.changes} analysis records`);

  // Remove team members for seeded users
  const deletedMembers = db.prepare(
    `DELETE FROM team_members WHERE user_id IN (${placeholders})`,
  ).run(...userIds);
  console.log(`[E2E Cleanup] Deleted ${deletedMembers.changes} team members`);

  // Remove teams belonging to the test org (by slug lookup)
  const org = db.prepare('SELECT id FROM organizations WHERE slug = ?').get(SEED_SLUG) as
    { id: string } | undefined;

  if (org) {
    const deletedTeams = db.prepare(
      'DELETE FROM teams WHERE organization_id = ?',
    ).run(org.id);
    console.log(`[E2E Cleanup] Deleted ${deletedTeams.changes} teams`);

    // Remove the organization
    db.prepare('DELETE FROM organizations WHERE id = ?').run(org.id);
    console.log(`[E2E Cleanup] Deleted organization ${org.id}`);

    // Clear organization_id from seeded users
    db.prepare(
      `UPDATE users SET organization_id = NULL WHERE id IN (${placeholders})`,
    ).run(...userIds);
  }

  // Remove seeded user rows (but NOT the auto-created local@localhost user)
  const deletedUsers = db.prepare(
    `DELETE FROM users WHERE id IN (${placeholders}) AND email != 'local@localhost'`,
  ).run(...userIds);
  console.log(`[E2E Cleanup] Deleted ${deletedUsers.changes} users`);

  // Also try API-level cleanup for the org (in case the local user owns it)
  try {
    const orgCheck = await api(baseUrl, '/api/org');
    if (orgCheck.status === 200) {
      console.log('[E2E Cleanup] Note: local user org still exists (expected if local@localhost is owner)');
    }
  } catch {
    // Server may not be running during cleanup -- that's fine
  }

  console.log('[E2E Cleanup] Cleanup complete!');
}

// ---------------------------------------------------------------------------
// Playwright globalSetup entry point
// ---------------------------------------------------------------------------

export default async function globalSetup(): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL;

  // Clean previous runs first (idempotent)
  try {
    await cleanupTeamData(baseUrl);
  } catch (error) {
    console.warn('[E2E Seed] Cleanup before seed failed (may be first run):', error);
  }

  await seedTeamData(baseUrl);
}
