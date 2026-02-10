/**
 * SettingsContent
 * Organization settings scaffolding
 * TODO: Implement actual settings when backend is ready
 */

'use client';

import { useOrganization } from '@/hooks';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import styles from './SettingsContent.module.css';

export function SettingsContent() {
  const org = useOrganization();

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageSubtitle}>Manage your organization configuration</p>

      <div className={styles.grid}>
        <Card>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Organization Info</h2>
          </CardHeader>
          <CardContent>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <span className={styles.fieldValue}>{org.organizationName}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Teams</span>
              <span className={styles.fieldValue}>{org.teams.length}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Total Members</span>
              <span className={styles.fieldValue}>{org.totalMembers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Seat Management</h2>
          </CardHeader>
          <CardContent>
            <p className={styles.placeholder}>Seat allocation and billing management coming soon.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Allowed Domains</h2>
          </CardHeader>
          <CardContent>
            <p className={styles.placeholder}>Configure email domains allowed to join your organization.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={styles.sectionTitle}>SSO Configuration</h2>
          </CardHeader>
          <CardContent>
            <p className={styles.placeholder}>Single Sign-On integration settings coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
