/**
 * MemberInviteDialog Component
 * Dialog for inviting a new member by email with role selection
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './MemberInviteDialog.module.css';

export interface MemberInviteDialogProps {
  open: boolean;
  onInvite: (email: string, role: string) => void;
  onCancel: () => void;
}

const ROLES = ['Engineer', 'Senior Engineer', 'Staff Engineer', 'Lead Engineer', 'Junior Engineer'];

export function MemberInviteDialog({ open, onInvite, onCancel }: MemberInviteDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(ROLES[0]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setEmail('');
      setRole(ROLES[0]);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onInvite(email.trim(), role);
    }
  };

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onCancel}>
      <form className={styles.content} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Invite Member</h2>

        <label className={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="developer@company.com"
            className={styles.input}
            required
          />
        </label>

        <label className={styles.label}>
          Role
          <select value={role} onChange={e => setRole(e.target.value)} className={styles.select}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.submitBtn}>Send Invite</button>
        </div>
      </form>
    </dialog>
  );
}
