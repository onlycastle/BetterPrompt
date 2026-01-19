/**
 * Apple Notarization Script
 *
 * This script runs after code signing to notarize the macOS app with Apple.
 * Notarization is required for apps distributed outside the Mac App Store.
 *
 * Required environment variables:
 * - APPLE_ID: Apple Developer ID email
 * - APPLE_APP_SPECIFIC_PASSWORD: App-specific password from appleid.apple.com
 * - APPLE_TEAM_ID: Developer Team ID
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization: not macOS');
    return;
  }

  // Skip if credentials are not provided (local development)
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('Skipping notarization: missing Apple credentials');
    console.log('  Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID for notarization');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });

    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error.message);
    // Don't throw - allow build to continue for local development
    if (process.env.CI) {
      throw error;
    }
  }
};
