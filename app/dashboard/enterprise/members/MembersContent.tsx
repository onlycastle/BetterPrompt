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
  const { data: members, isLoading, error, refetch } = useMembers();
  const router = useRouter();

  // Dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMemberAnalysis | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberAnalysis | null>(null);
  const [actionError, setActionError] = useState('');

  const memberList = members ?? [];

  // Aggregate stats
  const stats = useMemo(() => {
    const avgScore = memberList.length > 0
      ? Math.round(memberList.reduce((s, m) => s + m.overallScore, 0) / memberList.length)
      : 0;
    const improving = memberList.filter(m => m.growth.trend === 'improving').length;
    const totalAntiPatterns = memberList.reduce((s, m) => s + m.antiPatterns.length, 0);
    return { avgScore, improving, totalAntiPatterns };
  }, [memberList]);

  const handleRowClick = useCallback((member: TeamMemberAnalysis) => {
    router.push(`/dashboard/enterprise/members/${member.id}`);
  }, [router]);

  const handleInvite = useCallback(async (email: string, role: string) => {
    setActionError('');
    try {
      // Find team to invite to (use first team available)
      const teamsRes = await fetch('/api/teams', { credentials: 'same-origin' });
      if (!teamsRes.ok) throw new Error('Failed to load teams');
      const teams = await teamsRes.json();
      if (!teams.length) throw new Error('Create a team first before inviting members');

      const teamId = teams[0].id;
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to invite member');
      }

      setInviteOpen(false);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to invite member');
    }
  }, [refetch]);

  const handleEdit = useCallback(async (newRole: string) => {
    if (!editTarget) return;
    setActionError('');
    try {
      // Find the team this member belongs to
      const teamsRes = await fetch('/api/teams', { credentials: 'same-origin' });
      if (!teamsRes.ok) throw new Error('Failed to load teams');
      const teams = await teamsRes.json();

      // Try to update in each team until we find the right one
      let updated = false;
      for (const team of teams) {
        const res = await fetch(`/api/teams/${team.id}/members/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ role: newRole }),
        });
        if (res.ok) {
          updated = true;
          break;
        }
      }

      if (!updated) throw new Error('Failed to update member role');
      setEditTarget(null);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update member');
    }
  }, [editTarget, refetch]);

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return;
    setActionError('');
    try {
      const teamsRes = await fetch('/api/teams', { credentials: 'same-origin' });
      if (!teamsRes.ok) throw new Error('Failed to load teams');
      const teams = await teamsRes.json();

      for (const team of teams) {
        await fetch(`/api/teams/${team.id}/members/${removeTarget.id}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
      }

      setRemoveTarget(null);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }, [removeTarget, refetch]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading members...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p>Failed to load members: {error.message}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Members</h1>
          <p className={styles.pageSubtitle}>{memberList.length} members across all teams</p>
        </div>
        <button className={styles.inviteBtn} onClick={() => setInviteOpen(true)}>
          <UserPlus size={16} />
          <span>Invite Member</span>
        </button>
      </div>

      {actionError && (
        <div style={{ color: 'var(--ink-danger, #ef4444)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {actionError}
        </div>
      )}

      <div className={styles.statsRow}>
        <StatCard label="Active Members" value={memberList.length} />
        <StatCard label="Avg Score" value={stats.avgScore} suffix="%" />
        <StatCard label="Improving" value={stats.improving} suffix=" members" />
        <StatCard label="Anti-Patterns Detected" value={stats.totalAntiPatterns} />
      </div>

      <MemberTable
        members={memberList}
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
