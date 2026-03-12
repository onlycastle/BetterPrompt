/**
 * Storage Port Interfaces
 *
 * Defines contracts for data persistence operations.
 * Implemented by local database and filesystem adapters.
 *
 * @module application/ports/storage
 */

import type { Result } from '../../result';
import type { StorageError } from '../../domain/errors/index';
import type {
  StoredAnalysis,
  AnalysisSummary,
  KnowledgeItem,
  KnowledgeStats,
  KnowledgeFilters,
  Influencer,
  InfluencerMatch,
  User,
  Team,
  TeamMember,
  Organization,
  TrackingMetrics,
  SharedReport,
  CreateSharedReportInput,
  PublicReportView,
  ProfessionalInsight,
  KnowledgeDimensionName,
} from '../../domain/models/index';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Sort options
 */
export interface SortOptions<T extends string = string> {
  field: T;
  direction: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Query options combining pagination and sort
 */
export interface QueryOptions<T extends string = string> {
  pagination?: PaginationOptions;
  sort?: SortOptions<T>;
}

// ============================================================================
// Analysis Repository Port
// ============================================================================

/**
 * Repository for analysis data (evaluations, type results, dimensions)
 */
export interface IAnalysisRepository {
  /**
   * Save a new analysis
   */
  save(analysis: StoredAnalysis): Promise<Result<string, StorageError>>;

  /**
   * Find analysis by session ID
   */
  findBySessionId(sessionId: string): Promise<Result<StoredAnalysis | null, StorageError>>;

  /**
   * Find analysis by ID
   */
  findById(id: string): Promise<Result<StoredAnalysis | null, StorageError>>;

  /**
   * List analyses for a user
   */
  findByUser(
    userId: string,
    options?: QueryOptions<'createdAt' | 'projectName'>
  ): Promise<Result<PaginatedResult<AnalysisSummary>, StorageError>>;

  /**
   * List analyses for a team
   */
  findByTeam(
    teamId: string,
    options?: QueryOptions<'createdAt' | 'projectName'>
  ): Promise<Result<PaginatedResult<AnalysisSummary>, StorageError>>;

  /**
   * Delete an analysis
   */
  delete(id: string): Promise<Result<void, StorageError>>;

  /**
   * Count analyses for a user in current month
   */
  countThisMonth(userId: string): Promise<Result<number, StorageError>>;

  /**
   * Check if analysis exists
   */
  exists(sessionId: string): Promise<Result<boolean, StorageError>>;
}

// ============================================================================
// Knowledge Repository Port
// ============================================================================

/**
 * Repository for knowledge items
 */
export interface IKnowledgeRepository {
  /**
   * Save a new knowledge item
   */
  save(item: KnowledgeItem): Promise<Result<KnowledgeItem, StorageError>>;

  /**
   * Save multiple items in batch
   */
  saveBatch(items: KnowledgeItem[]): Promise<Result<KnowledgeItem[], StorageError>>;

  /**
   * Find by ID
   */
  findById(id: string): Promise<Result<KnowledgeItem | null, StorageError>>;

