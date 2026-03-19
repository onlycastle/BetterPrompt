/**
 * SettingsContent
 * Organization settings with real data
 */

'use client';

import { useOrganization } from '@/hooks';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import styles from './SettingsContent.module.css';

export function SettingsContent() {
  const { data: org, isLoading, error } = useOrganization();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p>Failed to load settings: {error.message}</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className={styles.container}>
        <p>No organization found.</p>
      </div>
    );
  }

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : '';

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
            <h2 className={styles.sectionTitle}>Server URL</h2>
          </CardHeader>
          <CardContent>
            <p className={styles.placeholder}>
              Share this URL with your team members:
            </p>
            <code style={{
              display: 'block',
              padding: 'var(--space-sm)',
              background: 'var(--surface-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              color: 'var(--sketch-cyan)',
              marginTop: 'var(--space-sm)',
              wordBreak: 'break-all',
            }}>
              {serverUrl}
            </code>
            <p className={styles.placeholder} style={{ marginTop: 'var(--space-sm)' }}>
              Team members can use this as the BetterPrompt plugin <code>serverUrl</code> setting or pass it to <code>sync_to_team</code>.
            </p>
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
