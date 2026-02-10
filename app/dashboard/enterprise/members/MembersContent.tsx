/**
 * MembersContent
 * Full member management page with invite/edit/remove dialogs
 */

'use client';

import { useState, useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { useMembers } from '@/hooks';
import { MemberTable } from '@/components/enterprise/MemberTable';
import { MemberInviteDialog } from '@/components/enterprise/MemberInviteDialog';
import { MemberEditDialog } from '@/components/enterprise/MemberEditDialog';
import { ConfirmDialog } from '@/components/enterprise/ConfirmDialog';
import type { TeamMemberAnalysis } from '@/types/enterprise';
import styles from './MembersContent.module.css';

export function MembersContent() {
  const members = useMembers();

  // Dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMemberAnalysis | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberAnalysis | null>(null);

  const handleInvite = useCallback((email: string, role: string) => {
    // Mock: log to console, replace with API call later
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

      <MemberTable
        members={members}
        showDepartment
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
