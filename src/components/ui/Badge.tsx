import { type ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'platform';
export type PlatformType = 'youtube' | 'twitter' | 'reddit' | 'linkedin' | 'web';

export interface BadgeProps {
  variant?: BadgeVariant;
  platform?: PlatformType;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Badge({
  variant = 'default',
  platform,
  size = 'md',
  children,
}: BadgeProps) {
  const platformClass = platform ? styles[`platform-${platform}`] : '';

  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${styles[size]} ${platformClass}`}
    >
      {children}
    </span>
  );
}

// Convenience component for platform badges
export interface PlatformBadgeProps {
  platform: PlatformType;
  size?: 'sm' | 'md';
}

const PLATFORM_LABELS: Record<PlatformType, string> = {
  youtube: 'YouTube',
  twitter: 'X',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  web: 'Web',
};

export function PlatformBadge({ platform, size = 'sm' }: PlatformBadgeProps) {
  return (
    <Badge variant="platform" platform={platform} size={size}>
      {PLATFORM_LABELS[platform]}
    </Badge>
  );
}

// Credibility tier badge
export interface TierBadgeProps {
  tier: 'high' | 'medium' | 'standard';
  size?: 'sm' | 'md';
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const tierEmoji = tier === 'high' ? '⭐' : tier === 'medium' ? '✨' : '';
  return (
    <Badge variant="default" size={size}>
      {tierEmoji} {tier}
    </Badge>
  );
}
