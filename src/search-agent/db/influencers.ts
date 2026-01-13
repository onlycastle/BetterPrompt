/**
 * Influencer Database Layer
 *
 * Supabase-based persistence for influencers.
 * Replaces the file-based InfluencerRegistryManager.
 */

import { getSupabase } from '../../lib/supabase.js';
import type {
  Influencer,
  CredibilityTier,
  PlatformIdentifier,
  InfluencerPlatform,
} from '../models/index.js';

/**
 * Influencer statistics
 */
export interface InfluencerStats {
  total: number;
  active: number;
  byTier: Record<CredibilityTier, number>;
  totalContent: number;
}

/**
 * Transform database row to domain model
 */
function toInfluencer(row: Record<string, unknown>): Influencer {
  const identifiers = row.identifiers as Array<{
    platform: InfluencerPlatform;
    handle: string;
    profile_url?: string;
  }>;

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    credibilityTier: row.credibility_tier as CredibilityTier,
    identifiers: identifiers?.map((id) => ({
      platform: id.platform,
      handle: id.handle,
      profileUrl: id.profile_url,
    })) || [],
    expertiseTopics: row.expertise_topics as string[],
    affiliation: row.affiliation as string | undefined,
    contentCount: row.content_count as number,
    isActive: row.is_active as boolean,
    addedAt: row.added_at as string,
    updatedAt: row.updated_at as string | undefined,
    lastContentAt: row.last_content_at as string | undefined,
  };
}

/**
 * Influencer Database Operations
 */
