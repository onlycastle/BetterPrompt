import type { CredibilityTier, Influencer } from '../models/influencer';
import { getInfluencerRegistry } from '../influencers/registry';

export interface InfluencerStats {
  total: number;
  active: number;
  byTier: Record<CredibilityTier, number>;
  totalContent: number;
}

const registry = getInfluencerRegistry();

export const influencerDb = {
  async findByHandle(platform: string, handle: string): Promise<Influencer | null> {
    return registry.findByHandle(platform, handle) ?? null;
  },

  async findByName(name: string): Promise<Influencer | null> {
    return registry.getByName(name) ?? null;
  },

  async findActive(): Promise<Influencer[]> {
    return registry.getActive();
  },

  async getStats(): Promise<InfluencerStats> {
    return registry.getStats();
  },
};
