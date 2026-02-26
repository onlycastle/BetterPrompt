'use client';

import { useInView } from '@/hooks/useInView';
import styles from './HeroFlowchart.module.css';

function FlowNode({
  headerTitle,
  dotClass,
  nodeVariant,
  visible,
  delayClass,
  children,
}: {
  headerTitle: string;
  dotClass: string;
  nodeVariant?: string;
  visible: boolean;
  delayClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.node} ${nodeVariant ?? ''} ${styles.staggerItem} ${delayClass} ${visible ? styles.visible : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={`${styles.headerDot} ${dotClass}`} />
        <span className={styles.headerTitle}>{headerTitle}</span>
      </div>
      <div className={styles.nodeBody}>{children}</div>
    </div>
  );
}

function FlowArrow({ visible, delayClass }: { visible: boolean; delayClass: string }) {
  return (
    <div className={`${styles.arrow} ${styles.staggerItem} ${delayClass} ${visible ? styles.visible : ''}`}>
      <div className={styles.arrowLine} />
    </div>
  );
}

export function HeroFlowchart() {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <div ref={ref} className={styles.flowchart}>
      {/* Node 1 — Input: Chat Log */}
      <FlowNode headerTitle="Your Chat Log" dotClass={styles.dotGray} nodeVariant={styles.nodeProblem} visible={isInView} delayClass={styles.delay0}>
        <div className={styles.chatLine}>
          <span className={`${styles.chatRole} ${styles.chatRoleYou}`}>You</span>
          <span className={styles.chatText}>Checkout page isn&apos;t working</span>
        </div>
        <div className={styles.chatLineAi}>
          <span className={`${styles.chatRole} ${styles.chatRoleAi}`}>AI</span>
          <span className={styles.chatTextFaded}>Try changing the settings...</span>
        </div>
        <div className={styles.chatLine}>
          <span className={`${styles.chatRole} ${styles.chatRoleYou}`}>You</span>
          <span className={styles.chatText}>Didn&apos;t work. Checkout still broken</span>
        </div>
        <div className={styles.chatLineAi}>
          <span className={`${styles.chatRole} ${styles.chatRoleAi}`}>AI</span>
          <span className={styles.chatTextFaded}>Let me try another approach...</span>
        </div>
        <div className={styles.chatLine}>
          <span className={`${styles.chatRole} ${styles.chatRoleYou}`}>You</span>
          <span className={styles.chatText}>Same error. Checkout broken</span>
        </div>
        <div className={styles.chatLineAi}>
          <span className={`${styles.chatRole} ${styles.chatRoleAi}`}>AI</span>
          <span className={styles.chatTextFaded}>How about we try...</span>
        </div>
        <div className={styles.ellipsis}>···</div>
        <div className={styles.chatLine}>
          <span className={`${styles.chatRole} ${styles.chatRoleYou}`}>You</span>
          <span className={styles.chatText}>STILL not working</span>
        </div>
        <span className={styles.statBadge}>47 messages · 47 min</span>
      </FlowNode>

      {/* Arrow 1 */}
      <FlowArrow visible={isInView} delayClass={styles.delay1} />

      {/* Node 2 — Process: Diagnosis */}
      <FlowNode headerTitle="Diagnosis" dotClass={styles.dotCyan} nodeVariant={styles.nodeAnalysis} visible={isInView} delayClass={styles.delay2}>
        <span className={styles.detectionLabel}>Root Cause Found</span>
        <span className={styles.errorType}>Race Condition</span>
        <p className={styles.patternName}>Duplicate Payment Handler</p>
        <p className={styles.patternDesc}>
          Two parts of your app handle checkout at the same time — like two cashiers ringing up the same order.
        </p>
      </FlowNode>

      {/* Arrow 2 */}
      <FlowArrow visible={isInView} delayClass={styles.delay3} />

      {/* Node 3 — Output: Suggested Prompt */}
      <FlowNode headerTitle="Your Next Prompt" dotClass={styles.dotGreen} nodeVariant={styles.nodeSuccess} visible={isInView} delayClass={styles.delay4}>
        <div className={styles.suggestion}>
          <span className={styles.suggestionPrefix}>Ask this instead</span>
          <p className={styles.promptText}>
            &ldquo;I think my app might be processing payments twice. Can you find where that&apos;s happening and fix
            it?&rdquo;
          </p>
        </div>
        <span className={styles.outcome}>&rarr; Fixed in 2 minutes</span>
      </FlowNode>
    </div>
  );
}
