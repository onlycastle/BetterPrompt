/**
 * Browse Page
 * Knowledge base search and filter
 */

import { useState, useMemo } from 'react';
import { useKnowledgeList } from '../hooks';
import { AddKnowledgeDrawer } from '../components/AddKnowledgeDrawer';
import type { SourcePlatform, TopicCategory } from '../api/types';
import styles from './BrowsePage.module.css';

const PLATFORMS: Array<{ value: SourcePlatform | ''; label: string }> = [
  { value: '', label: 'All Platforms' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X/Twitter' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'web', label: 'Web' },
];

const CATEGORIES: Array<{ value: TopicCategory | ''; label: string }> = [
  { value: '', label: 'All Categories' },
  { value: 'prompt-engineering', label: 'Prompt Engineering' },
  { value: 'context-engineering', label: 'Context Engineering' },
  { value: 'claude-code-skills', label: 'Claude Code Skills' },
  { value: 'tool-use', label: 'Tool Use' },
  { value: 'subagents', label: 'Subagents' },
  { value: 'workflow-automation', label: 'Workflow Automation' },
  { value: 'best-practices', label: 'Best Practices' },
  { value: 'other', label: 'Other' },
];

export default function BrowsePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [platform, setPlatform] = useState<SourcePlatform | ''>('');
  const [category, setCategory] = useState<TopicCategory | ''>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const queryParams = useMemo(() => ({
    query: searchQuery || undefined,
    platform: platform || undefined,
    category: category || undefined,
    limit: 50,
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
  }), [searchQuery, platform, category]);

  const { data, isLoading, error } = useKnowledgeList(queryParams);

  const activeFilters = [
    platform && { type: 'platform' as const, value: platform, label: PLATFORMS.find(p => p.value === platform)?.label || platform },
    category && { type: 'category' as const, value: category, label: CATEGORIES.find(c => c.value === category)?.label || category },
  ].filter(Boolean);

  const clearFilter = (type: 'platform' | 'category') => {
    switch (type) {
      case 'platform':
        setPlatform('');
        break;
      case 'category':
        setCategory('');
        break;
    }
  };

  const clearAllFilters = () => {
    setPlatform('');
    setCategory('');
    setSearchQuery('');
  };

  const handleOpenUrl = (url: string) => {
    window.electronAPI.openExternal(url);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Knowledge Base</h1>
        <p className={styles.subtitle}>{data?.total || 0} items curated</p>
      </header>

      <AddKnowledgeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={() => {
          // Refetch knowledge list on successful add
        }}
      />

      {/* Hero Search */}
      <div className={styles.hero}>
        <h2 className={styles.heroTitle}>Discover Knowledge</h2>
        <p className={styles.heroSubtitle}>
          Search through curated insights from industry leaders
        </p>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SourcePlatform | '')}
        >
          {PLATFORMS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={category}
          onChange={(e) => setCategory(e.target.value as TopicCategory | '')}
        >
          {CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {activeFilters.length > 0 && (
          <>
            {activeFilters.map((filter) => filter && (
              <button
                key={filter.type}
                className={styles.filterPill}
                onClick={() => clearFilter(filter.type)}
              >
                {filter.label}
                <span className={styles.filterClose}>×</span>
              </button>
            ))}
            <button
              className={styles.clearAll}
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </>
        )}

        <button
          className={styles.addButton}
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Add knowledge"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 4V16M4 10H16"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
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
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading knowledge...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <h3>Failed to load knowledge</h3>
          <p>{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
        </div>
      );
    }

    if (data?.items.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📚</span>
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
          <article
            key={item.id}
            className={styles.card}
            onClick={() => handleOpenUrl(item.source.url)}
          >
            <div className={styles.cardHeader}>
              <span className={styles.platform}>{item.source.platform}</span>
              <span className={styles.score}>{Math.round(item.relevance.score * 100)}%</span>
            </div>
            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardSummary}>{item.summary}</p>
            <div className={styles.cardFooter}>
              <span className={styles.category}>{item.category}</span>
              {item.source.author && (
                <span className={styles.author}>@{item.source.author}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  }
}
