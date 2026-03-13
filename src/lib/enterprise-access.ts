/**
 * Enterprise Access Control
 * Checks if a user belongs to an organization (client-side check via AuthUser).
 */

export function isEnterpriseAllowed(organizationId: string | null | undefined): boolean {
  return !!organizationId;
}
