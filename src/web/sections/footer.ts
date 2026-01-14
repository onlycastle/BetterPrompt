/**
 * Footer Component
 *
 * Renders the report footer with generation date and branding.
 */

/**
 * Footer - displays analysis generation date and branding
 *
 * Generates a footer section with the current date and a link to the
 * NoMoreAISlop website.
 *
 * @returns HTML string with formatted footer content
 */
export function renderFooter(): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <footer class="footer">
      <p>Analysis generated on ${date}</p>
      <p>Built with 💜 by <a href="https://nomoreaislop.dev">NoMoreAISlop</a></p>
    </footer>
  `;
}
