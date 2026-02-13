/**
 * Cross-Platform Path Encoding/Decoding (Server-side)
 *
 * Mirror of packages/cli/src/lib/path-encoding.ts for the Next.js/Lambda
 * server package. CLI and server build independently, so this is a separate file.
 *
 * @see packages/cli/src/lib/path-encoding.ts for full documentation
 * @module path-encoding
 */

/**
 * Check if an encoded directory name represents a Windows path.
 * Pattern: single letter followed by '--' (e.g. 'C--alphacut')
 */
export function isWindowsEncodedPath(encoded: string): boolean {
  return /^[A-Za-z]--/.test(encoded);
}

/**
 * Decode an encoded project directory name to its original filesystem path.
 * Handles both Unix and Windows encoded formats.
 *
 * @example
 * decodeProjectPathCrossPlatform('-Users-dev-app')     → '/Users/dev/app'
 * decodeProjectPathCrossPlatform('C--alphacut')        → 'C:/alphacut'
 * decodeProjectPathCrossPlatform('C--alphacut-tools')  → 'C:/alphacut/tools'
 */
export function decodeProjectPathCrossPlatform(encoded: string): string {
  if (isWindowsEncodedPath(encoded)) {
    const driveLetter = encoded[0];
    const rest = encoded.slice(3);
    if (!rest) return `${driveLetter}:/`;
    return `${driveLetter}:/${rest.replace(/-/g, '/')}`;
  }

  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }

  return encoded;
}
