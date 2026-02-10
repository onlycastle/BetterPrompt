/**
 * MembersContent
 * Full member management page with invite/edit/remove dialogs, stat cards, and row navigation
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { useMembers } from '@/hooks';
import { MemberTable } from '@/components/enterprise/MemberTable';
import { StatCard } from '@/components/enterprise/StatCard';
import { MemberInviteDialog } from '@/components/enterprise/MemberInviteDialog';
import { MemberEditDialog } from '@/components/enterprise/MemberEditDialog';
import { ConfirmDialog } from '@/components/enterprise/ConfirmDialog';
import type { TeamMemberAnalysis } from '@/types/enterprise';
import styles from './MembersContent.module.css';

export function MembersContent() {
  const members = useMembers();
  const router = useRouter();

  // Dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMemberAnalysis | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberAnalysis | null>(null);

  // Aggregate stats
  const stats = useMemo(() => {
    const avgScore = members.length > 0
      ? Math.round(members.reduce((s, m) => s + m.overallScore, 0) / members.length)
      : 0;
    const improving = members.filter(m => m.growth.trend === 'improving').length;
    const totalAntiPatterns = members.reduce((s, m) => s + m.antiPatterns.length, 0);
    return { avgScore, improving, totalAntiPatterns };
  }, [members]);

  const handleRowClick = useCallback((member: TeamMemberAnalysis) => {
    router.push(`/dashboard/enterprise/members/${member.id}`);
  }, [router]);

  const handleInvite = useCallback((email: string, role: string) => {
    console.log('[Mock] Invite member:', { email, role });
    setInviteOpen(false);
  }, []);

  const handleEdit = useCallback((newRole: string) => {
    if (editTarget) {
      console.log('[Mock] Edit member role:', { member: editTarget.name, newRole });
    }
    setEditTarget(null);
  }, [editTarget]);

  const handleRemove = useCallback(() => {
    if (removeTarget) {
      console.log('[Mock] Remove member:', { member: removeTarget.name });
    }
    setRemoveTarget(null);
  }, [removeTarget]);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Members</h1>
          <p className={styles.pageSubtitle}>{members.length} members across all teams</p>
        </div>
        <button className={styles.inviteBtn} onClick={() => setInviteOpen(true)}>
          <UserPlus size={16} />
          <span>Invite Member</span>
        </button>
      </div>

      <div className={styles.statsRow}>
        <StatCard label="Active Members" value={members.length} />
        <StatCard label="Avg Score" value={stats.avgScore} suffix="%" />
        <StatCard label="Improving" value={stats.improving} suffix=" members" />
        <StatCard label="Anti-Patterns Detected" value={stats.totalAntiPatterns} />
      </div>

      <MemberTable
        members={members}
        showDepartment
        onRowClick={handleRowClick}
        onEdit={setEditTarget}
        onRemove={setRemoveTarget}
      />

      {/* Invite Dialog */}
      <MemberInviteDialog
        open={inviteOpen}
        onInvite={handleInvite}
        onCancel={() => setInviteOpen(false)}
      />

      {/* Edit Dialog */}
      <MemberEditDialog
        open={!!editTarget}
        memberName={editTarget?.name ?? ''}
        currentRole={editTarget?.role ?? ''}
        onSave={handleEdit}
        onCancel={() => setEditTarget(null)}
      />

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Member"
        message={`Are you sure you want to remove ${removeTarget?.name ?? ''} from the organization? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
