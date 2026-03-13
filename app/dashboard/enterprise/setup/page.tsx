/**
 * Enterprise Setup Page
 * First-time organization setup flow for admin users.
 * Not guarded by the enterprise layout (which redirects here when no org exists).
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import styles from './SetupPage.module.css';

type Step = 'org' | 'team' | 'done';

export default function EnterpriseSetupPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('org');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrgName, setCreatedOrgName] = useState('');

  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }, []);

  const handleOrgNameChange = useCallback((value: string) => {
    setOrgName(value);
    setOrgSlug(generateSlug(value));
  }, [generateSlug]);

  const handleCreateOrg = useCallback(async () => {
    if (!orgName.trim() || !orgSlug.trim()) {
      setError('Organization name and slug are required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: orgName.trim(), slug: orgSlug.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create organization');
      }

      setCreatedOrgName(orgName.trim());
      setStep('team');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  }, [orgName, orgSlug]);

  const handleCreateTeam = useCallback(async () => {
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create team');
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  }, [teamName, teamDescription]);

  const handleSkipTeam = useCallback(() => {
    setStep('done');
  }, []);

  const handleGoToDashboard = useCallback(() => {
    // Force a page reload to re-fetch auth state with new organizationId
    window.location.href = '/dashboard/enterprise';
  }, []);

  if (isLoading) return null;

  // If user already has an org, redirect to dashboard
  if (user?.organizationId) {
    router.replace('/dashboard/enterprise');
    return null;
  }

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.pageTitle}>Set Up Your Organization</h1>
        <p className={styles.pageSubtitle}>
          Configure your team workspace to start tracking AI collaboration patterns.
        </p>

        {/* Step Indicator */}
        <div className={styles.steps}>
          <div className={`${styles.step} ${step === 'org' ? styles.stepActive : ''} ${step !== 'org' ? styles.stepDone : ''}`}>
            <span className={styles.stepNumber}>1</span>
            <span className={styles.stepLabel}>Organization</span>
          </div>
          <div className={styles.stepDivider} />
          <div className={`${styles.step} ${step === 'team' ? styles.stepActive : ''} ${step === 'done' ? styles.stepDone : ''}`}>
            <span className={styles.stepNumber}>2</span>
            <span className={styles.stepLabel}>First Team</span>
          </div>
          <div className={styles.stepDivider} />
          <div className={`${styles.step} ${step === 'done' ? styles.stepActive : ''}`}>
            <span className={styles.stepNumber}>3</span>
            <span className={styles.stepLabel}>Ready</span>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Step 1: Create Organization */}
        {step === 'org' && (
          <Card>
            <CardHeader>
              <h2 className={styles.sectionTitle}>Name Your Organization</h2>
            </CardHeader>
            <CardContent>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="orgName">Organization Name</label>
                <input
                  id="orgName"
                  type="text"
                  className={styles.input}
                  value={orgName}
                  onChange={e => handleOrgNameChange(e.target.value)}
                  placeholder="Acme Engineering"
                  maxLength={200}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="orgSlug">URL Slug</label>
                <input
                  id="orgSlug"
                  type="text"
                  className={styles.input}
                  value={orgSlug}
                  onChange={e => setOrgSlug(e.target.value)}
                  placeholder="acme-engineering"
                  maxLength={50}
                  pattern="[a-z0-9-]+"
                />
                <span className={styles.hint}>Lowercase letters, numbers, and hyphens only</span>
              </div>
              <button
                className={styles.primaryBtn}
                onClick={handleCreateOrg}
                disabled={submitting || !orgName.trim() || !orgSlug.trim()}
              >
                {submitting ? 'Creating...' : 'Create Organization'}
              </button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Create First Team */}
        {step === 'team' && (
          <Card>
            <CardHeader>
              <h2 className={styles.sectionTitle}>Create Your First Team</h2>
            </CardHeader>
            <CardContent>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="teamName">Team Name</label>
                <input
                  id="teamName"
                  type="text"
                  className={styles.input}
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Platform Team"
                  maxLength={200}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="teamDesc">Description (optional)</label>
                <input
                  id="teamDesc"
                  type="text"
                  className={styles.input}
                  value={teamDescription}
                  onChange={e => setTeamDescription(e.target.value)}
                  placeholder="Infrastructure and platform engineering"
                  maxLength={500}
                />
              </div>
              <div className={styles.btnRow}>
                <button
                  className={styles.secondaryBtn}
                  onClick={handleSkipTeam}
                >
                  Skip for now
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleCreateTeam}
                  disabled={submitting || !teamName.trim()}
                >
                  {submitting ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <Card>
            <CardHeader>
              <h2 className={styles.sectionTitle}>You're All Set!</h2>
            </CardHeader>
            <CardContent>
              <p className={styles.doneText}>
                <strong>{createdOrgName}</strong> is ready. Share this server URL with your team members
                so they can connect their CLI:
              </p>
              <div className={styles.urlBox}>
                <code className={styles.urlCode}>{serverUrl}</code>
              </div>
              <p className={styles.doneHint}>
                Team members should set <code>BETTERPROMPT_API_URL={serverUrl}</code> in their environment
                and run their analysis. Their results will appear in the team dashboard.
              </p>
              <button
                className={styles.primaryBtn}
                onClick={handleGoToDashboard}
              >
                Go to Dashboard
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