  /**
   * Search with filters
   */
  search(
    filters: KnowledgeFilters,
    options?: QueryOptions<'relevance' | 'createdAt' | 'title'>
  ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>>;

  /**
   * Full-text search
   */
  fullTextSearch(
    query: string,
    filters?: Partial<KnowledgeFilters>,
    options?: PaginationOptions
  ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>>;

  /**
   * Get statistics
   */
  getStats(): Promise<Result<KnowledgeStats, StorageError>>;

  /**
   * Update an item
   */
  update(id: string, updates: Partial<KnowledgeItem>): Promise<Result<KnowledgeItem, StorageError>>;

  /**
   * Update status
   */
  updateStatus(
    id: string,
    status: KnowledgeItem['status']
  ): Promise<Result<void, StorageError>>;

  /**
   * Delete an item
   */
  delete(id: string): Promise<Result<void, StorageError>>;

  /**
   * Check if URL already exists
   */
  existsByUrl(url: string): Promise<Result<boolean, StorageError>>;

  /**
   * Find similar items (for deduplication)
   */
  findSimilar(title: string, threshold?: number): Promise<Result<KnowledgeItem[], StorageError>>;
}

// ============================================================================
// Influencer Repository Port
// ============================================================================

/**
 * Repository for influencer data
 */
export interface IInfluencerRepository {
  /**
   * Save a new influencer
   */
  save(influencer: Influencer): Promise<Result<Influencer, StorageError>>;

  /**
   * Find by ID
   */
  findById(id: string): Promise<Result<Influencer | null, StorageError>>;

  /**
   * Find by handle on a platform
   */
  findByHandle(
    platform: Influencer['identifiers'][0]['platform'],
    handle: string
  ): Promise<Result<Influencer | null, StorageError>>;

  /**
   * List all influencers
   */
  findAll(
    options?: QueryOptions<'name' | 'credibilityTier' | 'contentCount'>
  ): Promise<Result<PaginatedResult<Influencer>, StorageError>>;

  /**
   * Find active influencers
   */
  findActive(): Promise<Result<Influencer[], StorageError>>;

  /**
   * Find by credibility tier
   */
  findByTier(tier: Influencer['credibilityTier']): Promise<Result<Influencer[], StorageError>>;

  /**
   * Update an influencer
   */
  update(id: string, updates: Partial<Influencer>): Promise<Result<Influencer, StorageError>>;

  /**
   * Increment content count
   */
  incrementContentCount(id: string): Promise<Result<void, StorageError>>;

  /**
   * Delete an influencer
   */
  delete(id: string): Promise<Result<void, StorageError>>;

  /**
   * Match content against known influencers
   */
  matchFromContent(url: string, author?: string): Promise<Result<InfluencerMatch | null, StorageError>>;
}

// ============================================================================
// User Repository Port
// ============================================================================

/**
 * Repository for user data
 */
export interface IUserRepository {
  /**
   * Create a new user
   */
  create(email: string, tier?: User['tier']): Promise<Result<User, StorageError>>;

  /**
   * Find by ID
   */
  findById(id: string): Promise<Result<User | null, StorageError>>;

  /**
   * Find by email
   */
  findByEmail(email: string): Promise<Result<User | null, StorageError>>;

  /**
   * Update user
   */
  update(id: string, updates: Partial<User>): Promise<Result<User, StorageError>>;

  /**
   * Update user tier
   */
  updateTier(id: string, tier: User['tier']): Promise<Result<void, StorageError>>;

  /**
   * Increment analysis count
   */
  incrementAnalysisCount(id: string): Promise<Result<number, StorageError>>;

  /**
   * Reset monthly analysis count
   */
  resetAnalysisCount(id: string): Promise<Result<void, StorageError>>;

  /**
   * Delete user
   */
  delete(id: string): Promise<Result<void, StorageError>>;
}

// ============================================================================
// Team Repository Port
// ============================================================================

/**
 * Repository for team and organization data
 */
export interface ITeamRepository {
  /**
   * Create a team
   */
  createTeam(orgId: string, name: string, description?: string): Promise<Result<Team, StorageError>>;

  /**
   * Find team by ID
   */
  findTeamById(id: string): Promise<Result<Team | null, StorageError>>;

  /**
   * List teams in an organization
   */
  findTeamsByOrg(orgId: string): Promise<Result<Team[], StorageError>>;

  /**
   * Add member to team
   */
  addMember(teamId: string, userId: string, role: TeamMember['role']): Promise<Result<void, StorageError>>;

  /**
   * Remove member from team
   */
  removeMember(teamId: string, userId: string): Promise<Result<void, StorageError>>;

  /**
   * Get team members
   */
  getMembers(teamId: string): Promise<Result<TeamMember[], StorageError>>;

  /**
   * Get user's teams
   */
  getUserTeams(userId: string): Promise<Result<Team[], StorageError>>;

  /**
   * Delete team
   */
  deleteTeam(id: string): Promise<Result<void, StorageError>>;

  /**
   * Create organization
   */
  createOrganization(
    name: string,
    slug: string,
    ownerId: string,
    maxSeats: number
  ): Promise<Result<Organization, StorageError>>;

  /**
   * Find organization by ID
   */
  findOrganizationById(id: string): Promise<Result<Organization | null, StorageError>>;

  /**
   * Find organization by slug
   */
  findOrganizationBySlug(slug: string): Promise<Result<Organization | null, StorageError>>;

  /**
   * Update organization
   */
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Result<Organization, StorageError>>;
}

// ============================================================================
// Tracking Repository Port
// ============================================================================

/**
 * Repository for tracking metrics (PREMIUM tier)
 */
export interface ITrackingRepository {
  /**
   * Save daily metrics
   */
  saveDailyMetrics(metrics: TrackingMetrics): Promise<Result<void, StorageError>>;

  /**
   * Get metrics for a date range
   */
  getMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Result<TrackingMetrics[], StorageError>>;

  /**
   * Get latest metrics
   */
  getLatest(userId: string, days?: number): Promise<Result<TrackingMetrics[], StorageError>>;

  /**
   * Get metrics summary
   */
  getSummary(userId: string): Promise<Result<{
    totalSessions: number;
    avgScore: number;
    dimensionAverages: Record<string, number>;
    streak: number;
  }, StorageError>>;

  /**
   * Update metrics for today
   */
  updateToday(
    userId: string,
    updates: Partial<TrackingMetrics>
  ): Promise<Result<void, StorageError>>;
}

// ============================================================================
// Sharing Repository Port
// ============================================================================

/**
 * Repository for shared reports
 */
export interface ISharingRepository {
  /**
   * Create a shared report
   */
  create(input: CreateSharedReportInput, userId?: string): Promise<Result<SharedReport, StorageError>>;

  /**
   * Find by report ID (short URL)
   */
  findByReportId(reportId: string): Promise<Result<SharedReport | null, StorageError>>;

  /**
   * Get public view
   */
  getPublicView(reportId: string): Promise<Result<PublicReportView | null, StorageError>>;

  /**
   * Increment view count
   */
  incrementViews(reportId: string): Promise<Result<void, StorageError>>;

  /**
   * Increment share count
   */
  incrementShares(reportId: string): Promise<Result<void, StorageError>>;

  /**
   * Deactivate a report
   */
  deactivate(reportId: string): Promise<Result<void, StorageError>>;

  /**
   * List user's shared reports
   */
  findByUser(userId: string): Promise<Result<SharedReport[], StorageError>>;

  /**
   * Delete expired reports
   */
  deleteExpired(): Promise<Result<number, StorageError>>;
}

// ============================================================================
// Professional Insight Repository Port
// ============================================================================

/**
 * Filters for querying professional insights
 */
export interface ProfessionalInsightFilters {
  dimension?: KnowledgeDimensionName;
  dimensions?: KnowledgeDimensionName[];
  style?: string;
  controlLevel?: string;
  minScore?: number;
  maxScore?: number;
  category?: 'diagnosis' | 'trend' | 'type-specific' | 'tool';
  enabledOnly?: boolean;
}

/**
 * Repository for professional insights (curated tips for developers)
 */
export interface IProfessionalInsightRepository {
  /**
   * Find all enabled insights
   */
  findEnabled(): Promise<Result<ProfessionalInsight[], StorageError>>;

  /**
   * Find insights applicable to a specific dimension and score
   * Used by KnowledgeLinker to show relevant insights based on analysis results
   */
  findApplicable(
    dimension: KnowledgeDimensionName,
    score: number
  ): Promise<Result<ProfessionalInsight[], StorageError>>;

  /**
   * Find insights with advanced filtering
   */
  findWithFilters(
    filters: ProfessionalInsightFilters,
    options?: QueryOptions<'priority' | 'createdAt' | 'title'>
  ): Promise<Result<PaginatedResult<ProfessionalInsight>, StorageError>>;

  /**
   * Find by ID
   */
  findById(id: string): Promise<Result<ProfessionalInsight | null, StorageError>>;

  /**
   * Save a new insight
   */
  save(insight: ProfessionalInsight): Promise<Result<ProfessionalInsight, StorageError>>;

  /**
   * Save multiple insights in batch
   */
  saveBatch(insights: ProfessionalInsight[]): Promise<Result<ProfessionalInsight[], StorageError>>;

  /**
   * Update an insight
   */
  update(
    id: string,
    updates: Partial<ProfessionalInsight>
  ): Promise<Result<ProfessionalInsight, StorageError>>;

  /**
   * Toggle enabled status
   */
  setEnabled(id: string, enabled: boolean): Promise<Result<void, StorageError>>;

  /**
   * Delete an insight
   */
  delete(id: string): Promise<Result<void, StorageError>>;

  /**
   * Count insights by category
   */
  countByCategory(): Promise<Result<Record<string, number>, StorageError>>;
}

// ============================================================================
// Sync Manager Port (for offline-first)
// ============================================================================

/**
 * Manager for syncing local and cloud data
 */
export interface ISyncManager {
  /**
   * Get sync status
   */
  getStatus(): Promise<{
    lastSyncAt: Date | null;
    pendingChanges: number;
    isOnline: boolean;
  }>;

  /**
   * Push local changes to cloud
   */
  pushChanges(): Promise<Result<{ pushed: number; failed: number }, StorageError>>;

  /**
   * Pull changes from cloud
   */
  pullChanges(since?: Date): Promise<Result<{ pulled: number }, StorageError>>;

  /**
   * Full sync (push then pull)
   */
  fullSync(): Promise<Result<{ pushed: number; pulled: number }, StorageError>>;

  /**
   * Queue a change for sync
   */
  queueChange(type: string, id: string, data: unknown): Promise<void>;

  /**
   * Check if online
   */
  isOnline(): boolean;

  /**
   * Set online status change handler
   */
  onStatusChange(handler: (online: boolean) => void): void;
}
