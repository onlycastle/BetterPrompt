/**
 * Share Section Component
 *
 * Provides social sharing functionality for AI coding style reports.
 * Includes Twitter/X, LinkedIn, and clipboard copy options with tracking.
 */

import { type TypeResult, TYPE_METADATA, type CodingStyleType } from '../../models/index.js';

/**
 * Dashboard Buttons - shows both My Dashboard and Enterprise buttons
 *
 * @returns HTML string with styled dashboard button links
 */
export function renderDashboardButtons(): string {
  const baseUrl = process.env.NOSLOP_DASHBOARD_URL || 'http://localhost:5173';

  return `
    <div class="dashboard-buttons" style="
      display: flex;
      gap: 16px;
      justify-content: center;
      margin: 32px 0;
      flex-wrap: wrap;
    ">
      <a
        href="${baseUrl}/personal"
        class="dashboard-btn personal"
        style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #00d4ff, #ff00ff);
          color: #0a0a0a;
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);
        "
        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(0, 212, 255, 0.6)';"
        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(0, 212, 255, 0.4)';"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        My Dashboard
      </a>
      <a
        href="${baseUrl}/enterprise"
        class="dashboard-btn enterprise"
        style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #00ff88, #00d4ff);
          color: #0a0a0a;
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        "
        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(0, 255, 136, 0.6)';"
        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(0, 255, 136, 0.4)';"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 21h18"></path>
          <path d="M5 21V7l8-4v18"></path>
          <path d="M19 21V11l-6-4"></path>
          <path d="M9 9v.01"></path>
          <path d="M9 12v.01"></path>
          <path d="M9 15v.01"></path>
          <path d="M9 18v.01"></path>
        </svg>
        Enterprise
      </a>
    </div>
  `;
}

/**
 * Share Section - Social sharing buttons and copy-to-clipboard
 *
 * Provides social media sharing functionality with pre-filled content
 * and tracking for analytics.
 *
 * @param _result - Type result (unused but kept for API consistency)
 * @param meta - Metadata about the coding style type
 * @param reportId - Optional unique report ID for sharing
 * @param baseUrl - Base URL for the report (default: https://nomoreaislop.xyz)
 * @returns HTML string with share buttons and copy functionality
 */
export function renderShareSection(
  _result: TypeResult,
  meta: typeof TYPE_METADATA[CodingStyleType],
  reportId?: string,
  baseUrl: string = 'https://nomoreaislop.xyz'
): string {
  if (!reportId) {
    return ''; // No share section if no reportId
  }

  const shareUrl = `${baseUrl}/r/${reportId}`;

  // Pre-filled tweet text
  const tweetText = encodeURIComponent(`I'm a ${meta.name} ${meta.emoji} developer!

My AI Coding Style:
"${meta.tagline}"

Top Strength: ${meta.strengths[0]}

What's YOUR style? Find out:
${shareUrl}

#NoMoreAISlop #AICollaboration #DeveloperTools`);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return `
    <div class="share-section">
      <h3 class="share-title">📤 Share Your Results</h3>
      <p class="share-subtitle">Show off your AI coding style!</p>

      <div class="share-buttons">
        <button class="share-btn twitter" onclick="window.open('${twitterUrl}', '_blank', 'width=600,height=400')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span>Share on X</span>
        </button>

        <button class="share-btn linkedin" onclick="window.open('${linkedInUrl}', '_blank', 'width=600,height=600')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <span>Share on LinkedIn</span>
        </button>

        <button class="share-btn copy" onclick="copyShareUrl()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span id="copy-btn-text">Copy Link</span>
        </button>
      </div>

      <div class="share-url-container">
        <input type="text" class="share-url-input" id="share-url" value="${shareUrl}" readonly onclick="this.select()">
      </div>

      <!-- Toast notification -->
      <div class="toast" id="toast">
        <span class="toast-icon">✓</span>
        <span class="toast-text">Link copied to clipboard!</span>
      </div>
    </div>

    <script>
      function copyShareUrl() {
        const urlInput = document.getElementById('share-url');
        const copyBtnText = document.getElementById('copy-btn-text');
        const toast = document.getElementById('toast');

        navigator.clipboard.writeText(urlInput.value).then(() => {
          // Show toast
          toast.classList.add('show');
          copyBtnText.textContent = 'Copied!';

          // Track share action
          fetch('${baseUrl}/api/reports/${reportId}/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'clipboard' })
          }).catch(() => {});

          // Reset after 2 seconds
          setTimeout(() => {
            toast.classList.remove('show');
            copyBtnText.textContent = 'Copy Link';
          }, 2000);
        }).catch((err) => {
          console.error('Failed to copy:', err);
          // Fallback: select the text
          urlInput.select();
          document.execCommand('copy');
        });
      }

      // Track Twitter/LinkedIn shares
      document.querySelectorAll('.share-btn.twitter, .share-btn.linkedin').forEach(btn => {
        btn.addEventListener('click', () => {
          const platform = btn.classList.contains('twitter') ? 'twitter' : 'linkedin';
          fetch('${baseUrl}/api/reports/${reportId}/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform })
          }).catch(() => {});
        });
      });
    </script>
  `;
}
