import { useState, useMemo } from 'react';
import { Search, BookOpen, Plus } from 'lucide-react';
import { Header } from '../components/layout';
import { Input, Button, LoadingState } from '../components/ui';
import { KnowledgeCard } from '../components/knowledge';
import { useKnowledgeList } from '../hooks/useKnowledge';
import type { SourcePlatform, TopicCategory } from '../types';
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

export function BrowsePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [platform, setPlatform] = useState<SourcePlatform | ''>('');
  const [category, setCategory] = useState<TopicCategory | ''>('');

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
    if (type === 'platform') setPlatform('');
    if (type === 'category') setCategory('');
  };

  const clearAllFilters = () => {
    setPlatform('');
    setCategory('');
  };

  return (
    <div className={styles.page}>
      <Header
        title="Knowledge Base"
        subtitle={`${data?.total || 0} items curated`}
      />

      {/* Hero Search */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Discover Knowledge</h1>
          <p className={styles.heroSubtitle}>
            Search through curated insights from industry leaders
          </p>
          <div className={styles.heroSearch}>
            <Input
              icon={<Search size={20} />}
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className={styles.filterBar}>
        <div className={styles.filterPills}>
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
                  <span className={styles.filterPillClose}>×</span>
                </button>
              ))}
              <button
                className={styles.filterClear}
                onClick={clearAllFilters}
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading knowledge..." />
      ) : error ? (
        <div className={styles.error}>
          <div className={styles.errorIcon}>⚠</div>
          <h3 className={styles.errorTitle}>Failed to load knowledge</h3>
          <p className={styles.errorMessage}>
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
        </div>
      ) : data?.items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <BookOpen size={64} strokeWidth={1.5} />
          </div>
          <h3 className={styles.emptyTitle}>No knowledge found</h3>
          <p className={styles.emptyMessage}>
            Try adjusting your search or filters to find what you're looking for
          </p>
          <Button
            variant="primary"
            size="lg"
            icon={<Plus size={20} />}
            onClick={() => {
              clearAllFilters();
              setSearchQuery('');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {data?.items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onClick={() => window.open(item.source.url, '_blank', 'noopener,noreferrer')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
