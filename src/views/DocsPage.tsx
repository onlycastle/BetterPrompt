'use client';

import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsSection } from '@/components/docs/DocsSection';
import { CodeBlock } from '@/components/docs/CodeBlock';
import styles from './DocsPage.module.css';

const SECTIONS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'how-analysis-works', label: 'How Analysis Works' },
  { id: 'cli-reference', label: 'CLI Reference' },
  { id: 'understanding-report', label: 'Understanding Your Report' },
  { id: 'our-mission', label: 'Our Mission' },
];

export function DocsPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Documentation</h1>
        <p className={styles.subtitle}>
          Technical deep-dive into NoMoreAISlop&apos;s analysis pipeline
        </p>
      </header>

      <div className={styles.layout}>
        <DocsSidebar sections={SECTIONS} />

        <main className={styles.content}>
          {/* Getting Started */}
          <DocsSection id="getting-started" title="Getting Started">
            <h3 className={styles.heading3}>What is NoMoreAISlop?</h3>
            <p className={styles.paragraph}>
              NoMoreAISlop analyzes your Claude Code sessions to reveal how you collaborate with AI.
              It examines your prompts, tool usage patterns, and coding style to generate a personalized
              assessment of your developer-AI workflow.
            </p>

            <h3 className={styles.heading3}>Quick Start</h3>
            <p className={styles.paragraph}>Run the CLI to analyze your sessions:</p>
            <CodeBlock code="npx no-ai-slop" />

            <h3 className={styles.heading3}>What Data is Analyzed</h3>
            <p className={styles.paragraph}>
              NoMoreAISlop reads Claude Code session logs from <code className={styles.inlineCode}>~/.claude/projects/</code>.
              These are JSONL files containing your conversation history with Claude.
            </p>

            <h4 className={styles.heading4}>JSONL Structure</h4>
            <p className={styles.paragraph}>Each session file contains message blocks of these types:</p>
            <ul className={styles.list}>
              <li><code className={styles.inlineCode}>user</code> - Your prompts and messages</li>
              <li><code className={styles.inlineCode}>assistant</code> - Claude&apos;s responses</li>
              <li><code className={styles.inlineCode}>tool_use</code> - Tool invocations (Read, Edit, Bash, etc.)</li>
              <li><code className={styles.inlineCode}>tool_result</code> - Results from tool executions</li>
            </ul>

            <h4 className={styles.heading4}>Path Encoding</h4>
            <p className={styles.paragraph}>
              Claude Code encodes project paths by replacing <code className={styles.inlineCode}>/</code> with <code className={styles.inlineCode}>-</code>.
              For example, <code className={styles.inlineCode}>/Users/you/projects/myapp</code> becomes <code className={styles.inlineCode}>-Users-you-projects-myapp</code>.
            </p>
          </DocsSection>

          {/* How Analysis Works */}
          <DocsSection id="how-analysis-works" title="How Analysis Works">
            <p className={styles.paragraph}>
              The analysis pipeline runs in four phases, using Gemini 3 Flash for AI-powered analysis.
            </p>

            <h3 className={styles.heading3}>Phase 1: Session Scanning (CLI)</h3>
            <p className={styles.paragraph}>
              A memory-efficient 4-phase algorithm identifies your highest-quality sessions:
            </p>
            <ol className={styles.orderedList}>
              <li><strong>File Discovery</strong> - Scans <code className={styles.inlineCode}>~/.claude/projects/</code> for session files</li>
              <li><strong>Pre-filter</strong> - Filters by size and recency to reduce candidates</li>
              <li><strong>Quality Scoring</strong> - Scores top 100 candidates on message count, duration, tool diversity, recency</li>
              <li><strong>Parse Selection</strong> - Parses the top 15 highest-quality sessions</li>
            </ol>

            <h3 className={styles.heading3}>Phase 2: AI Analysis Pipeline</h3>
            <p className={styles.paragraph}>
              Three parallel analyzers extract structured data from your sessions:
            </p>

            <div className={styles.moduleCard}>
              <h4 className={styles.moduleTitle}>Module A: Data Analyst</h4>
              <p className={styles.moduleDescription}>
                Extracts behavioral patterns, coding style indicators, and representative quotes from your sessions.
              </p>
            </div>

            <div className={styles.moduleCard}>
              <h4 className={styles.moduleTitle}>Module C: Productivity Analyst</h4>
              <p className={styles.moduleDescription}>
                Analyzes efficiency metrics, work patterns, and productivity indicators.
              </p>
            </div>

            <div className={styles.moduleCard}>
              <h4 className={styles.moduleTitle}>Multitasking Analyzer</h4>
              <p className={styles.moduleDescription}>
                Examines cross-session patterns and context-switching behavior.
              </p>
            </div>

            <h3 className={styles.heading3}>Phase 2.5: Insight Generation (Premium+)</h3>
            <p className={styles.paragraph}>
              Six specialist agents run in parallel for deep analysis:
            </p>

            <div className={styles.agentGrid}>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>PatternDetective</span>
                <span className={styles.agentDesc}>Cross-session behavior patterns</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>AntiPatternSpotter</span>
                <span className={styles.agentDesc}>Inefficiency detection</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>KnowledgeGap</span>
                <span className={styles.agentDesc}>Learning opportunities</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>ContextEfficiency</span>
                <span className={styles.agentDesc}>Context utilization analysis</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>Metacognition</span>
                <span className={styles.agentDesc}>Self-awareness and blind spots</span>
              </div>
              <div className={styles.agentCard}>
                <span className={styles.agentName}>TemporalAnalyzer</span>
                <span className={styles.agentDesc}>Time-based quality and fatigue</span>
              </div>
            </div>

            <h3 className={styles.heading3}>Phase 3: Type Synthesis</h3>
            <p className={styles.paragraph}>
              Refines your coding style classification using all Phase 2 insights.
              Combines 5 types with 3 control levels for 15 personality combinations.
            </p>

            <h3 className={styles.heading3}>Phase 4: Content Writer</h3>
            <p className={styles.paragraph}>
              Transforms all outputs into a personalized narrative, connecting evidence quotes
              to dimension insights and applying tier-based content filtering.
            </p>

            <h3 className={styles.heading3}>Pipeline Overview</h3>
            <div className={styles.pipelineDiagram}>
              <pre className={styles.asciiDiagram}>{`~/.claude/projects/ --> CLI Scanner --> Session Selection
        |
   Gemini 3 Flash
        |
  +--------------------------------------------+
  | Module A (Data) --+                        |
  | Module C (Prod) --+--> Phase 2.5           |
  | Multitasking -----+    (6 Agents)          |
  |                            |               |
  |                     Type Synthesis         |
  |                            |               |
  |                     Content Writer         |
  +--------------------------------------------+
        |
   Supabase --> Web Report`}</pre>
            </div>
          </DocsSection>

          {/* CLI Reference */}
          <DocsSection id="cli-reference" title="CLI Reference">
            <h3 className={styles.heading3}>Main Command</h3>
            <CodeBlock code="npx no-ai-slop" />
            <p className={styles.paragraph}>
              Analyzes your Claude Code sessions and generates a shareable report.
              First-time users are guided through device-flow authentication.
            </p>

            <h3 className={styles.heading3}>Authentication Commands</h3>

            <h4 className={styles.heading4}>Check Status</h4>
            <CodeBlock code="npx no-ai-slop status" />
            <p className={styles.paragraph}>
              Shows your current authentication status and linked account.
            </p>

            <h4 className={styles.heading4}>Logout</h4>
            <CodeBlock code="npx no-ai-slop logout" />
            <p className={styles.paragraph}>
              Clears your local authentication credentials.
            </p>

            <h3 className={styles.heading3}>Help</h3>
            <CodeBlock code="npx no-ai-slop help" />
            <p className={styles.paragraph}>
              Displays available commands and usage information.
            </p>

            <h3 className={styles.heading3}>Authentication Flow</h3>
            <p className={styles.paragraph}>
              NoMoreAISlop uses OAuth-style device flow authentication:
            </p>
            <ol className={styles.orderedList}>
              <li>CLI generates a unique device code</li>
              <li>Browser opens to authentication page</li>
              <li>You sign in with your account</li>
              <li>CLI receives authentication token</li>
              <li>Token is stored locally for future sessions</li>
            </ol>

            <h3 className={styles.heading3}>Output</h3>
            <p className={styles.paragraph}>
              After successful analysis, the CLI displays a celebration animation
              and provides a shareable URL to your personalized report.
            </p>
          </DocsSection>

          {/* Understanding Your Report */}
          <DocsSection id="understanding-report" title="Understanding Your Report">
            <h3 className={styles.heading3}>The 5 Coding Styles</h3>
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
                  <td>Plans extensively before coding</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Scientist</td>
                  <td>Experiments and iterates</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Collaborator</td>
                  <td>Treats AI as pair programmer</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Speedrunner</td>
                  <td>Optimizes for velocity</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Craftsman</td>
                  <td>Focuses on code quality</td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.heading3}>The 3 Control Levels</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.tableEmoji}>Explorer</td>
                  <td>Open exploration - discovering solutions through experimentation</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Navigator</td>
                  <td>Balanced navigation - exploration with route planning</td>
                </tr>
                <tr>
                  <td className={styles.tableEmoji}>Cartographer</td>
                  <td>Strategic mapping - charting territory before advancing</td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.heading3}>The 6 Dimensions</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th>Measures</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>AI Collaboration Mastery</td>
                  <td>Planning quality, verification habits, instruction clarity</td>
                </tr>
                <tr>
                  <td>Context Engineering</td>
                  <td>WRITE/SELECT/COMPRESS/ISOLATE strategies</td>
                </tr>
                <tr>
                  <td>Tool Mastery</td>
                  <td>Read/Edit/Bash patterns, tool variety</td>
                </tr>
                <tr>
                  <td>Burnout Risk</td>
                  <td>Session length, frequency, context switching</td>
                </tr>
                <tr>
                  <td>AI Control Index</td>
                  <td>Strategic control vs reactive acceptance</td>
                </tr>
                <tr>
                  <td>Skill Resilience</td>
                  <td>Independent coding ability vs AI reliance</td>
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
              The developers who thrive won&apos;t be those who delegate everything&mdash;they&apos;ll be
              those who know when to think for themselves and when to let AI multiply their work.
              AI should be a force multiplier, not a replacement for judgment.
            </p>

            <h3 className={styles.heading3}>Our Vision</h3>
            <p className={styles.paragraph}>
              We&apos;re building a future where humans use tools&mdash;not the other way around.
            </p>
            <p className={styles.paragraph}>
              Our goal is simple: help you see yourself clearly. How are you actually using AI?
              What mistakes keep repeating? Are you thinking critically&mdash;or just accepting?
            </p>
            <p className={styles.paragraph}>
              Self-awareness is the first step to growth. We start with developers&mdash;the
              community at the frontier of human-AI collaboration.
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
        </main>
      </div>
    </div>
  );
}
