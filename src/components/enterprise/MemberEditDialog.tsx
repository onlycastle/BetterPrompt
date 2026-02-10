/**
 * MemberEditDialog Component
 * Dialog for editing a member's role
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './MemberEditDialog.module.css';

export interface MemberEditDialogProps {
  open: boolean;
  memberName: string;
  currentRole: string;
  onSave: (newRole: string) => void;
  onCancel: () => void;
}

const ROLES = ['Junior Engineer', 'Engineer', 'Senior Engineer', 'Staff Engineer', 'Lead Engineer'];

export function MemberEditDialog({ open, memberName, currentRole, onSave, onCancel }: MemberEditDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState(currentRole);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setRole(currentRole);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, currentRole]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(role);
  };

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onCancel}>
      <form className={styles.content} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Edit Member</h2>
        <p className={styles.subtitle}>Editing role for <strong>{memberName}</strong></p>

        <label className={styles.label}>
          Role
          <select value={role} onChange={e => setRole(e.target.value)} className={styles.select}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.submitBtn}>Save Changes</button>
        </div>
      </form>
    </dialog>
  );
}
