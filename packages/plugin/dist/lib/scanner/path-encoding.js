/**
 * Cross-Platform Path Encoding/Decoding
 *
 * Single source of truth for detecting and handling Windows vs Unix
 * encoded project paths from Claude Code.
 *
 * Encoding rules:
 * - Unix:    /Users/dev/app    → -Users-dev-app      (/ → -)
 * - Windows: C:\alphacut       → C--alphacut          (C:\ → C--, \ → -)
 *
 * Detection:
 * - Unix paths start with '-' (from leading /)
 * - Windows paths match /^[A-Za-z]--/ (drive letter + colon-backslash)
 *
 * @module path-encoding
 */
/**
 * Check if an encoded directory name represents a Windows path.
 * Pattern: single letter followed by '--' (e.g. 'C--alphacut')
 */
export function isWindowsEncodedPath(encoded) {
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
export function decodeProjectPathCrossPlatform(encoded) {
    if (isWindowsEncodedPath(encoded)) {
        // Windows: 'C--alphacut-tools' → 'C:/alphacut/tools'
        const driveLetter = encoded[0];
        const rest = encoded.slice(3); // skip 'X--'
        if (!rest)
            return `${driveLetter}:/`;
        return `${driveLetter}:/${rest.replace(/-/g, '/')}`;
    }
    // Unix: '-Users-dev-app' → '/Users/dev/app'
    if (encoded.startsWith('-')) {
        return encoded.replace(/-/g, '/');
    }
    return encoded;
}
//# sourceMappingURL=path-encoding.js.map