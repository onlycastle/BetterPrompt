'use client';

import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsSection } from '@/components/docs/DocsSection';
import { CodeBlock } from '@/components/docs/CodeBlock';
import styles from './DocsPage.module.css';

const SECTIONS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'your-report', label: 'Your Report' },
  { id: 'our-mission', label: 'Our Mission' },
  { id: 'technical-details', label: 'Technical Details' },
];

export function DocsPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Documentation</h1>
        <p className={styles.subtitle}>
          Everything you need to understand your AI collaboration — from quick start to deep dive
        </p>
      </header>

      <div className={styles.layout}>
        <DocsSidebar sections={SECTIONS} />

        <main className={styles.content}>
          {/* Getting Started */}
          <DocsSection id="getting-started" title="Getting Started">
            <h3 className={styles.heading3}>What is NoMoreAISlop?</h3>
            <p className={styles.paragraph}>
              NoMoreAISlop analyzes your AI sessions to reveal how you collaborate with AI.
              It examines your prompts, patterns, and working style to generate a personalized
              assessment — so you can see clearly what&apos;s working and where to grow.
            </p>
            <p className={styles.paragraph}>
              Whether you&apos;re a PM, designer, founder, or builder of any kind: if you use
              Claude to get things done, NoMoreAISlop can help you use it better.
            </p>

            <h3 className={styles.heading3}>Three Steps to Your Assessment</h3>
            <div className={styles.stepsGrid}>
              <div className={styles.stepCard}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <span className={styles.stepTitle}>Connect your AI tool</span>
                  <span className={styles.stepDesc}>
                    Open your terminal and run one command. It reads your Claude sessions
                    from your machine and sends selected data to your self-hosted server.
                  </span>
                </div>
              </div>
              <div className={styles.stepCard}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <span className={styles.stepTitle}>Get your assessment</span>
                  <span className={styles.stepDesc}>
                    The tool analyzes your AI sessions in about a minute and generates
                    a personalized report with your collaboration style and key insights.
                  </span>
                </div>
              </div>
              <div className={styles.stepCard}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <span className={styles.stepTitle}>Start improving</span>
                  <span className={styles.stepDesc}>
                    Review your strengths, identify patterns that slow you down,
                    and get curated resources to level up your AI collaboration.
                  </span>
                </div>
              </div>
            </div>

            <h3 className={styles.heading3}>Run the Command</h3>
            <p className={styles.paragraph}>
              Open your terminal (Terminal on Mac, or any command prompt) and run:
            </p>
            <CodeBlock code="npx no-ai-slop" />
            <p className={styles.paragraph}>
              That&apos;s it. The tool will guide you through sign-in and analysis automatically.
              First-time setup takes about 30 seconds; analysis runs in about a minute.
            </p>

            <h3 className={styles.heading3}>What Data is Analyzed</h3>
            <p className={styles.paragraph}>
              NoMoreAISlop reads your Claude AI sessions — the conversations you&apos;ve had
              with Claude across your projects. It looks at how you ask questions, how you
              respond to Claude&apos;s output, and how you guide AI toward your goals.
            </p>
            <p className={styles.paragraph}>
              Your session data stays on your machine. Only the analysis results (scores,
              insights, your report) are stored on the self-hosted server you control.
            </p>
          </DocsSection>

          {/* How It Works */}
          <DocsSection id="how-it-works" title="How It Works">
            <p className={styles.paragraph}>
              Once you run the command, NoMoreAISlop works in two main stages.
            </p>

            <h3 className={styles.heading3}>Stage 1: Finding Your Best Sessions</h3>
            <p className={styles.paragraph}>
              The tool scans your AI sessions and picks the ones that best represent
              how you work — focusing on recent, substantive sessions where real collaboration
              happened. No AI is involved yet; this is purely about finding good signal.
            </p>

            <h3 className={styles.heading3}>Stage 2: Deep Analysis</h3>
            <p className={styles.paragraph}>
              Five specialized AI analysts examine your sessions in parallel, each focused
              on a different dimension of your collaboration:
            </p>

            <div className={styles.agentGrid}>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>Thinking Quality</span>
                <span className={styles.agentDesc}>How you plan and reason before acting</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>Communication Patterns</span>
                <span className={styles.agentDesc}>How clearly you express your intent to AI</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>Learning Behavior</span>
                <span className={styles.agentDesc}>How you adapt when things don&apos;t go as planned</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>Context Efficiency</span>
                <span className={styles.agentDesc}>How well you manage information flow with AI</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>Session Outcome</span>
                <span className={styles.agentDesc}>Whether your sessions actually achieve what you set out to do</span>
              </div>
            </div>

            <p className={styles.paragraph}>
              The results are combined into your profile type, a personality-style narrative,
              and actionable focus areas — then delivered as a shareable report.
            </p>

            <details className={styles.accordion}>
              <summary className={styles.accordionSummary}>
                Advanced: Full pipeline breakdown (for the technically curious)
              </summary>
              <div className={styles.accordionBody}>
                <p className={styles.paragraph}>
                  The pipeline runs across 8 phases (11–12 LLM calls total),
                  using Gemini 3 Flash for all AI-powered stages.
                </p>

                <h4 className={styles.heading4}>Phase 1: Data Extraction (CLI)</h4>
                <p className={styles.paragraph}>
                  A memory-efficient deterministic algorithm identifies your highest-quality sessions.
                  No LLM calls are made in this phase.
                </p>
                <ol className={styles.orderedList}>
                  <li><strong>File Discovery</strong> — Scans <code className={styles.inlineCode}>~/.claude/projects/</code> for session files</li>
                  <li><strong>Pre-filter</strong> — Filters by size and recency to reduce candidates</li>
                  <li><strong>Quality Scoring</strong> — Scores top 100 candidates on message count, duration, tool diversity, recency</li>
                  <li><strong>Parse Selection</strong> — Parses the top 15 highest-quality sessions</li>
                </ol>

                <h4 className={styles.heading4}>Phase 1.5: Session Summarization</h4>
                <p className={styles.paragraph}>
                  Generates concise one-line summaries for each session using a single batched LLM call.
                  These summaries provide context for downstream workers and appear in your activity timeline.
                </p>

                <h4 className={styles.heading4}>Phase 2: Insight Workers</h4>
                <p className={styles.paragraph}>
                  Five specialized workers run in parallel, each analyzing a distinct domain.
                  <strong>ProjectSummarizer</strong> generates project-level summaries and <strong>WeeklyInsightGenerator</strong> produces
                  weekly narrative highlights — both running in parallel. Total: 7 parallel LLM calls.
                </p>

                <h4 className={styles.heading4}>Phase 2.5: Type Classification</h4>
                <p className={styles.paragraph}>
                  A single LLM call classifies your style into a 5&times;3 matrix
                  (5 types &times; 3 control levels = 15 combinations) and generates an MBTI-style
                  personality narrative describing your behavioral patterns.
                </p>

                <h4 className={styles.heading4}>Phase 2.75: Knowledge Matching</h4>
                <p className={styles.paragraph}>
                  A deterministic resource matcher (no LLM) maps your identified strengths and growth areas
                  to curated professional resources from a knowledge database.
                </p>

                <h4 className={styles.heading4}>Phase 2.8: Evidence Verification</h4>
                <p className={styles.paragraph}>
                  An LLM-based verifier cross-checks evidence quotes against original session utterances,
                  ensuring all referenced quotes are accurate and traceable.
                </p>

                <h4 className={styles.heading4}>Phase 3: Content Writer</h4>
                <p className={styles.paragraph}>
                  Generates the top focus areas narrative from all prior insights.
                  A single LLM call synthesizes worker outputs into actionable guidance.
                </p>

                <h4 className={styles.heading4}>Phase 4: Translator</h4>
                <p className={styles.paragraph}>
                  Conditional translation for non-English users. Skipped entirely for English reports (0 calls),
                  uses 1 LLM call for other languages.
                </p>

                <h4 className={styles.heading4}>Pipeline Overview</h4>
                <div className={styles.pipelineDiagram}>
                  <pre className={styles.asciiDiagram}>{`~/.claude/projects/ --> DataExtractor --> Sessions
        |
   Gemini 3 Flash
        |
  Phase 1.5: SessionSummarizer (1 LLM)
        |
  +-----------------------------------------------+
  |  5 Insight Workers (parallel, 5 LLM)          |
  |  ThinkingQuality ----+                        |
  |  CommunicationPatt --+                        |
  |  LearningBehavior ---+--> Worker Insights     |
  |  ContextEfficiency --+                        |
  |  SessionOutcome -----+                        |
  |                                               |
  |  ProjectSummarizer (1 LLM) ─┐  (parallel)    |
  |  WeeklyInsightGen  (1 LLM) ─┘                |
  +-----------------------------------------------+
        |
  Phase 2.5:  TypeClassifier (1 LLM)
  Phase 2.75: KnowledgeResourceMatcher (0 LLM)
  Phase 2.8:  EvidenceVerifier (1 LLM)
        |
  Phase 3: ContentWriter (1 LLM)
  Phase 4: Translator (0-1 LLM)
        |
   SQLite + Local Files --> Web Report`}</pre>
                </div>
              </div>
            </details>
          </DocsSection>

          {/* Your Report */}
          <DocsSection id="your-report" title="Your Report">
            <h3 className={styles.heading3}>Your AI Collaboration Style</h3>
            <p className={styles.paragraph}>
              Your report starts with a personality-style profile: a combination of your
              primary working style and how you navigate ambiguity. Think of it like an MBTI
              for your AI collaboration habits.
            </p>

            <h3 className={styles.heading3}>The 5 Builder Styles</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Style</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.tableEmoji}>Architect</td>
                  <td>Plans extensively before acting — knows the destination before starting</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Analyst</td>
                  <td>Verifies and investigates thoroughly — never accepts output without checking</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Conductor</td>
                  <td>Orchestrates AI tools and workflows — focuses on directing, not doing</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Speedrunner</td>
                  <td>Optimizes for velocity — ships fast, iterates faster</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Trendsetter</td>
                  <td>Explores cutting-edge approaches — always pushing what&apos;s possible</td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.heading3}>The 3 Navigation Modes</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.tableEmoji}>Explorer</td>
                  <td>Open exploration — discovering solutions through experimentation</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Navigator</td>
                  <td>Balanced navigation — exploration with a loose route in mind</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Cartographer</td>
                  <td>Strategic mapping — charting the territory before advancing</td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.heading3}>The 6 Dimensions</h3>
            <p className={styles.paragraph}>
              Beyond your style profile, your report scores six dimensions that capture
              the nuanced aspects of how you work with AI:
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th>What it measures</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>AI Collaboration Mastery</td>
                  <td>Planning quality, verification habits, instruction clarity</td>
                </tr>
                <tr>
                  <td>Context Engineering</td>
                  <td>How well you manage what AI knows at any given moment</td>
                </tr>
                <tr>
                  <td>Tool Mastery</td>
                  <td>Breadth and intentionality of AI tool usage</td>
                </tr>
                <tr>
                  <td>Burnout Risk</td>
                  <td>Session length, frequency, and cognitive load patterns</td>
                </tr>
                <tr>
                  <td>AI Control Index</td>
                  <td>Strategic direction vs. reactive acceptance of AI output</td>
                </tr>
                <tr>
                  <td>Skill Resilience</td>
                  <td>Your independent capability alongside AI reliance</td>
                </tr>
              </tbody>
            </table>
          </DocsSection>

          {/* Our Mission */}
          <DocsSection id="our-mission" title="Our Mission">
            <h3 className={styles.heading3}>The Question</h3>
            <blockquote className={styles.blockquote}>
              Are you getting better with AI&mdash;or just more dependent?
            </blockquote>

            <h3 className={styles.heading3}>Our Philosophy</h3>
            <p className={styles.paragraph}>
              Technology moves fast. AI is making it exponential.
            </p>
            <p className={styles.paragraph}>
              Here&apos;s the uncomfortable truth: when thinking becomes optional, we stop doing it.
              And when we stop thinking, we stop growing.
            </p>
            <p className={styles.paragraph}>
              <strong>AI isn&apos;t the problem. Unconscious dependency is.</strong>
            </p>
            <p className={styles.paragraph}>
              The builders who thrive won&apos;t be those who delegate everything&mdash;they&apos;ll be
              those who know when to think for themselves and when to let AI multiply their work.
              AI should be a force multiplier, not a replacement for judgment.
            </p>

            <h3 className={styles.heading3}>Our Vision</h3>
            <p className={styles.paragraph}>
              We&apos;re building a future where humans use tools&mdash;not the other way around.
            </p>
            <p className={styles.paragraph}>
              Our goal is simple: help you see yourself clearly. How are you actually using AI?
              What patterns keep repeating? Are you thinking critically&mdash;or just accepting?
            </p>
            <p className={styles.paragraph}>
              Self-awareness is the first step to growth. We start with builders at the frontier
              of human-AI collaboration — and we&apos;re just getting started.
            </p>

            <h3 className={styles.heading3}>Our Values</h3>
            <div className={styles.valuesGrid}>
              <div className={styles.valueCard}>
                <h4 className={styles.valueTitle}>Think First</h4>
                <p className={styles.valueDescription}>
                  AI amplifies judgment. It doesn&apos;t replace the need for it.
                </p>
              </div>
              <div className={styles.valueCard}>
                <h4 className={styles.valueTitle}>Open Source</h4>
                <p className={styles.valueDescription}>
                  Our methodology is transparent. See exactly how we evaluate.
                </p>
              </div>
              <div className={styles.valueCard}>
                <h4 className={styles.valueTitle}>Privacy First</h4>
                <p className={styles.valueDescription}>
                  Your data stays yours. Analysis happens locally.
                </p>
              </div>
            </div>
          </DocsSection>

          {/* Technical Details */}
          <DocsSection id="technical-details" title="Technical Details">
            <p className={styles.paragraph}>
              For builders who want to understand exactly what&apos;s happening under the hood —
              or who need to troubleshoot, audit, or extend NoMoreAISlop.
            </p>

            <details className={styles.accordion}>
              <summary className={styles.accordionSummary}>
                Session data format (JSONL structure)
              </summary>
              <div className={styles.accordionBody}>
                <p className={styles.paragraph}>
                  NoMoreAISlop reads Claude Code session logs from <code className={styles.inlineCode}>~/.claude/projects/</code>.
                  These are JSONL files containing your conversation history with Claude.
                </p>
                <h4 className={styles.heading4}>JSONL Message Types</h4>
                <p className={styles.paragraph}>Each session file contains message blocks of these types:</p>
                <ul className={styles.list}>
                  <li><code className={styles.inlineCode}>user</code> — Your prompts and messages</li>
                  <li><code className={styles.inlineCode}>assistant</code> — Claude&apos;s responses</li>
                  <li><code className={styles.inlineCode}>tool_use</code> — Tool invocations (Read, Edit, Bash, etc.)</li>
                  <li><code className={styles.inlineCode}>tool_result</code> — Results from tool executions</li>
                  <li><code className={styles.inlineCode}>queue-operation</code> — Internal queue metadata (not analyzed)</li>
                  <li><code className={styles.inlineCode}>file-history-snapshot</code> — File state snapshots (not analyzed)</li>
                </ul>
              </div>
            </details>

            <details className={styles.accordion}>
              <summary className={styles.accordionSummary}>
                Path encoding
              </summary>
              <div className={styles.accordionBody}>
                <p className={styles.paragraph}>
                  Claude Code encodes project paths by replacing <code className={styles.inlineCode}>/</code> with <code className={styles.inlineCode}>-</code>.
                  For example, <code className={styles.inlineCode}>/Users/you/projects/myapp</code> becomes <code className={styles.inlineCode}>-Users-you-projects-myapp</code>.
                </p>
                <p className={styles.paragraph}>
                  NoMoreAISlop handles this automatically via <code className={styles.inlineCode}>encodeProjectPath</code> and <code className={styles.inlineCode}>decodeProjectPath</code> utilities.
                </p>
              </div>
            </details>

            <details className={styles.accordion}>
              <summary className={styles.accordionSummary}>
                CLI commands reference
              </summary>
              <div className={styles.accordionBody}>
                <h4 className={styles.heading4}>Main Command</h4>
                <CodeBlock code="npx no-ai-slop" />
                <p className={styles.paragraph}>
                  Analyzes your Claude AI sessions and generates a report on your self-hosted server.
                  First-time users are guided through local device-flow authentication.
                </p>

                <h4 className={styles.heading4}>Check Authentication Status</h4>
                <CodeBlock code="npx no-ai-slop status" />
                <p className={styles.paragraph}>
                  Shows your current authentication status and linked account.
                </p>

                <h4 className={styles.heading4}>Logout</h4>
                <CodeBlock code="npx no-ai-slop logout" />
                <p className={styles.paragraph}>
                  Clears your local authentication credentials.
                </p>

                <h4 className={styles.heading4}>Help</h4>
                <CodeBlock code="npx no-ai-slop help" />
                <p className={styles.paragraph}>
                  Displays all available commands and usage information.
                </p>

                <h4 className={styles.heading4}>Authentication Flow</h4>
                <p className={styles.paragraph}>
                  NoMoreAISlop uses a self-hosted device flow:
                </p>
                <ol className={styles.orderedList}>
                  <li>CLI generates a unique device code</li>
                  <li>Browser opens to authentication page</li>
                  <li>You sign in with your account</li>
                  <li>CLI receives authentication token</li>
                  <li>Token is stored locally for future sessions</li>
                </ol>
              </div>
            </details>

            <details className={styles.accordion}>
              <summary className={styles.accordionSummary}>
                Context Engineering dimension — scoring detail
              </summary>
              <div className={styles.accordionBody}>
                <p className={styles.paragraph}>
                  The Context Engineering score evaluates four strategies:
                </p>
                <ul className={styles.list}>
                  <li><strong>WRITE</strong> — Proactively providing relevant context upfront</li>
                  <li><strong>SELECT</strong> — Choosing which information to include or exclude</li>
                  <li><strong>COMPRESS</strong> — Summarizing or condensing context to stay within limits</li>
                  <li><strong>ISOLATE</strong> — Keeping concerns separate to avoid noise</li>
                </ul>
              </div>
            </details>
          </DocsSection>
        </main>
      </div>
    </div>
  );
}
