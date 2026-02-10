/**
 * Enterprise Access Control
 * Whitelist of emails allowed to access enterprise dashboard during development phase
 */

export const ENTERPRISE_ALLOWED_EMAILS: string[] = [
  'sungman.cho@tbdlabs.team',
];

export function isEnterpriseAllowed(email: string | undefined): boolean {
  if (!email) return false;
  return ENTERPRISE_ALLOWED_EMAILS.includes(email.toLowerCase());
}
