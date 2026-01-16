/**
 * Polar.sh SDK Client
 *
 * Provides a configured Polar client for payment operations.
 * Uses production environment (test with 100% discount coupon).
 */

import { Polar } from '@polar-sh/sdk';

let polarClient: Polar | null = null;

/**
 * Get a singleton Polar client instance
 */
export function getPolarClient(): Polar {
  if (polarClient) {
    return polarClient;
  }

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      'POLAR_ACCESS_TOKEN is not configured. ' +
      'Get your access token from https://polar.sh/settings'
    );
  }

  polarClient = new Polar({
    accessToken,
  });

  return polarClient;
}

/**
 * Get product ID from environment
 */
export function getProductId(): string {
  const productId = process.env.POLAR_PRODUCT_ID;
  if (!productId) {
    throw new Error(
      'POLAR_PRODUCT_ID is not configured. ' +
      'Get your product ID from https://polar.sh/dashboard'
    );
  }
  return productId;
}
