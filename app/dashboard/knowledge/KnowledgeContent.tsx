/**
 * KnowledgeContent - Client Component
 * Knowledge base browsing with search and filters
 *
 * Uses dimension-based filtering (aligned with analysis dimensions)
 */

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKnowledgeList } from '@/hooks/useKnowledge';
import { KnowledgeCard } from '@/components/knowledge/KnowledgeCard';
import { AddKnowledgeDrawer } from '@/components/dashboard/AddKnowledgeDrawer';
import { Search, Plus, X, Github } from 'lucide-react';
import type { SourcePlatform } from '@/types';
import styles from './page.module.css';

/**
 * Dimension names - aligned with analysis dimensions
 */
type DimensionName =
  | 'aiCollaboration'
  | 'contextEngineering'
  | 'toolMastery'
  | 'burnoutRisk'
  | 'aiControl'
  | 'skillResilience'
  | 'iterationEfficiency'
  | 'learningVelocity'
  | 'scopeManagement';

const PLATFORMS: Array<{ value: SourcePlatform | ''; label: string }> = [
  { value: '', label: 'All Platforms' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X/Twitter' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'web', label: 'Web' },
];

/**
 * Dimensions for filtering - aligned with analysis dimensions
 */
const DIMENSIONS: Array<{ value: DimensionName | ''; label: string }> = [
  { value: '', label: 'All Dimensions' },
  { value: 'aiCollaboration', label: 'AI Collaboration' },
  { value: 'contextEngineering', label: 'Context Engineering' },
  { value: 'toolMastery', label: 'Tool Mastery' },
  { value: 'aiControl', label: 'AI Control' },
  { value: 'skillResilience', label: 'Skill Resilience' },
  { value: 'burnoutRisk', label: 'Burnout Risk' },
  { value: 'iterationEfficiency', label: 'Iteration Efficiency' },
  { value: 'learningVelocity', label: 'Learning Velocity' },
  { value: 'scopeManagement', label: 'Scope Management' },
];

export function KnowledgeContent() {
  const { isAuthenticated, isLoading: authLoading, signInWithGitHub } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [platform, setPlatform] = useState<SourcePlatform | ''>('');
  const [dimension, setDimension] = useState<DimensionName | ''>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const queryParams = useMemo(
    () => ({
      query: searchQuery || undefined,
      platform: platform || undefined,
      dimension: dimension || undefined,
      limit: 50,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    }),
    [searchQuery, platform, dimension]
  );

  const { data, isLoading, error, refetch } = useKnowledgeList(queryParams);

  const activeFilters = [
    platform && {
      type: 'platform' as const,
      value: platform,
      label: PLATFORMS.find((p) => p.value === platform)?.label || platform,
    },
    dimension && {
      type: 'dimension' as const,
      value: dimension,
      label: DIMENSIONS.find((d) => d.value === dimension)?.label || dimension,
    },
  ].filter(Boolean);

  const clearFilter = (type: 'platform' | 'dimension') => {
    if (type === 'platform') setPlatform('');
    if (type === 'dimension') setDimension('');
  };

  const clearAllFilters = () => {
    setPlatform('');
    setDimension('');
    setSearchQuery('');
  };

  const handleCardClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleGitHubLogin = async () => {
    setLoginLoading(true);
    try {
      await signInWithGitHub();
    } catch (error) {
      console.error('GitHub login failed:', error);
    } finally {
      setLoginLoading(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.loginCard}>
          <div className={styles.loginIcon}>&#128274;</div>
          <h1 className={styles.loginTitle}>Sign in to Access Knowledge</h1>
          <p className={styles.loginDescription}>
            Browse curated insights from AI engineering experts.
          </p>
          <button
            onClick={handleGitHubLogin}
            disabled={loginLoading}
            className={styles.githubBtn}
          >
            <Github size={20} />
            {loginLoading ? 'Signing in...' : 'Continue with GitHub'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Knowledge Base</h1>
          <p className={styles.subtitle}>
            {data?.total || 0} items curated from industry experts
          </p>
        </div>
      </header>

      {/* Drawer */}
      <AddKnowledgeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Search */}
      <div className={styles.searchBox}>
        <Search size={20} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search knowledge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SourcePlatform | '')}
        >
          {PLATFORMS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={dimension}
          onChange={(e) => setDimension(e.target.value as DimensionName | '')}
        >
          {DIMENSIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {activeFilters.length > 0 && (
          <>
            {activeFilters.map(
              (filter) =>
                filter && (
                  <button
                    key={filter.type}
                    className={styles.filterPill}
                    onClick={() => clearFilter(filter.type)}
                  >
                    {filter.label}
                    <X size={14} />
                  </button>
                )
            )}
            <button className={styles.clearAll} onClick={clearAllFilters}>
              Clear all
            </button>
          </>
        )}

        <button
          className={styles.addButton}
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Add knowledge"
        >
          <Plus size={20} />
          <span>Add</span>
        </button>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );

  function renderContent() {
    if (isLoading) {
      return (
        <div className={styles.loadingContent}>
          <div className={styles.spinner} />
          <p>Loading knowledge...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.error}>
          <span className={styles.errorIcon}>&#9888;</span>
          <h3>Failed to load knowledge</h3>
          <p>{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
        </div>
      );
    }

    if (data?.items.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>&#128218;</span>
          <h3>No knowledge found</h3>
          <p>Try adjusting your search or filters</p>
          <button className={styles.clearButton} onClick={clearAllFilters}>
            Clear filters
          </button>
        </div>
      );
    }

    return (
      <div className={styles.grid}>
        {data?.items.map((item) => (
          <KnowledgeCard
            key={item.id}
            item={item}
            onClick={() => handleCardClick(item.source.url)}
          />
        ))}
      </div>
    );
  }
}