export const influencerDb = {
  /**
   * Find an influencer by ID
   */
  async findById(id: string): Promise<Influencer | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('influencers')
      .select(
        `
        *,
        identifiers:influencer_identifiers(*)
      `
      )
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toInfluencer(data);
  },

  /**
   * Find an influencer by name (case-insensitive)
   */
  async findByName(name: string): Promise<Influencer | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('influencers')
      .select(
        `
        *,
        identifiers:influencer_identifiers(*)
      `
      )
      .ilike('name', name)
      .single();

    if (error || !data) return null;
    return toInfluencer(data);
  },

  /**
   * Find an influencer by platform handle
   */
  async findByHandle(platform: string, handle: string): Promise<Influencer | null> {
    const supabase = getSupabase();

    // First find the identifier
    const { data: idData, error: idError } = await supabase
      .from('influencer_identifiers')
      .select('influencer_id')
      .eq('platform', platform)
      .ilike('handle', handle.replace(/^@/, ''))
      .single();

    if (idError || !idData) return null;

    // Then get the full influencer with all identifiers
    return this.findById(idData.influencer_id);
  },

  /**
   * Get all influencers
   */
  async findAll(): Promise<Influencer[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('influencers')
      .select(
        `
        *,
        identifiers:influencer_identifiers(*)
      `
      )
      .order('name');

    if (error) {
      console.error('Influencer findAll error:', error);
      throw new Error(`Failed to fetch influencers: ${error.message}`);
    }

    return (data || []).map(toInfluencer);
  },

  /**
   * Get active influencers only
   */
  async findActive(): Promise<Influencer[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('influencers')
      .select(
        `
        *,
        identifiers:influencer_identifiers(*)
      `
      )
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Influencer findActive error:', error);
      throw new Error(`Failed to fetch active influencers: ${error.message}`);
    }

    return (data || []).map(toInfluencer);
  },

  /**
   * Get influencers by credibility tier
   */
  async findByTier(tier: CredibilityTier): Promise<Influencer[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('influencers')
      .select(
        `
        *,
        identifiers:influencer_identifiers(*)
      `
      )
      .eq('credibility_tier', tier)
      .order('name');

    if (error) {
      console.error('Influencer findByTier error:', error);
      throw new Error(`Failed to fetch influencers by tier: ${error.message}`);
    }

    return (data || []).map(toInfluencer);
  },

  /**
   * Get influencers by expertise topic
   */
  async findByTopic(topic: string): Promise<Influencer[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('influencers')
      .select(
        `
        *,
        identifiers:influencer_identifiers(*)
      `
      )
      .contains('expertise_topics', [topic])
      .order('name');

    if (error) {
      console.error('Influencer findByTopic error:', error);
      throw new Error(`Failed to fetch influencers by topic: ${error.message}`);
    }

    return (data || []).map(toInfluencer);
  },

  /**
   * Save a new influencer
   */
  async save(
    influencer: Omit<Influencer, 'id' | 'addedAt' | 'contentCount'>
  ): Promise<Influencer> {
    const supabase = getSupabase();
    const { identifiers, ...rest } = influencer;

    // Insert influencer
    const { data: infData, error: infError } = await supabase
      .from('influencers')
      .insert({
        name: rest.name,
        description: rest.description,
        credibility_tier: rest.credibilityTier,
        expertise_topics: rest.expertiseTopics,
        affiliation: rest.affiliation,
        is_active: rest.isActive ?? true,
      })
      .select()
      .single();

    if (infError) {
      console.error('Influencer save error:', infError);
      throw new Error(`Failed to save influencer: ${infError.message}`);
    }

    // Insert identifiers
    if (identifiers && identifiers.length > 0) {
      const { error: idError } = await supabase.from('influencer_identifiers').insert(
        identifiers.map((id: PlatformIdentifier) => ({
          influencer_id: infData.id,
          platform: id.platform,
          handle: id.handle,
          profile_url: id.profileUrl,
        }))
      );

      if (idError) {
        console.error('Influencer identifiers save error:', idError);
        // Don't throw - influencer was created, identifiers can be added later
      }
    }

    // Return the full influencer with identifiers
    const result = await this.findById(infData.id);
    if (!result) {
      throw new Error('Failed to retrieve saved influencer');
    }
    return result;
  },

  /**
   * Update an existing influencer
   */
  async update(
    id: string,
    updates: Partial<Omit<Influencer, 'id' | 'addedAt'>>
  ): Promise<Influencer | null> {
    const supabase = getSupabase();

    // Build update object with snake_case keys
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.credibilityTier !== undefined)
      dbUpdates.credibility_tier = updates.credibilityTier;
    if (updates.expertiseTopics !== undefined)
      dbUpdates.expertise_topics = updates.expertiseTopics;
    if (updates.affiliation !== undefined) dbUpdates.affiliation = updates.affiliation;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.contentCount !== undefined) dbUpdates.content_count = updates.contentCount;
    if (updates.lastContentAt !== undefined)
      dbUpdates.last_content_at = updates.lastContentAt;

    const { error } = await supabase.from('influencers').update(dbUpdates).eq('id', id);

    if (error) {
      console.error('Influencer update error:', error);
      return null;
    }

    // Handle identifiers update if provided
    if (updates.identifiers) {
      // Delete existing identifiers
      await supabase.from('influencer_identifiers').delete().eq('influencer_id', id);

      // Insert new identifiers
      if (updates.identifiers.length > 0) {
        await supabase.from('influencer_identifiers').insert(
          updates.identifiers.map((id_obj: PlatformIdentifier) => ({
            influencer_id: id,
            platform: id_obj.platform,
            handle: id_obj.handle,
            profile_url: id_obj.profileUrl,
          }))
        );
      }
    }

    return this.findById(id);
  },

  /**
   * Delete an influencer
   */
  async delete(id: string): Promise<boolean> {
    const supabase = getSupabase();
    const { error } = await supabase.from('influencers').delete().eq('id', id);

    if (error) {
      console.error('Influencer delete error:', error);
      return false;
    }
    return true;
  },

  /**
   * Deactivate an influencer (soft delete)
   */
  async deactivate(id: string): Promise<boolean> {
    const result = await this.update(id, { isActive: false });
    return result !== null;
  },

  /**
   * Increment content count for an influencer
   */
  async incrementContentCount(id: string): Promise<void> {
    const supabase = getSupabase();

    // Try using the RPC function first
    const { error: rpcError } = await supabase.rpc('increment_influencer_content', {
      influencer_uuid: id,
    });

    if (rpcError) {
      // Fallback to manual increment
      const influencer = await this.findById(id);
      if (influencer) {
        await this.update(id, {
          contentCount: influencer.contentCount + 1,
          lastContentAt: new Date().toISOString(),
        });
      }
    }
  },

  /**
   * Get influencer statistics
   */
  async getStats(): Promise<InfluencerStats> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('influencers')
      .select('credibility_tier, is_active, content_count');

    if (error || !data) {
      return {
        total: 0,
        active: 0,
        byTier: { high: 0, medium: 0, standard: 0 },
        totalContent: 0,
      };
    }

    return {
      total: data.length,
      active: data.filter((i) => i.is_active).length,
      byTier: {
        high: data.filter((i) => i.credibility_tier === 'high').length,
        medium: data.filter((i) => i.credibility_tier === 'medium').length,
        standard: data.filter((i) => i.credibility_tier === 'standard').length,
      },
      totalContent: data.reduce((sum, i) => sum + (i.content_count || 0), 0),
    };
  },

  // ==========================================
  // Compatibility methods (for migration)
  // ==========================================

  /**
   * Get all influencers (compatibility with InfluencerRegistryManager)
   * @deprecated Use findAll() instead
   */
  getAll(): Promise<Influencer[]> {
    return this.findAll();
  },

  /**
   * Get active influencers (compatibility with InfluencerRegistryManager)
   * @deprecated Use findActive() instead
   */
  getActive(): Promise<Influencer[]> {
    return this.findActive();
  },

  /**
   * Get by ID (compatibility with InfluencerRegistryManager)
   * @deprecated Use findById() instead
   */
  getById(id: string): Promise<Influencer | null> {
    return this.findById(id);
  },

  /**
   * Get by name (compatibility with InfluencerRegistryManager)
   * @deprecated Use findByName() instead
   */
  getByName(name: string): Promise<Influencer | null> {
    return this.findByName(name);
  },

  /**
   * Get by tier (compatibility with InfluencerRegistryManager)
   * @deprecated Use findByTier() instead
   */
  getByTier(tier: CredibilityTier): Promise<Influencer[]> {
    return this.findByTier(tier);
  },

  /**
   * Get by topic (compatibility with InfluencerRegistryManager)
   * @deprecated Use findByTopic() instead
   */
  getByTopic(topic: string): Promise<Influencer[]> {
    return this.findByTopic(topic);
  },

  /**
   * Add a new influencer (compatibility with InfluencerRegistryManager)
   * @deprecated Use save() instead
   */
  add(influencer: Omit<Influencer, 'id' | 'addedAt' | 'contentCount'>): Promise<Influencer> {
    return this.save(influencer);
  },

  /**
   * Remove an influencer (compatibility with InfluencerRegistryManager)
   * @deprecated Use delete() instead
   */
  remove(id: string): Promise<boolean> {
    return this.delete(id);
  },
};

// Default export for convenience
export default influencerDb;
